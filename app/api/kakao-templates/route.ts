import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";

export async function GET(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const [rows]: any = await pool.query(`
      SELECT *
      FROM kakao_templates
      WHERE use_yn = 'Y'
      ORDER BY template_id DESC
    `);

    return NextResponse.json({
      success: true,
      rows,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: "템플릿 조회 실패",
      error,
    });
  }
}