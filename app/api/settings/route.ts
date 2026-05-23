import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const option_type = searchParams.get("option_type");

    let sql = `
      SELECT *
      FROM settings_options
      WHERE use_yn = 'Y'
    `;

    const params: any[] = [];

    if (option_type) {
      sql += ` AND option_type = ? `;
      params.push(option_type);
    }

    sql += ` ORDER BY option_type, sort_order, option_id `;

    const [rows]: any = await pool.query(sql, params);

    return NextResponse.json({
      success: true,
      rows,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: "설정 조회 실패",
      error,
    });
  }
}