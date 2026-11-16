import { NextResponse } from "next/server";
import { SolapiMessageService } from "solapi";
import pool from "@/lib/db";
import { getUserFromRequest, isAdminOrOwner, canAccessBranch } from "@/lib/auth";

const cleanPhone = (phone: string) => String(phone || "").replace(/[^0-9]/g, "");

const getFromNumber = (branchName: string) => {
  if (branchName === "철산점") return process.env.SOLAPI_FROM_CHULSAN;
  if (branchName === "목동점") return process.env.SOLAPI_FROM_MOKDONG;
  if (branchName === "개봉점") return process.env.SOLAPI_FROM_GAEBONG;
  if (branchName === "신정점") return process.env.SOLAPI_FROM_SINJEONG;
  return process.env.SOLAPI_FROM_CHULSAN;
};

// GET: 지점의 알림 수신 번호 조회 + 오늘 마지막 발송 로그
export async function GET(req: Request) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isAdminOrOwner(user.role))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const branch_name = searchParams.get("branch_name");
    const event_id = searchParams.get("event_id");

    if (!branch_name)
      return NextResponse.json({ success: false, message: "branch_name 필요" });

    // 알림 수신 번호 조회
    const [phoneRows]: any = await pool.query(
      `SELECT option_value FROM settings_options
       WHERE option_type = 'RESERVATION_ALERT_PHONE' AND option_name = ? AND use_yn = 'Y'
       LIMIT 1`,
      [branch_name]
    );
    const alertPhone = phoneRows[0]?.option_value || null;

    // 오늘 이 예약(event_id)에 대한 마지막 관장 알림 로그
    let lastLog = null;
    if (event_id) {
      const [logRows]: any = await pool.query(
        `SELECT sms_id, send_status, created_at, receiver_phone
         FROM sms_logs
         WHERE target_type = 'DIRECTOR_ALERT'
           AND branch_name = ?
           AND receiver_name LIKE ?
           AND DATE(created_at) = CURDATE()
         ORDER BY sms_id DESC LIMIT 1`,
        [branch_name, `%event:${event_id}%`]
      );
      lastLog = logRows[0] || null;
    }

    return NextResponse.json({ success: true, alertPhone, lastLog });
  } catch (error) {
    return NextResponse.json({ success: false, message: "조회 실패", error });
  }
}

// POST: 관장에게 예약 알림 문자 발송
export async function POST(req: Request) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isAdminOrOwner(user.role))
      return NextResponse.json({ error: "Forbidden: 대표·관리자만 발송 가능합니다.", code: "FORBIDDEN" }, { status: 403 });

    const body = await req.json();
    const { event_id, branch_name, customer_name, phone: customerPhone,
            start_datetime, purpose, source, status, message } = body;

    if (!branch_name || !event_id)
      return NextResponse.json({ success: false, message: "필수 파라미터 누락" });

    if (!canAccessBranch(user.role, user.branch_name, branch_name))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // 알림 수신 번호 조회
    const [phoneRows]: any = await pool.query(
      `SELECT option_value FROM settings_options
       WHERE option_type = 'RESERVATION_ALERT_PHONE' AND option_name = ? AND use_yn = 'Y'
       LIMIT 1`,
      [branch_name]
    );
    const alertPhone = phoneRows[0]?.option_value || null;

    if (!alertPhone) {
      return NextResponse.json({
        success: false,
        code: "NO_ALERT_PHONE",
        message: `${branch_name}의 예약 알림 수신 번호가 설정되지 않았습니다. 설정관리에서 추가해주세요.`,
      });
    }

    const toClean = cleanPhone(alertPhone);
    if (toClean.length < 10) {
      return NextResponse.json({
        success: false,
        code: "INVALID_PHONE",
        message: `수신 번호(${alertPhone})가 올바르지 않습니다.`,
      });
    }

    // 같은 event_id로 1시간 이내 중복 발송 체크
    const [dupRows]: any = await pool.query(
      `SELECT sms_id, created_at FROM sms_logs
       WHERE target_type = 'DIRECTOR_ALERT'
         AND branch_name = ?
         AND receiver_name LIKE ?
         AND created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
       LIMIT 1`,
      [branch_name, `%event:${event_id}%`]
    );
    const isDuplicate = dupRows.length > 0;

    // 중복이어도 클라이언트가 is_resend=true를 명시해야 발송 허용
    if (isDuplicate && !body.is_resend) {
      const prev = dupRows[0];
      return NextResponse.json({
        success: false,
        code: "DUPLICATE",
        message: "이미 발송된 알림입니다. 재발송하려면 확인 후 다시 시도하세요.",
        prev_sent_at: prev.created_at,
      });
    }

    // 발신번호 확인
    const from = cleanPhone(getFromNumber(branch_name) || "");
    if (!from) {
      return NextResponse.json({ success: false, message: "발신번호가 설정되지 않았습니다." });
    }

    const apiKey = process.env.SOLAPI_API_KEY;
    const apiSecret = process.env.SOLAPI_API_SECRET;
    if (!apiKey || !apiSecret) {
      return NextResponse.json({ success: false, message: "SMS API 키가 없습니다." });
    }

    // 문자 본문 (클라이언트가 최종본을 전달)
    const finalMessage = message?.trim();
    if (!finalMessage) {
      return NextResponse.json({ success: false, message: "문자 내용이 없습니다." });
    }

    let sendStatus = "FAILED";
    let errorMsg = "";
    try {
      const messageService = new SolapiMessageService(apiKey, apiSecret);
      await messageService.send([{ to: toClean, from, text: finalMessage }]);
      sendStatus = "SENT";
    } catch (e: any) {
      errorMsg = e?.message || "발송 실패";
      sendStatus = "FAILED";
    }

    // 로그 저장 (receiver_name에 event_id 인코딩으로 역추적 가능)
    const logReceiverName = `${customer_name || ""}|event:${event_id}`;
    await pool.query(
      `INSERT INTO sms_logs (branch_name, target_type, receiver_name, receiver_phone, message, send_status, provider)
       VALUES (?, 'DIRECTOR_ALERT', ?, ?, ?, ?, 'SOLAPI')`,
      [branch_name, logReceiverName, toClean, finalMessage, sendStatus]
    );

    if (sendStatus === "FAILED") {
      return NextResponse.json({ success: false, message: `발송 실패: ${errorMsg}` });
    }

    return NextResponse.json({
      success: true,
      is_resend: isDuplicate,
      message: isDuplicate ? "재발송 완료" : "관장 알림 발송 완료",
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: "서버 오류", error });
  }
}
