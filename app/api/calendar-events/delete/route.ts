import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { event_id } = body;

    if (!event_id) {
      return NextResponse.json({
        success: false,
        message: "예약 ID가 없습니다.",
      });
    }

    await pool.query(
      `
      DELETE FROM calendar_events
      WHERE event_id = ?
      `,
      [event_id]
    );

    return NextResponse.json({
      success: true,
      message: "예약이 삭제되었습니다.",
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json({
      success: false,
      message: "예약 삭제 실패",
      error,
    });
  }
}