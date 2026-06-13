import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { event_id, memo } = body;

    if (!event_id) {
      return NextResponse.json({
        success: false,
        message: "예약 ID가 없습니다.",
      });
    }

    await pool.query(
      `
      UPDATE calendar_events
      SET memo = ?
      WHERE event_id = ?
      `,
      [memo || "", event_id]
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