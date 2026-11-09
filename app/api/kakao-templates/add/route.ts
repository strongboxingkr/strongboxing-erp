import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest, isAdminOrOwner } from "@/lib/auth";

export async function POST(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminOrOwner(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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