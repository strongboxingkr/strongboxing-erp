import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest, isAdminOrOwner } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const user = getUserFromRequest(req);

    if (!isAdminOrOwner(user.role)) {
      return NextResponse.json({
        success: false,
        message: "공지 등록 권한이 없습니다.",
      });
    }

    const body = await req.json();

    const { branch_name, title, content } = body;

    await pool.query(
      `
      INSERT INTO notices
      (branch_name, title, content, created_by)
      VALUES (?, ?, ?, ?)
      `,
      [
        branch_name || "전체",
        title,
        content || "",
        user.login_id || "",
      ]
    );

    return NextResponse.json({
      success: true,
      message: "공지 등록 완료",
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: "공지 등록 실패",
      error,
    });
  }
}