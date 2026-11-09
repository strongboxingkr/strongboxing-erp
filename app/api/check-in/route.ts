import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { SolapiMessageService } from "solapi";
import { computeReleaseEnd, kstToday, withMemberChange } from "@/lib/membership-ops";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { phone_last4, checkin_code, branch_name, memo, check_type = "CHECK_IN", } = body;

    const code = checkin_code || phone_last4;

    // 숫자로만 구성된 1~8자리 허용 (기존 4자리·7자리·최대 8자리 모두 지원)
    if (!code || !/^\d{1,8}$/.test(code)) {
      return NextResponse.json({
        success: false,
        message: "출석번호(숫자 최대 8자리)를 입력해주세요.",
      });
    }

    // ── 비회원 일일권 pass_code 조회 (회원 조회보다 먼저) ──────────
    // pass_code는 4자리로 생성되어 members.checkin_code와 충돌하지 않도록 보장됨
    // 단, 같은 코드를 회원과 비회원이 동시에 사용할 경우를 명시적으로 차단
    const kstTodayForPassCode = kstToday();
    let guestDpSql = `SELECT * FROM day_passes WHERE pass_code = ? AND use_date = ? AND status = 'PENDING'`;
    const guestDpParams: any[] = [code, kstTodayForPassCode];
    if (branch_name) { guestDpSql += ` AND branch_name = ?`; guestDpParams.push(branch_name); }
    guestDpSql += ` LIMIT 1`;
    const [guestDpRows]: any = await pool.query(guestDpSql, guestDpParams);
    const guestDayPass = guestDpRows[0] || null;

    // branch_name: 클라이언트 제공 값 그대로 사용
    // 기기 인증 미구현으로 서버에서 지점을 확정할 수 없음 → branch_name 없으면 전 지점 조회
    // 같은 코드가 같은 지점 내 중복인 경우 여러 행이 존재할 수 있음 → LIMIT 1은 임의 선택 위험
    let memberSql = `SELECT * FROM members WHERE checkin_code = ?`;
    const memberParams: any[] = [code];

    if (branch_name) {
      memberSql += ` AND branch_name = ?`;
      memberParams.push(branch_name);
    }

    // 중복 체크: 같은 조건으로 2건 이상이면 임의 선택하지 않고 안내
    memberSql += ` LIMIT 2`;

    const [rows]: any = await pool.query(memberSql, memberParams);

    if (rows.length > 1) {
      return NextResponse.json({
        success: false,
        result: "DUPLICATE_CODE",
        message: "같은 출석번호를 가진 회원이 여러 명입니다. 관리자에게 문의해주세요.",
      });
    }

    // 회원 코드와 비회원 pass_code가 동일 → 충돌 (등록 시 방지했으나 방어 처리)
    if (rows.length > 0 && guestDayPass) {
      return NextResponse.json({
        success: false,
        result: "CODE_CONFLICT",
        message: "입장코드 충돌이 감지됐습니다. 관리자에게 문의해주세요.",
      });
    }

    // ── 비회원 일일권 체크인 ───────────────────────────────────────
    if (rows.length === 0 && guestDayPass) {
      const conn = await (pool as any).getConnection();
      try {
        await conn.beginTransaction();
        const [dpCheck]: any = await conn.query(
          `SELECT pass_id FROM day_passes WHERE pass_id = ? AND status = 'PENDING' FOR UPDATE`,
          [guestDayPass.pass_id]
        );
        if (dpCheck.length === 0) {
          await conn.rollback();
          return NextResponse.json({ success: false, result: "DAY_PASS_USED", message: "이미 사용된 일일권입니다." });
        }
        const [attRes]: any = await conn.query(
          `INSERT INTO attendance (member_id, branch_name, member_name, pass_type, used_count, result, memo) VALUES (NULL,?,?,?,0,'SUCCESS',?)`,
          [guestDayPass.branch_name, guestDayPass.guest_name || "비회원", "DAILY", memo || "비회원 일일권 출석"]
        );
        await conn.query(
          `UPDATE day_passes SET status='USED', used_at=NOW(), attendance_id=? WHERE pass_id=?`,
          [attRes.insertId, guestDayPass.pass_id]
        );
        await conn.commit();
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }
      return NextResponse.json({
        success: true,
        result: "SUCCESS",
        pass_type: "DAILY",
        guest_name: guestDayPass.guest_name || "비회원",
        message: `${guestDayPass.guest_name || "비회원"}님 일일권 입장 완료`,
      });
    }

    if (rows.length === 0) {
      await pool.query(
        `INSERT INTO attendance (member_id, branch_name, member_name, pass_type, used_count, result, memo) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [null, branch_name || null, null, null, 0, "NOT_FOUND", memo || "회원 없음"]
      );

      return NextResponse.json({
        success: false,
        result: "NOT_FOUND",
        message: "회원 없음",
      });
    }

    const member = rows[0];

    if (check_type === "CHECK_OUT") {
      // 오늘 입장 기록 없으면 입장으로 처리
      const todayText = kstToday(); // UTC→KST 변환 (new Date().toISOString()은 UTC 기준으로 KST 23:00~24:00에 날짜 오차 발생)
      const [todayIn]: any = await pool.query(
        `SELECT attendance_id FROM attendance WHERE member_id = ? AND result = 'SUCCESS' AND DATE(checkin_time) = ? LIMIT 1`,
        [member.member_id, todayText]
      );

      if (todayIn.length === 0) {
        // 입장으로 대신 처리 (아래 CHECK_IN 로직으로 fall-through)
      } else {
        if (Number(member.checkout_sms_enabled || 0) === 1 && member.phone) {
          await sendCheckoutSms(member);
        }

        await pool.query(
          `INSERT INTO attendance (member_id, branch_name, member_name, pass_type, used_count, result, memo) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [member.member_id, member.branch_name, member.name, member.pass_type, 0, "CHECK_OUT", "퇴실"]
        );

        return NextResponse.json({
          success: true,
          result: "CHECK_OUT",
          message: "퇴실 완료",
          member,
        });
      }
    }

    const today = new Date();
    const todayText = kstToday(); // KST 기준 (UTC 사용 시 KST 23:00~24:00에 중복 판정 실패)

    const [todayCheckins]: any = await pool.query(
      `
      SELECT attendance_id
      FROM attendance
      WHERE member_id = ?
        AND result = 'SUCCESS'
        AND DATE(checkin_time) = ?
      LIMIT 1
      `,
      [member.member_id, todayText]
    );

    if (todayCheckins.length > 0) {
      return NextResponse.json({
        success: false,
        result: "DUPLICATE",
        message: "오늘 이미 출석한 회원입니다.",
      });
    }

    if (member.status === "REST") {
      // 활성 휴회 기록 조회
      const [holdRows]: any = await pool.query(
        `SELECT * FROM member_holds WHERE member_id = ? AND released_at IS NULL ORDER BY hold_id DESC LIMIT 1`,
        [member.member_id]
      );

      const todayD = new Date();
      todayD.setHours(0, 0, 0, 0);

      if (holdRows.length > 0) {
        const hold = holdRows[0];
        const holdStartD = new Date(hold.hold_start);
        holdStartD.setHours(0, 0, 0, 0);
        const holdEndD = new Date(hold.hold_end);
        holdEndD.setHours(0, 0, 0, 0);

        // [수정] 휴회 전 만료일(old_end_date) 기준으로 잔여일수 계산 → 이중 연장 방지 (lib/membership-ops.ts)
        void holdStartD;
        void holdEndD;
        const { newEnd: newEndDate, remaining: remainingDays } = computeReleaseEnd(hold, member.end_date, kstToday());

        // 휴회 해제 + 만료일 재계산을 한 트랜잭션으로 (변경 내역 자동 기록)
        await withMemberChange(
          { type: "HOLD_RELEASE", reason: "휴회 후 첫 출석으로 이용 재개", source: "check-in", refType: "hold", refId: hold.hold_id, actor: "시스템(자동)" },
          async (conn) => {
            await conn.query(
              `UPDATE member_holds SET released_at = NOW(), released_by = '시스템(자동)' WHERE hold_id = ? AND released_at IS NULL`,
              [hold.hold_id]
            );
            await conn.query(`UPDATE members SET status = 'ACTIVE', end_date = ? WHERE member_id = ? AND status = 'REST'`, [newEndDate, member.member_id]);
          }
        );

        // member 객체 갱신 (이후 로직에서 사용)
        member.status = "ACTIVE";
        member.end_date = newEndDate;

        // 이력 기록
        await pool.query(
          `INSERT INTO member_histories (member_id, member_name, action_type, action_memo, old_value, new_value, created_by)
           VALUES (?, ?, 'HOLD_RELEASE', ?, ?, ?, '시스템(자동)')`,
          [
            member.member_id, member.name,
            `체크인으로 휴회 자동해제 (잔여 ${remainingDays}일 → ${newEndDate}까지)`,
            JSON.stringify({ hold_id: hold.hold_id, old_end_date: member.end_date }),
            JSON.stringify({ new_end_date: newEndDate, remaining_days: remainingDays }),
          ]
        );

        // fall-through to normal check-in
      } else {
        // 휴회 기록 없이 REST인 경우 그냥 차단
        await saveAttendance(member, "REST", memo || "휴회중 회원");
        return NextResponse.json({
          success: false,
          result: "REST",
          message: "휴회중 회원",
        });
      }
    }

    // KST 문자열 비교로 만료 판정 (new Date(end_date) UTC 파싱 오차 방지)
    const endDateStr: string | null = member.end_date ? String(member.end_date).slice(0, 10) : null;

    if (member.status === "EXPIRED" || (endDateStr && endDateStr < todayText)) {
      await withMemberChange({ type: "AUTO_EXPIRE", reason: "만료일 경과", source: "check-in", actor: "시스템(자동)" }, (conn) =>
        conn.query(`UPDATE members SET status = 'EXPIRED' WHERE member_id = ?`, [member.member_id])
      );

      await saveAttendance(member, "EXPIRED", memo || "만료된 회원");

      return NextResponse.json({
        success: false,
        result: "EXPIRED",
        message: "기간만료 회원",
        member: {
          member_id: member.member_id,
          name: member.name,
          branch_name: member.branch_name,
          phone: member.phone,
          product_name: member.product_name,
          pass_type: member.pass_type,
          end_date: member.end_date,
        },
      });
    }

    // ── 일일권 확인 ──────────────────────────────────────────────
    // use_pass: 클라이언트가 명시적으로 선택한 이용권 타입 ("REGULAR" | "DAILY")
    // 없으면 자동 선택 (둘 다 가능하면 MULTIPLE_PASSES 반환)
    const usePass = body.use_pass as string | undefined;

    const [dayPassRows]: any = await pool.query(
      `SELECT pass_id FROM day_passes WHERE member_id = ? AND use_date = ? AND status = 'PENDING' LIMIT 1 FOR UPDATE`,
      [member.member_id, todayText]
    );
    const hasDayPass = dayPassRows.length > 0;
    const dayPass = hasDayPass ? dayPassRows[0] : null;

    // 정기 회원권 유효 여부 (만료·잔여 횟수 0 포함)
    const regularPassValid = !(
      member.status === "EXPIRED" ||
      (endDateStr && endDateStr < todayText) ||
      (member.pass_type === "COUNT" && Number(member.remaining_count || 0) <= 0)
    );

    // 둘 다 사용 가능 → 선택 필요 (임의 차감 금지)
    if (hasDayPass && regularPassValid && !usePass) {
      // 선택 화면에 필요한 상세 정보 포함
      const [dpDetail]: any = await pool.query(
        "SELECT use_date FROM day_passes WHERE pass_id = ? LIMIT 1",
        [dayPass.pass_id]
      );
      return NextResponse.json({
        success: false,
        result: "MULTIPLE_PASSES",
        message: "정기 회원권과 일일권이 모두 있습니다. 사용할 이용권을 선택해주세요.",
        member: { member_id: member.member_id, name: member.name },
        regular_pass: {
          product_name: member.product_name,
          end_date: member.end_date ? String(member.end_date).slice(0, 10) : null,
          remaining_count: member.pass_type === "COUNT" ? member.remaining_count : null,
          pass_type: member.pass_type,
        },
        day_pass: {
          pass_id: dayPass.pass_id,
          use_date: dpDetail[0]?.use_date ? String(dpDetail[0].use_date).slice(0, 10) : todayText,
        },
        options: ["REGULAR", "DAILY"],
      });
    }

    // use_pass 선택 시 서버 재검증: 지점 소속 확인
    if (usePass === "REGULAR" && branch_name && member.branch_name && member.branch_name !== branch_name) {
      return NextResponse.json({ success: false, result: "BRANCH_MISMATCH", message: "회원 지점이 일치하지 않습니다." });
    }

    // 일일권 사용 경로
    if ((usePass === "DAILY" || (!regularPassValid && hasDayPass))) {
      if (!hasDayPass) {
        return NextResponse.json({ success: false, result: "NO_DAY_PASS", message: "오늘 사용 가능한 일일권이 없습니다." });
      }

      // day_pass 지점 검증
      if (branch_name && dayPass.branch_name && dayPass.branch_name !== branch_name) {
        return NextResponse.json({ success: false, result: "BRANCH_MISMATCH", message: "일일권 지점이 일치하지 않습니다." });
      }

      const conn = await (pool as any).getConnection();
      let attendanceId: number;
      try {
        await conn.beginTransaction();

        // 동시 요청 방지: FOR UPDATE로 이미 잠근 행을 다시 확인
        const [dpCheck]: any = await conn.query(
          `SELECT pass_id FROM day_passes WHERE pass_id = ? AND status = 'PENDING' FOR UPDATE`,
          [dayPass.pass_id]
        );
        if (dpCheck.length === 0) {
          await conn.rollback();
          return NextResponse.json({ success: false, result: "DAY_PASS_USED", message: "일일권이 이미 사용됐습니다." });
        }

        const [attRes]: any = await conn.query(
          `INSERT INTO attendance (member_id, branch_name, member_name, pass_type, used_count, result, memo) VALUES (?,?,?,?,0,'SUCCESS',?)`,
          [member.member_id, member.branch_name, member.name, "DAILY", memo || "일일권 출석"]
        );
        attendanceId = attRes.insertId;

        await conn.query(
          `UPDATE day_passes SET status='USED', used_at=NOW(), attendance_id=? WHERE pass_id=?`,
          [attendanceId, dayPass.pass_id]
        );

        await conn.commit();
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }

      return NextResponse.json({
        success: true,
        result: "SUCCESS",
        message: "일일권 출석 완료",
        pass_type: "DAILY",
        member: { member_id: member.member_id, name: member.name, branch_name: member.branch_name },
      });
    }

    // ── 정기 회원권 경로 ───────────────────────────────────────────
    let remainingCount = Number(member.remaining_count || 0);

    if (member.pass_type === "COUNT") {
      if (remainingCount <= 0) {
        await saveAttendance(member, "NO_COUNT", memo || "남은 횟수 없음");

        return NextResponse.json({
          success: false,
          result: "NO_COUNT",
          message: "남은 횟수 없음",
        });
      }

      // 횟수 차감 + 출석 INSERT를 한 트랜잭션으로 (원자성: 둘 다 성공하거나 둘 다 롤백)
      await withMemberChange({ type: "ATTENDANCE", source: "check-in" }, async (conn) => {
        await conn.query(`UPDATE members SET remaining_count = remaining_count - 1 WHERE member_id = ?`, [member.member_id]);
        await conn.query(
          `INSERT INTO attendance (member_id, branch_name, member_name, pass_type, used_count, result, memo) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [member.member_id, member.branch_name, member.name, member.pass_type, 1, "SUCCESS", memo || "출석 완료"]
        );
      });

      remainingCount = remainingCount - 1;
    } else {
      await saveAttendance(member, "SUCCESS", memo || "출석 완료");
    }

    if (
      Number(member.checkin_sms_enabled || 0) === 1 &&
      member.emergency_contact
    ) {
      await sendAttendanceSms(member);
    }

    await pool.query(
      `
      INSERT INTO member_histories (
        member_id,
        member_name,
        action_type,
        action_memo,
        old_value,
        new_value,
        created_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        member.member_id,
        member.name,
        "ATTENDANCE",
        "출석 체크",
        JSON.stringify(member),
        JSON.stringify({
          result: "SUCCESS",
          used_count: member.pass_type === "COUNT" ? 1 : 0,
          remaining_count: remainingCount,
        }),
        "시스템",
      ]
    );

    return NextResponse.json({
      success: true,
      result: "SUCCESS",
      message: "출석 완료",
      member: {
        member_id: member.member_id,
        name: member.name,
        branch_name: member.branch_name,
        phone: member.phone,
        checkin_code: member.checkin_code,
        product_name: member.product_name,
        pass_type: member.pass_type,
        remaining_count:
          member.pass_type === "COUNT"
            ? remainingCount
            : member.end_date
            ? Math.max(0, Math.round((new Date(String(member.end_date).slice(0, 10)).getTime() - new Date(kstToday()).getTime()) / 86400000)) + "일"
            : "기간권",
        end_date: member.end_date,
        start_date: member.start_date,
        has_uniform: member.has_uniform || 0,
        has_locker: member.has_locker || 0,
        locker_no: member.locker_no || "",
      },
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: "출석 처리 중 오류가 발생했습니다.",
        error,
      },
      { status: 500 }
    );
  }
}

async function saveAttendance(member: any, result: string, memo?: string) {
  await pool.query(
    `
    INSERT INTO attendance (
      member_id,
      branch_name,
      member_name,
      pass_type,
      used_count,
      result,
      memo
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      member.member_id,
      member.branch_name,
      member.name,
      member.pass_type,
      result === "SUCCESS" && member.pass_type === "COUNT" ? 1 : 0,
      result,
      memo || null,
    ]
  );
}

async function sendAttendanceSms(member: any) {
  try {
    // 오늘 이미 입장 문자 보냈으면 스킵
    const [already]: any = await pool.query(
      `SELECT COUNT(*) AS cnt FROM sms_logs
       WHERE receiver_phone = ? AND target_type = 'ATTENDANCE' AND DATE(created_at) = CURDATE()`,
      [String(member.emergency_contact || "").replace(/[^0-9]/g, "")]
    );
    if (already[0].cnt > 0) return;

    const from = getFromNumber(member.branch_name);

    if (!from) return;

    const apiKey = process.env.SOLAPI_API_KEY;
    const apiSecret = process.env.SOLAPI_API_SECRET;

    if (!apiKey || !apiSecret) return;

    const messageService = new SolapiMessageService(
      apiKey,
      apiSecret
    );

    const now = new Date();

    const timeText = now.toLocaleString("ko-KR", {
      timeZone: "Asia/Seoul",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

    const to = cleanPhone(member.emergency_contact);

    if (to.length < 10) return;

    const text = `[스트롱복싱 ${member.branch_name}]
${member.name} 회원님이 ${timeText} 출석했습니다.`;

    await messageService.send({
      to,
      from: cleanPhone(from),
      text,
    });

    await pool.query(
      `
      INSERT INTO sms_logs
      (
        branch_name,
        target_type,
        receiver_name,
        receiver_phone,
        message,
        send_status,
        provider
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        member.branch_name,
        "ATTENDANCE",
        member.name,
        member.emergency_contact,
        text,
        "SENT",
        "SOLAPI",
      ]
    );
  } catch (error) {
    console.error("출석 문자 발송 실패", error);
  }
}

