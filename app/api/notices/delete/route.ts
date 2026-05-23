import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest, isAdminOrOwner } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const user = getUserFromRequest(req);

    if (!isAdminOrOwner(user.role)) {
      return NextResponse.json({
        success: false,
        message: "공지 삭제 권한이 없습니다.",
      });
    }

    const body = await req.json();
    const { notice_id } = body;

    await pool.query(
      `
      UPDATE notices
      SET use_yn = 'N'
      WHERE notice_id = ?
      `,
      [notice_id]
    );

    return NextResponse.json({
      success: true,
      message: "공지 삭제 완료",
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: "공지 삭제 실패",
      error,
    });
  }
}