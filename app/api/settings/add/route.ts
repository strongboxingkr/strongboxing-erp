import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      option_type,
      option_name,
      option_value,
      sort_order,
      amount,
      duration_months,
      count_value,
    } = body;

    await pool.query(
      `
      INSERT INTO settings_options
      (
        option_type,
        option_name,
        option_value,
        sort_order,
        amount,
        duration_months,
        count_value,
        use_yn
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 'Y')
      `,
      [
        option_type,
        option_name,
        option_value || option_name,
        sort_order || 0,
        amount || 0,
        duration_months || 0,
        count_value || 0,
      ]
    );

    return NextResponse.json({
      success: true,
      message: "설정 추가 완료",
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: "설정 추가 실패",
      error,
    });
  }
}