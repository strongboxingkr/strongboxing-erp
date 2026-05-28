import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function PUT(req: Request, context: any) {
  try {
    const reservationId = context.params.id;
    const body = await req.json();

    const { status, memo, is_read } = body;

    await pool.query(
      `
      UPDATE naver_reservations
      SET
        status = COALESCE(?, status),
        memo = COALESCE(?, memo),
        is_read = COALESCE(?, is_read)
      WHERE reservation_id = ?
      `,
      [
        status || null,
        memo || null,
        is_read || null,
        reservationId,
      ]
    );

    return NextResponse.json({
      success: true,
      message: "예약 정보가 수정되었습니다.",
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: "예약 수정 실패",
      error,
    });
  }
}

export async function DELETE(req: Request, context: any) {
  try {
    const reservationId = context.params.id;

    await pool.query(
      `
      DELETE FROM naver_reservations
      WHERE reservation_id = ?
      `,
      [reservationId]
    );

    return NextResponse.json({
      success: true,
      message: "예약이 삭제되었습니다.",
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: "예약 삭제 실패",
      error,
    });
  }
}