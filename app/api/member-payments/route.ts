import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const member_id = searchParams.get("member_id");

    if (!member_id) {
      return NextResponse.json({
        success: false,
        message: "member_id가 필요합니다.",
      });
    }

    const [rows]: any = await pool.query(
      `
      SELECT *
      FROM payments
      WHERE member_id = ?
      ORDER BY payment_date DESC, payment_id DESC
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
      message: "결제 히스토리 조회 실패",
      error,
    });
  }
}