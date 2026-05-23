import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET() {
  try {
    const [rows]: any = await pool.query(`
      SELECT *
      FROM sms_logs
      ORDER BY sms_id DESC
      LIMIT 200
    `);

    return NextResponse.json({
      success: true,
      rows,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: "문자 이력 조회 실패",
      error,
    });
  }
}