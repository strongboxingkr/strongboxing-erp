import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { SolapiMessageService } from "solapi";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { phone_last4, checkin_code, branch_name, memo, check_type = "CHECK_IN", } = body;

    const code = checkin_code || phone_last4;

    if (!code || !/^\d{4}$/.test(code)) {
      return NextResponse.json({
        success: false,
        message: "출석번호 4자리를 입력해주세요.",
      });
    }

    let memberSql = `
      SELECT *
      FROM members
      WHERE checkin_code = ?
    `;

    const memberParams: any[] = [code];

    if (branch_name) {
      memberSql += ` AND branch_name = ? `;
      memberParams.push(branch_name);
    }

    memberSql += ` LIMIT 1 `;

    const [rows]: any = await pool.query(memberSql, memberParams);

    if (rows.length === 0) {
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
          null,
          branch_name || null,
          null,
          null,
          0,
          "NOT_FOUND",
          memo || "회원 없음",
        ]
      );

      return NextResponse.json({
        success: false,
        result: "NOT_FOUND",
        message: "회원 없음",
      });
    }

    const member = rows[0];

    if (check_type === "CHECK_OUT") {
    if (
      Number(member.checkout_sms_enabled || 0) === 1 &&
      member.emergency_contact
    ) {
      await sendCheckoutSms(member);
    }

    await pool.query(
      `
      INSERT INTO attendance
      (
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
        0,
        "CHECK_OUT",
        "퇴실",
      ]
    );

    return NextResponse.json({
      success: true,
      result: "CHECK_OUT",
      message: "퇴실 완료",
      member,
    });
  }

    const today = new Date();
    const todayText = today.toISOString().slice(0, 10);

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
      await saveAttendance(member, "REST", memo || "휴회중 회원");

      return NextResponse.json({
        success: false,
        result: "REST",
        message: "휴회중 회원",
      });
    }

    const endDate = member.end_date ? new Date(member.end_date) : null;

    today.setHours(0, 0, 0, 0);

    if (endDate) {
      endDate.setHours(0, 0, 0, 0);
    }

    if (member.status === "EXPIRED" || (endDate && endDate < today)) {
      await pool.query(
        `
        UPDATE members
        SET status = 'EXPIRED'
        WHERE member_id = ?
        `,
        [member.member_id]
      );

      await saveAttendance(member, "EXPIRED", memo || "만료된 회원");

      return NextResponse.json({
        success: false,
        result: "EXPIRED",
        message: "만료된 회원",
      });
    }

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

      await pool.query(
        `
        UPDATE members
        SET remaining_count = remaining_count - 1
        WHERE member_id = ?
        `,
        [member.member_id]
      );

      remainingCount = remainingCount - 1;
    }

    await saveAttendance(member, "SUCCESS", memo || "출석 완료");
    
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
          member.pass_type === "COUNT" ? remainingCount : "기간권",
        end_date: member.end_date,
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
${member.name} 회원님이 ${timeText} 퇴실했습니다.`;

    await messageService.send({
      to,
      from: cleanPhone(from),
      text,
    });
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
