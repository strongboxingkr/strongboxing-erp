import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { template_id } = body;

    await pool.query(
      `
      UPDATE kakao_templates
      SET use_yn = 'N'
      WHERE template_id = ?
      `,
      [template_id]
    );

    return NextResponse.json({
      success: true,
      message: "템플릿 삭제 완료",
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: "템플릿 삭제 실패",
      error,
    });
  }
}