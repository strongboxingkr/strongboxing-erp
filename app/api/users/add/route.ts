import { NextResponse } from "next/server";
import pool from "@/lib/db";
import bcrypt from "bcryptjs";
import { getUserFromRequest, isAdminOrOwner } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isAdminOrOwner(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();

    const { login_id, password, name, role, branch_name } = body;

    if (!login_id || !password || !name || !role) {
      return NextResponse.json({
        success: false,
        message: "아이디, 비밀번호, 이름, 역할은 필수입니다.",
      });
    }

    const [dupRows]: any = await pool.query(
      "SELECT user_id FROM users WHERE login_id = ?",
      [login_id]
    );

    if (dupRows.length > 0) {
      return NextResponse.json({
        success: false,
        message: "이미 사용 중인 아이디입니다.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query(
      `
      INSERT INTO users
      (
        login_id,
        password_hash,
        name,
        role,
        branch_name,
        use_yn
      )
      VALUES (?, ?, ?, ?, ?, 'Y')
      `,
      [
        login_id,
        hashedPassword,
        name,
        role,
        branch_name || null,
      ]
    );

    return NextResponse.json({
      success: true,
      message: "계정 생성 완료",
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: "계정 생성 실패",
      error,
    });
  }
}