import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest, isAdminOrOwner } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ success: false, message: "로그인이 필요합니다." }, { status: 401 });
    if (!isAdminOrOwner(user.role)) {
      return NextResponse.json({ success: false, message: "대표/관리자만 설정을 수정할 수 있습니다." }, { status: 403 });
    }

    const { option_id, option_value, option_name, duration_months, count_value, sort_order, amount } = await req.json();
    if (!option_id) return NextResponse.json({ success: false, message: "option_id 없음" });

    await pool.query(
      `UPDATE settings_options
       SET option_value = COALESCE(?, option_value),
           option_name  = COALESCE(?, option_name),
           duration_months = COALESCE(?, duration_months),
           count_value  = COALESCE(?, count_value),
           sort_order   = COALESCE(?, sort_order),
           amount       = COALESCE(?, amount)
       WHERE option_id = ?`,
      [option_value ?? null, option_name ?? null, duration_months ?? null, count_value ?? null, sort_order ?? null, amount ?? null, option_id]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error });
  }
}
