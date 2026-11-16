import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest, isAdminOrOwner } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const user = await getUserFromRequest(req);

    if (!user) return NextResponse.json({ success: false, message: "로그인이 필요합니다." }, { status: 401 });


    if (!isAdminOrOwner(user.role)) {
      return NextResponse.json({
        success: false,
        message: "공지 등록 권한이 없습니다.",
      });
    }

    const body = await req.json();

    const { branch_name, title, content, status, start_date, end_date, is_important } = body;

    await pool.query(
      `INSERT INTO notices
        (branch_name, title, content, status, start_date, end_date, is_important, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        branch_name || "전체",
        title,
        content || "",
        status || "PUBLISHED",
        start_date || null,
        end_date || null,
        is_important ? 1 : 0,
        user.login_id || "",
      ]
    );

    return NextResponse.json({
      success: true,
      message: "공지 등록 완료",
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: "공지 등록 실패",
      error: error?.message,
    });
  }
}