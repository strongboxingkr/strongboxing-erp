import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { template_code, template_name, message } = body;

    await pool.query(
      `
      INSERT INTO kakao_templates
      (template_code, template_name, message)
      VALUES (?, ?, ?)
      `,
      [template_code, template_name, message]
    );

    return NextResponse.json({
      success: true,
      message: "템플릿 추가 완료",
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: "템플릿 추가 실패",
      error,
    });
  }
}