import { NextResponse } from "next/server";
import pool from "@/lib/db";

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

    const date = cleanDatetime.slice(0, 10);
    const time = cleanDatetime.slice(11, 16);

    await pool.query(
      `UPDATE naver_reservations SET status = ?, memo = ?
       WHERE phone = ? AND reservation_date = ? AND reservation_time = ?`,
      [status || "예약접수", truncMemo, phone || "", date, time]
    );

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