async function sendCheckoutSms(member: any) {
  try {
    // 오늘 이미 퇴실 문자 보냈으면 스킵
    const [already]: any = await pool.query(
      `SELECT COUNT(*) AS cnt FROM sms_logs
       WHERE receiver_phone = ? AND target_type = 'CHECKOUT' AND DATE(created_at) = CURDATE()`,
      [String(member.phone || "").replace(/[^0-9]/g, "")]
    );
    if (already[0].cnt > 0) return;

    const from = getFromNumber(member.branch_name);

    if (!from) return;

    const apiKey = process.env.SOLAPI_API_KEY;
    const apiSecret = process.env.SOLAPI_API_SECRET;

    if (!apiKey || !apiSecret) return;

    const messageService = new SolapiMessageService(
      apiKey,
      apiSecret
    );

    const now = new Date();

    const timeText = now.toLocaleString("ko-KR", {
      timeZone: "Asia/Seoul",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

    const to = cleanPhone(member.phone);

    if (to.length < 10) return;

    const text = `[스트롱복싱 ${member.branch_name}]
${member.name} 회원님이 ${timeText} 퇴실했습니다.`;

    await messageService.send({
      to,
      from: cleanPhone(from),
      text,
    });

    await pool.query(
      `INSERT INTO sms_logs (branch_name, target_type, receiver_name, receiver_phone, message, send_status, provider)
       VALUES (?, 'CHECKOUT', ?, ?, ?, 'SENT', 'SOLAPI')`,
      [member.branch_name, member.name, member.phone, text]
    );
  } catch (error) {
    console.error("퇴실 문자 발송 실패", error);
  }
}

function cleanPhone(phone: string) {
  return String(phone || "").replace(/[^0-9]/g, "");
}

function getFromNumber(branchName: string) {
  if (branchName === "철산점") return process.env.SOLAPI_FROM_CHULSAN;
  if (branchName === "목동점") return process.env.SOLAPI_FROM_MOKDONG;
  if (branchName === "개봉점") return process.env.SOLAPI_FROM_GAEBONG;
  if (branchName === "신정점") return process.env.SOLAPI_FROM_SINJEONG;

  return process.env.SOLAPI_FROM_CHULSAN;
}
