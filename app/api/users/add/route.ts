import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function POST(req: Request) {
  try {
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
        password,
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