import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest, isAdminOrOwner } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ success: false, message: "로그인이 필요합니다." }, { status: 401 });

    if (!isAdminOrOwner(user.role)) {
      return NextResponse.json({ success: false, message: "일정 삭제 권한이 없습니다." });
    }

    const { event_id } = await req.json();
    if (!event_id) return NextResponse.json({ success: false, message: "event_id 필요" });

    await pool.query(`UPDATE events SET use_yn = 'N' WHERE event_id = ?`, [event_id]);
    return NextResponse.json({ success: true, message: "일정 삭제 완료" });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: "일정 삭제 실패", error: error?.message });
  }
}
