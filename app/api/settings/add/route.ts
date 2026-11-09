import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest, isAdminOrOwner } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ success: false, message: "로그인이 필요합니다." }, { status: 401 });
    if (!isAdminOrOwner(user.role)) {
      return NextResponse.json({ success: false, message: "대표/관리자만 설정을 추가할 수 있습니다." }, { status: 403 });
    }

    const body = await req.json();
    const { option_type, option_name, option_value, sort_order, amount, duration_months, count_value } = body;

    await pool.query(
      `INSERT INTO settings_options
       (option_type, option_name, option_value, sort_order, amount, duration_months, count_value, use_yn)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'Y')`,
      [option_type, option_name, option_value || option_name, sort_order || 0, amount || 0, duration_months || 0, count_value || 0]
    );

    return NextResponse.json({ success: true, message: "설정 추가 완료" });
  } catch (error) {
    return NextResponse.json({ success: false, message: "설정 추가 실패", error });
  }
}
