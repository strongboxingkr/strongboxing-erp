import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { event_id, memo, status, title, customer_name, phone, start_datetime } = body;

    if (!event_id) {
      return NextResponse.json({
        success: false,
        message: "예약 ID가 없습니다.",
      });
    }

    await pool.query(
      `UPDATE calendar_events
       SET memo = ?, status = COALESCE(?, status), title = COALESCE(?, title),
           customer_name = COALESCE(?, customer_name), phone = COALESCE(?, phone),
           start_datetime = COALESCE(?, start_datetime)
       WHERE event_id = ?`,
      [memo ?? "", status ?? null, title ?? null, customer_name ?? null, phone ?? null, start_datetime ?? null, event_id]
    );

    return NextResponse.json({
      success: true,
      message: "예약 정보가 수정되었습니다.",
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