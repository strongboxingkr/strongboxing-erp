import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const memberId =
      req.nextUrl.searchParams.get("member_id");

    if (!memberId) {
      return NextResponse.json({
        success: false,
        message: "member_id 필요",
      });
    }

    const [rows]: any = await pool.query(
      `
      SELECT *
      FROM member_histories
      WHERE member_id = ?
      ORDER BY created_at DESC
      `,
      [memberId]
    );

    return NextResponse.json({
      success: true,
      rows,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json({
      success: false,
      message: "이력 조회 실패",
    });
  }
}