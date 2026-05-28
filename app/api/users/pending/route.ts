import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET() {
  try {
    const [rows]: any = await pool.query(
      `
      SELECT *
      FROM users
      WHERE status = 'PENDING'
      ORDER BY requested_at DESC
      `
    );

    return NextResponse.json({
      success: true,
      rows,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json({
      success: false,
      message: "대기 회원 조회 실패",
      error,
    });
  }
}