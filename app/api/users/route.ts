import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET() {
  try {
    const [rows]: any = await pool.query(`
      SELECT
        user_id,
        login_id,
        name,
        role,
        branch_name,
        use_yn,
        created_at
      FROM users
      ORDER BY user_id DESC
    `);

    return NextResponse.json({
      success: true,
      rows,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: "계정 목록 조회 실패",
      error,
    });
  }
}