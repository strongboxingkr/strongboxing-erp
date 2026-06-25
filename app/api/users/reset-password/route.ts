import { NextResponse } from "next/server";
import pool from "@/lib/db";
import bcrypt from "bcryptjs";
import { getUserFromRequest, isAdminOrOwner } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const user = await getUserFromRequest(req as any);
    if (!user || !isAdminOrOwner(user.role)) {
      return NextResponse.json({ success: false, message: "권한 없음" });
    }

    const { user_id, new_password } = await req.json();
    if (!user_id || !new_password) {
      return NextResponse.json({ success: false, message: "필수값 누락" });
    }

    const hashed = await bcrypt.hash(new_password, 10);
    await pool.query(`UPDATE users SET password_hash = ? WHERE user_id = ?`, [hashed, user_id]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, message: "비밀번호 변경 실패", error });
  }
}
