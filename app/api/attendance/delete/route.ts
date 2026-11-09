import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { withMemberChange } from "@/lib/membership-ops";
import { getErpUser, canManageBranch, requireRole } from "@/lib/erp-session";

export async function POST(req: Request) {
  try {
    const user = await getErpUser(req);
    if (!user) return NextResponse.json({ success: false, message: "로그인이 필요합니다." }, { status: 401 });

    const body = await req.json();
    const { attendance_id, cancel_reason } = body;
    if (!attendance_id) return NextResponse.json({ success: false, message: "attendance_id 없음" });

    // DB에서 직접 확인 (클라이언트 body 신뢰하지 않음)
    // used_count: 실제 차감 여부 — pass_type(현재 회원권)이 아닌 당시 차감 여부 기준으로 복원
    // 재결제 후 과거 취소 케이스: attendance.used_count > 0 이면 당시 COUNT 차감 발생 → 복원
    // 단, attendance 테이블에 payment_id가 없어 "어떤 결제"인지는 식별 불가
    // → 현재 회원권이 PERIOD이더라도 used_count > 0 이면 remaining_count+1 적용
    // → 이 경우 현재 회원권과 무관한 복원이 발생할 수 있음 (구조적 한계)
    const [rows]: any = await pool.query(
      `SELECT a.attendance_id, a.result, a.member_id, a.member_name, a.branch_name, a.used_count, a.pass_type AS att_pass_type, a.memo, a.checkin_time
       FROM attendance a
       WHERE a.attendance_id = ?`,
      [attendance_id]
    );

    if (rows.length === 0) {
      return NextResponse.json({ success: false, message: "출석 기록 없음" });
    }

    const { result, member_id, member_name, branch_name: attBranch, used_count, att_pass_type, memo: origMemo } = rows[0];

    // 역할 검증: COACH 이하는 취소 불가
    if (!requireRole(user, ["ADMIN", "OWNER", "DIRECTOR"])) {
      return NextResponse.json({ success: false, message: "권한이 없습니다." }, { status: 403 });
    }

    // 지점 권한 검증: DIRECTOR는 자기 지점 출석만 취소 가능
    if (attBranch && !canManageBranch(user, attBranch)) {
      return NextResponse.json({ success: false, message: "권한이 없습니다." }, { status: 403 });
    }

    // 퇴장(CHECK_OUT) 기록: result='CHECK_OUT' → used_count=0 이므로 복원 없음
    // 실패 기록(EXPIRED, NO_COUNT 등): used_count=0 → 복원 없음
    // COUNT 성공 입장: result='SUCCESS' AND used_count>0 → 복원 후보
    const shouldRestore = result === "SUCCESS" && Number(used_count) > 0;

    const actor = user.login_id || "관리자";

    // COUNT 패스 재등록 후 과거 출석 취소 차단
    // attendance에 payment_id가 없어 "어느 패스의 차감인지" 확실히 증명 불가
    // 현재 패스 start_date와 비교해 소속 패스를 추정하되, 증명 불가 시 항상 409 반환
    if (shouldRestore && member_id) {
      const [memberRows]: any = await pool.query(
        "SELECT pass_type, start_date FROM members WHERE member_id = ?",
        [member_id]
      );
      const member = memberRows[0];
      const checkinRow = rows[0] as any;

      if (member && member.pass_type === "COUNT") {
        const memberStartDate = member.start_date
          ? String(member.start_date).slice(0, 10)
          : null;
        const checkinDate = checkinRow.checkin_time
          ? String(checkinRow.checkin_time).slice(0, 10)
          : null;

        // 차단 조건: start_date 없음(패스 식별 불가) 또는 출석일이 start_date와 같거나 이전
        // - start_date NULL: 현재 패스가 어느 날 시작됐는지 알 수 없어 증명 불가 → 차단
        // - checkin == start_date: 당일 재등록 가능 — 이전 패스 출석과 구분 불가 → 차단
        // - checkin < start_date: 명확히 이전 패스 → 차단
        // 허용은 checkin > start_date인 경우에만 (현재 패스 기간 내 출석임이 확실)
        const isCurrentPass = memberStartDate && checkinDate && checkinDate > memberStartDate;
        if (!isCurrentPass) {
          return NextResponse.json(
            {
              success: false,
              requiresManualReview: true,
              message: memberStartDate
                ? `현재 회원권(시작일: ${memberStartDate}) 범위를 벗어난 출석 기록입니다. 자동 횟수 복원이 차단됩니다. 관리자가 직접 확인 후 처리해주세요.`
                : "현재 회원권의 시작일을 확인할 수 없어 자동 횟수 복원이 차단됩니다. 관리자가 직접 확인 후 처리해주세요.",
            },
            { status: 409 }
          );
        }
      }
    }

    // ── 일일권(DAILY) 출석 취소: day_pass PENDING 복원 ─────────────
    if (att_pass_type === "DAILY" && result === "SUCCESS") {
      const conn = await (pool as any).getConnection();
      try {
        await conn.beginTransaction();

        const [attCheck]: any = await conn.query(
          "SELECT attendance_id FROM attendance WHERE attendance_id = ? FOR UPDATE",
          [attendance_id]
        );
        if (attCheck.length === 0) {
          await conn.rollback();
          return NextResponse.json({ success: false, message: "이미 삭제된 기록입니다." });
        }

        // day_passes에서 연결된 행 찾기 (attendance_id로)
        const [dpRows]: any = await conn.query(
          "SELECT pass_id, status FROM day_passes WHERE attendance_id = ? FOR UPDATE",
          [attendance_id]
        );

        await conn.query("DELETE FROM attendance WHERE attendance_id = ?", [attendance_id]);

        if (dpRows.length > 0 && dpRows[0].status === "USED") {
          // 지난 날짜의 일일권은 복원 불가 (use_date 확인)
          const [dpDetail]: any = await conn.query(
            "SELECT use_date FROM day_passes WHERE pass_id = ?",
            [dpRows[0].pass_id]
          );
          const kstTodayVal = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
          const useDate = dpDetail[0]?.use_date ? String(dpDetail[0].use_date).slice(0, 10) : null;

          if (useDate && useDate >= kstTodayVal) {
            // 오늘 이후 일일권만 PENDING으로 복원
            await conn.query(
              "UPDATE day_passes SET status='PENDING', used_at=NULL, attendance_id=NULL WHERE pass_id=?",
              [dpRows[0].pass_id]
            );
          }
          // 지난 날짜: 출석 기록만 삭제, day_pass는 CANCELLED로 전환
          else if (useDate) {
            await conn.query(
              "UPDATE day_passes SET status='CANCELLED', attendance_id=NULL WHERE pass_id=?",
              [dpRows[0].pass_id]
            );
          }
        }

        if (member_id) {
          await conn.query(
            `INSERT INTO member_histories (member_id, member_name, action_type, action_memo, old_value, new_value, created_by)
             VALUES (?, ?, 'ATTENDANCE_UNDO', ?, ?, ?, ?)`,
            [
              member_id,
              member_name || null,
              cancel_reason || "일일권 입장 취소",
              JSON.stringify({ attendance_id, result, pass_type: "DAILY", memo: origMemo }),
              JSON.stringify({ day_pass: dpRows[0] ? `pass_id=${dpRows[0].pass_id} 복원` : "연결된 day_pass 없음" }),
              actor,
            ]
          );
        }

        await conn.commit();
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }

      return NextResponse.json({ success: true });
    }

    if (shouldRestore && member_id) {
      await withMemberChange(
        { type: "ATTENDANCE_UNDO", reason: cancel_reason || "입장 취소", source: "attendance/delete", actor },
        async (conn) => {
          // 반복 취소 방지: FOR UPDATE로 행 잠금 후 존재 확인
          const [check]: any = await conn.query(
            "SELECT attendance_id FROM attendance WHERE attendance_id = ? FOR UPDATE",
            [attendance_id]
          );
          if (check.length === 0) throw new Error("ALREADY_DELETED");

          await conn.query("DELETE FROM attendance WHERE attendance_id = ?", [attendance_id]);
          await conn.query(
            "UPDATE members SET remaining_count = remaining_count + 1 WHERE member_id = ?",
            [member_id]
          );
          // 취소 이력 기록 (P2 이슈 #17 해결)
          await conn.query(
            `INSERT INTO member_histories (member_id, member_name, action_type, action_memo, old_value, new_value, created_by)
             VALUES (?, ?, 'ATTENDANCE_UNDO', ?, ?, ?, ?)`,
            [
              member_id,
              member_name || null,
              cancel_reason || "입장 취소",
              JSON.stringify({ attendance_id, result, used_count, pass_type: att_pass_type, memo: origMemo }),
              JSON.stringify({ remaining_count: "+1", note: "당시 차감(used_count>0) 기준 복원" }),
              actor,
            ]
          );
        }
      );
    } else {
      // 복원 없이 삭제만 (퇴장·실패 기록)
      const [check]: any = await pool.query(
        "SELECT attendance_id FROM attendance WHERE attendance_id = ?",
        [attendance_id]
      );
      if (check.length === 0) return NextResponse.json({ success: false, message: "이미 삭제된 기록입니다." });

      await pool.query("DELETE FROM attendance WHERE attendance_id = ?", [attendance_id]);
      if (member_id) {
        await pool.query(
          `INSERT INTO member_histories (member_id, member_name, action_type, action_memo, old_value, new_value, created_by)
           VALUES (?, ?, 'ATTENDANCE_UNDO', ?, ?, ?, ?)`,
          [
            member_id,
            member_name || null,
            cancel_reason || "출석 기록 삭제",
            JSON.stringify({ attendance_id, result, used_count, pass_type: att_pass_type }),
            JSON.stringify({ remaining_count: "변경 없음" }),
            actor,
          ]
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error?.message === "ALREADY_DELETED") {
      return NextResponse.json({ success: false, message: "이미 삭제된 기록입니다." });
    }
    return NextResponse.json({ success: false, error });
  }
}
