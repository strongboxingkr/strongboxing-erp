import { NextResponse } from "next/server";
import pool from "@/lib/db";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { login_id, password } = body;

    const [rows]: any = await pool.query(
      `SELECT user_id, login_id, password_hash, name, role, branch_name, use_yn, status
       FROM users WHERE login_id = ? LIMIT 1`,
      [login_id]
    );

    if (rows.length === 0) {
      return NextResponse.json({ success: false, message: "아이디 없음" });
    }

    const user = rows[0];

    if (user.use_yn !== "Y") {
      return NextResponse.json({ success: false, message: "사용 중지 계정" });
    }

    if (user.status && user.status !== "APPROVED") {
      return NextResponse.json({ success: false, message: "승인되지 않은 계정입니다." });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return NextResponse.json({ success: false, message: "비밀번호 불일치" });
    }

    return NextResponse.json({
      success: true,
      user: {
        user_id: user.user_id,
        login_id: user.login_id,
        name: user.name,
        role: user.role,
        branch_name: user.branch_name,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, message: "로그인 실패", error });
  }
}
