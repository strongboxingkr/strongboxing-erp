import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { user_id } = body;

    if (!user_id) {
      return NextResponse.json({
        success: false,
        message: "user_id 없음",
      });
    }

    const [rows]: any = await pool.query(
      `
      SELECT *
      FROM users
      WHERE user_id = ?
      LIMIT 1
      `,
      [user_id]
    );

    if (rows.length === 0) {
      return NextResponse.json({
        success: false,
        message: "사용자 없음",
      });
    }

    const user = rows[0];

    await pool.query(
      `
      UPDATE users
      SET
        status = 'APPROVED',
        branch_name = requested_branch
      WHERE user_id = ?
      `,
      [user_id]
    );

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json({
      success: false,
      message: "승인 실패",
      error,
    });
  }
}