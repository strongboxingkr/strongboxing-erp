import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { reservation_id, status, memo } = body;

    await pool.query(
      `
      UPDATE naver_reservations
      SET
        status = ?,
        memo = ?
      WHERE reservation_id = ?
      `,
      [status, memo || "", reservation_id]
    );

    return NextResponse.json({
      success: true,
      message: "예약 상태 수정 완료",
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: "예약 상태 수정 실패",
      error,
    });
  }
}