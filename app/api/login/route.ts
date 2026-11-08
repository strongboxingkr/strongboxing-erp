import { NextResponse } from "next/server";
import pool from "@/lib/db";
import bcrypt from "bcryptjs";
import { createErpSession, sessionCookie } from "@/lib/erp-session";

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

    // bcrypt 해시 또는 평문 비밀번호 둘 다 지원
    const isHashed = user.password_hash?.startsWith("$2");
    const match = isHashed
      ? await bcrypt.compare(password, user.password_hash)
      : password === user.password_hash;

    if (!match) {
      return NextResponse.json({ success: false, message: "비밀번호 불일치" });
    }

    // 평문이면 bcrypt로 업그레이드
    if (!isHashed) {
      const hashed = await bcrypt.hash(password, 10);
      await pool.query(`UPDATE users SET password_hash = ? WHERE user_id = ?`, [hashed, user.user_id]);
    }

    const res = NextResponse.json({
      success: true,
      user: {
        user_id: user.user_id,
        login_id: user.login_id,
        name: user.name,
        role: user.role,
        branch_name: user.branch_name,
      },
    });
    // 서버 세션 쿠키 (새 관리 API 전용). erp_sessions 테이블이 없으면 기존 로그인만 동작
    try {
      res.headers.append("Set-Cookie", sessionCookie(await createErpSession(user.user_id)));
    } catch (e: any) {
      if (e?.code !== "ER_NO_SUCH_TABLE") console.error("[login] 세션 발급 실패", e);
    }
    return res;
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, message: "로그인 실패", error });
  }
}
