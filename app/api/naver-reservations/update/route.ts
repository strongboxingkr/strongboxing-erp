import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { SolapiMessageService } from "solapi";
import { getUserFromRequest, canAccessBranch } from "@/lib/auth";

const cleanPhone = (phone: string) => {
  return String(phone || "").replace(/[^0-9]/g, "");
};

const getFromNumber = (branchName: string) => {
  if (branchName === "철산점") return process.env.SOLAPI_FROM_CHULSAN;
  if (branchName === "목동점") return process.env.SOLAPI_FROM_MOKDONG;
  if (branchName === "개봉점") return process.env.SOLAPI_FROM_GAEBONG;
  if (branchName === "신정점") return process.env.SOLAPI_FROM_SINJEONG;

  return process.env.SOLAPI_FROM_CHULSAN;
};

const makeConfirmMessage = (reservation: any) => {
  const date =
    typeof reservation.reservation_date === "string"
      ? reservation.reservation_date.slice(0, 10)
      : reservation.reservation_date?.toISOString?.().slice(0, 10) || "";

  return `[스트롱복싱 ${reservation.branch_name}]

${reservation.customer_name}님 예약이 확정되었습니다.

방문일시 : ${date} ${reservation.reservation_time}
예약내용 : ${reservation.reservation_product || "방문 상담"}

편한 복장과 실내 운동화를 지참 후 방문 부탁드립니다.
처음 방문이신 경우 예약시간 5~10분 전 도착 부탁드립니다.

감사합니다.
스트롱복싱 ${reservation.branch_name}`;
};

export async function POST(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    const { reservation_id, status, memo, sms_message, phone } = body;

    const [beforeRows]: any = await pool.query(
      `
      SELECT *
      FROM naver_reservations
      WHERE reservation_id = ?
      LIMIT 1
      `,
      [reservation_id]
    );

    if (beforeRows.length === 0) {
      return NextResponse.json({
        success: false,
        message: "예약 정보를 찾을 수 없습니다.",
      });
    }

    const before = beforeRows[0];

    if (!canAccessBranch(user.role, user.branch_name, before.branch_name)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let safeBranchName = before.branch_name;

    if (String(safeBranchName).includes("MOKDONG")) safeBranchName = "목동점";
    if (String(safeBranchName).includes("CHULSAN")) safeBranchName = "철산점";
    if (String(safeBranchName).includes("GAEBONG")) safeBranchName = "개봉점";
    if (String(safeBranchName).includes("SINJEONG")) safeBranchName = "신정점";

    if (phone !== undefined) {
      await pool.query(
        `UPDATE naver_reservations SET phone = ? WHERE reservation_id = ?`,
        [cleanPhone(phone), reservation_id]
      );
    }

    await pool.query(
      `
      UPDATE naver_reservations
      SET
        status = ?,
        memo = ?
      WHERE reservation_id = ?
      `,
      [status, memo || before.memo || "", reservation_id]
    );

    const reservationNoMatch = String(before.memo || "").match(/예약번호:([^\n]+)/);
    const reservationNo = reservationNoMatch?.[1]?.trim() || "";

    await pool.query(
      `
      UPDATE calendar_events
      SET status = ?
      WHERE source_id = ?
        OR (
              customer_name = ?
          AND phone = ?
          AND DATE(start_datetime) = ?
          AND TIME_FORMAT(start_datetime, '%H:%i') = ?
        )
      `,
      [
        status,
        reservationNo || String(reservation_id),
        before.customer_name,
        before.phone,
        before.reservation_date,
        before.reservation_time,
      ]
    );

    let smsSent = false;
    let smsError: string | null = null;

    // sms_message가 명시적으로 전달된 경우에만 발송 (출처 무관, 중복 방지 포함)
    if (sms_message && status === "예약확정") {
      const to = cleanPhone(phone || before.phone || "");

      if (to.length < 10) {
        smsError = "수신번호가 올바르지 않습니다.";
      } else {
        const apiKey = process.env.SOLAPI_API_KEY;
        const apiSecret = process.env.SOLAPI_API_SECRET;
        const from = cleanPhone(getFromNumber(safeBranchName) || "");

        if (!apiKey || !apiSecret || !from) {
          smsError = "발송 설정이 없습니다. 관리자에게 문의하세요.";
        } else {
          try {
            const messageService = new SolapiMessageService(apiKey, apiSecret);
            await messageService.send([{ to, from, text: sms_message }]);
            await pool.query(
              `INSERT INTO sms_logs (branch_name, target_type, receiver_name, receiver_phone, message, send_status, provider)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [safeBranchName, "RESERVATION_CONFIRM", before.customer_name || "", to, sms_message, "SENT", "SOLAPI"]
            );
            smsSent = true;
          } catch (smsErr: any) {
            smsError = smsErr?.message || "문자 발송 실패";
            await pool.query(
              `INSERT INTO sms_logs (branch_name, target_type, receiver_name, receiver_phone, message, send_status, provider)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [safeBranchName, "RESERVATION_CONFIRM", before.customer_name || "", to, sms_message, "FAILED", "SOLAPI"]
            );
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: smsSent
        ? "예약 상태 수정 및 안내문자 발송 완료"
        : smsError
          ? `예약 확정 완료 (문자 발송 실패: ${smsError})`
          : "예약 상태 수정 완료",
      sms_sent: smsSent,
      sms_error: smsError,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json({
      success: false,
      message: "예약 상태 수정 실패",
      error,
    });
  }
}