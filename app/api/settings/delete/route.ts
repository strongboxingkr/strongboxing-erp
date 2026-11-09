import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest, isAdminOrOwner } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ success: false, message: "로그인이 필요합니다." }, { status: 401 });
    if (!isAdminOrOwner(user.role)) {
      return NextResponse.json({ success: false, message: "대표/관리자만 설정을 삭제할 수 있습니다." }, { status: 403 });
    }

    const body = await req.json();
    const { option_id } = body;

    await pool.query(
      `UPDATE settings_options SET use_yn = 'N' WHERE option_id = ?`,
      [option_id]
    );

    return NextResponse.json({ success: true, message: "설정 삭제 완료" });
  } catch (error) {
    return NextResponse.json({ success: false, message: "설정 삭제 실패", error });
  }
}
