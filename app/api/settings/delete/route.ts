import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { option_id } = body;

    await pool.query(
      `
      UPDATE settings_options
      SET use_yn = 'N'
      WHERE option_id = ?
      `,
      [option_id]
    );

    return NextResponse.json({
      success: true,
      message: "설정 삭제 완료",
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: "설정 삭제 실패",
      error,
    });
  }
}