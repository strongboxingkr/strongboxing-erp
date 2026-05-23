import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const member_id = searchParams.get("member_id");

    const [rows]: any = await pool.query(
      `
      SELECT *
      FROM member_notes
      WHERE member_id = ?
      ORDER BY note_id DESC
      `,
      [member_id]
    );

    return NextResponse.json({
      success: true,
      rows,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: "상담기록 조회 실패",
      error,
    });
  }
}