import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      event_id,
      customer_name,
      phone,
      start_datetime,
      event_type,
      status,
      memo,
    } = body;

    if (!event_id) {
      return NextResponse.json({
        success: false,
        message: "예약 ID가 없습니다.",
      });
    }

    const cleanDatetime = String(start_datetime || "").replace("T", " ").slice(0, 19);
    const truncMemo = String(memo || "").slice(0, 500);

    await pool.query(
      `UPDATE calendar_events
       SET customer_name = ?, phone = ?, start_datetime = ?, event_type = ?, status = ?, memo = ?
       WHERE event_id = ?`,
      [customer_name || "", phone || "", cleanDatetime, event_type || "예약", status || "예약접수", truncMemo, event_id]
    );

    // source_email_id로 naver_reservations 연동 (전화번호 + 상태 + 메모 반영)
    const [evRow]: any = await pool.query(
      `SELECT source_id FROM calendar_events WHERE event_id = ?`, [event_id]
    );
    if (evRow.length > 0 && evRow[0].source_id) {
      await pool.query(
        `UPDATE naver_reservations SET status = ?, memo = ?, phone = ? WHERE source_email_id = ?`,
        [status || "예약접수", truncMemo, phone || "", evRow[0].source_id]
      );
    }

    return NextResponse.json({
      success: true,
      message: "예약 상태가 수정되었습니다.",
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json({
      success: false,
      message: "예약 수정 실패",
      error,
    });
  }
}