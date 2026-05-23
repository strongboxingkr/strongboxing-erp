import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { lesson_id, status, memo } = body;

    await pool.query(
      `
      UPDATE lessons
      SET status = ?, memo = ?
      WHERE lesson_id = ?
      `,
      [status, memo || "", lesson_id]
    );

    return NextResponse.json({
      success: true,
      message: "수업 수정 완료",
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: "수업 수정 실패",
      error,
    });
  }
}