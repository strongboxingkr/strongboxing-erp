import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest, isAdminOrOwner } from "@/lib/auth";

export async function GET(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminOrOwner(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const [rows]: any = await pool.query(
      `SELECT user_id, name, login_id, phone, branch_name, role, status, created_at
       FROM users
       WHERE status = 'PENDING'
       ORDER BY created_at DESC`
    );
    return NextResponse.json({ success: true, rows });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, message: "대기 회원 조회 실패", error });
  }
}
