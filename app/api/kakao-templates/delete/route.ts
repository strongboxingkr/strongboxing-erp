import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest, isAdminOrOwner } from "@/lib/auth";

export async function POST(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminOrOwner(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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