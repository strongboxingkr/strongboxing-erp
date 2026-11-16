import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest, isAdminOrOwner } from "@/lib/auth";

export async function PATCH(req: Request) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ success: false, message: "로그인이 필요합니다." }, { status: 401 });

    if (!isAdminOrOwner(user.role)) {
      return NextResponse.json({ success: false, message: "일정 수정 권한이 없습니다." });
    }

    const body = await req.json();
    const {
      event_id, branch_name, title, content, location, event_type,
      event_start, event_end, recruit_start, recruit_end,
      date_tbd, status,
    } = body;

    if (!event_id) return NextResponse.json({ success: false, message: "event_id 필요" });

    await pool.query(
      `UPDATE events SET
        branch_name = ?, title = ?, content = ?, location = ?, event_type = ?,
        event_start = ?, event_end = ?, recruit_start = ?, recruit_end = ?,
        date_tbd = ?, status = ?
       WHERE event_id = ?`,
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
        event_id,
      ]
    );

    return NextResponse.json({ success: true, message: "일정 수정 완료" });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: "일정 수정 실패", error: error?.message });
  }
}
