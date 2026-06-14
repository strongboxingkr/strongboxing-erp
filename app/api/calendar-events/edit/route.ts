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

    await pool.query(
      `
      UPDATE calendar_events
      SET
        customer_name = ?,
        phone = ?,
        start_datetime = ?,
        event_type = ?,
        status = ?,
        memo = ?
      WHERE event_id = ?
      `,
      [
        customer_name,
        phone,
        start_datetime,
        event_type,
        status,
        memo,
        event_id,
      ]
    );

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json({
      success: false,
      message: "예약 수정 실패",
    });
  }
}