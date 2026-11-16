import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest, isAdminOrOwner } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ success: false, message: "로그인이 필요합니다." }, { status: 401 });

    if (!isAdminOrOwner(user.role)) {
      return NextResponse.json({ success: false, message: "일정 등록 권한이 없습니다." });
    }

    const body = await req.json();
    const {
      branch_name, title, content, location, event_type,
      event_start, event_end, recruit_start, recruit_end,
      date_tbd, status,
    } = body;

    if (!title?.trim()) return NextResponse.json({ success: false, message: "제목을 입력하세요." });

    await pool.query(
      `INSERT INTO events
        (branch_name, title, content, location, event_type,
         event_start, event_end, recruit_start, recruit_end,
         date_tbd, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        branch_name || "전체",
        title,
        content || "",
        location || null,
        event_type || "ETC",
        event_start || null,
        event_end || null,
        recruit_start || null,
        recruit_end || null,
        date_tbd ? 1 : 0,
        status || "DRAFT",
        user.login_id || "",
      ]
    );

    return NextResponse.json({ success: true, message: "일정 등록 완료" });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: "일정 등록 실패", error: error?.message });
  }
}
