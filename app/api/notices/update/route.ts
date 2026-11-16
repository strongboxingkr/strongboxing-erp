import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest, isAdminOrOwner } from "@/lib/auth";

export async function PATCH(req: Request) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ success: false, message: "로그인이 필요합니다." }, { status: 401 });

    if (!isAdminOrOwner(user.role)) {
      return NextResponse.json({ success: false, message: "공지 수정 권한이 없습니다." });
    }

    const body = await req.json();
    const { notice_id, title, content, branch_name, status, start_date, end_date, is_important } = body;

    if (!notice_id) return NextResponse.json({ success: false, message: "notice_id 필요" });

    await pool.query(
      `UPDATE notices SET
        title = ?, content = ?, branch_name = ?,
        status = ?, start_date = ?, end_date = ?, is_important = ?
       WHERE notice_id = ?`,
      [
        title,
        content || "",
        branch_name || "전체",
        status || "PUBLISHED",
        start_date || null,
        end_date || null,
        is_important ? 1 : 0,
        notice_id,
      ]
    );

    return NextResponse.json({ success: true, message: "공지 수정 완료" });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: "공지 수정 실패", error: error?.message });
  }
}
