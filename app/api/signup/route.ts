import { NextResponse } from "next/server";
import pool from "@/lib/db";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      name,
      username,
      password,
      role,
      phone,
      requested_branch,
      request_memo,
    } = body;

    if (!name || !username || !password) {
      return NextResponse.json({
        success: false,
        message: "필수값 누락",
      });
    }

    const [exists]: any = await pool.query(
      `
      SELECT user_id
      FROM users
      WHERE username = ?
      LIMIT 1
      `,
      [username]
    );

    if (exists.length > 0) {
      return NextResponse.json({
        success: false,
        message: "이미 존재하는 아이디입니다.",
      });
    }

    const hashed = await bcrypt.hash(password, 10);

    await pool.query(
      `
      INSERT INTO users
      (
        name,
        username,
        password,
        role,
        phone,
        requested_branch,
        request_memo,
        status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING')
      `,
      [
        name,
        username,
        hashed,
        role || "MANAGER",
        phone || "",
        requested_branch || "",
        request_memo || "",
      ]
    );

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json({
      success: false,
      message: "회원가입 실패",
      error,
    });
  }
}