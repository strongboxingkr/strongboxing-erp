import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { login_id, password, branch_name } = body;

    const [rows]: any = await pool.query(
      `
      SELECT user_id, login_id, password_hash, name, role,
             branch_name, allowed_branches, use_yn
      FROM users
      WHERE login_id = ?
      LIMIT 1
      `,
      [login_id]
    );

    if (rows.length === 0) {
      return NextResponse.json({ success: false, message: "아이디 없음" });
    }

    const user = rows[0];

    if (user.use_yn !== "Y") {
      return NextResponse.json({ success: false, message: "사용 중지 계정" });
    }

    if (user.password_hash !== password) {
      return NextResponse.json({ success: false, message: "비밀번호 불일치" });
    }

    let finalBranch = branch_name;

    if (!finalBranch) {
      return NextResponse.json({
        success: false,
        message: "지점을 선택해주세요.",
      });
    }

    if (user.role !== "ADMIN" && user.role !== "OWNER") {
      const allowed = (user.allowed_branches || "")
        .split(",")
        .map((v: string) => v.trim());

      if (!allowed.includes(finalBranch)) {
        return NextResponse.json({
          success: false,
          message: "접속 권한이 없는 지점입니다.",
        });
      }
    }

    return NextResponse.json({
      success: true,
      user: {
        user_id: user.user_id,
        login_id: user.login_id,
        name: user.name,
        role: user.role,
        branch_name: finalBranch,
      },
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: "로그인 실패",
      error,
    });
  }
}