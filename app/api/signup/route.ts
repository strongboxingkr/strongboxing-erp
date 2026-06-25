import { NextResponse } from "next/server";
import pool from "@/lib/db";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { name, username, password, role, phone, requested_branch, request_memo } = body;

    if (!name || !username || !password) {
      return NextResponse.json({ success: false, message: "필수값 누락" });
    }

    const [exists]: any = await pool.query(
      `SELECT user_id FROM users WHERE login_id = ? LIMIT 1`,
      [username]
    );
    if (exists.length > 0) {
      return NextResponse.json({ success: false, message: "이미 존재하는 아이디입니다." });
    }

    if (name && phone) {
      const [dupCheck]: any = await pool.query(
        `SELECT user_id FROM users WHERE name = ? AND phone = ? LIMIT 1`,
        [name, phone]
      );
      if (dupCheck.length > 0) {
        return NextResponse.json({ success: false, message: "동일한 이름과 전화번호로 이미 가입된 계정이 있습니다." });
      }
    }

    const hashed = await bcrypt.hash(password, 10);

    await pool.query(
      `INSERT INTO users (name, login_id, password_hash, role, phone, branch_name, status, use_yn)
       VALUES (?, ?, ?, ?, ?, ?, 'PENDING', 'Y')`,
      [
        name,
        username,
        hashed,
        role || "COACH",
        phone || "",
        requested_branch || "",
      ]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, message: "회원가입 실패", error });
  }
}
