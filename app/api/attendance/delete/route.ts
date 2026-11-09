import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { withMemberChange } from "@/lib/membership-ops";
import { getErpUser, canManageBranch } from "@/lib/erp-session";

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
      `SELECT a.attendance_id, a.result, a.member_id, a.member_name, a.branch_name, a.used_count, a.pass_type AS att_pass_type, a.memo
       FROM attendance a
       WHERE a.attendance_id = ?`,
      [attendance_id]
    );

    if (rows.length === 0) {
      return NextResponse.json({ success: false, message: "출석 기록 없음" });
    }

    const { result, member_id, member_name, branch_name: attBranch, used_count, att_pass_type, memo: origMemo } = rows[0];

    // 지점 권한 검증: DIRECTOR는 자기 지점 출석만 취소 가능
    if (attBranch && !canManageBranch(user, attBranch)) {
      return NextResponse.json({ success: false, message: "권한이 없습니다." }, { status: 403 });
    }

    // 퇴장(CHECK_OUT) 기록: result='CHECK_OUT' → used_count=0 이므로 복원 없음
    // 실패 기록(EXPIRED, NO_COUNT 등): used_count=0 → 복원 없음
    // COUNT 성공 입장: result='SUCCESS' AND used_count>0 → 복원
    const shouldRestore = result === "SUCCESS" && Number(used_count) > 0;

    const actor = user.login_id || "관리자";

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
