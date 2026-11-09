import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest, isAdminOrOwner } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let rows: any[];
    if (isAdminOrOwner(user.role)) {
      const [result]: any = await pool.query(`
        SELECT
          user_id,
          login_id,
          name,
          role,
          branch_name,
          use_yn,
          created_at
        FROM users
        ORDER BY user_id DESC
      `);
      rows = result;
    } else {
      const [result]: any = await pool.query(`
        SELECT
          user_id,
          login_id,
          name,
          role,
          branch_name,
          use_yn,
          created_at
        FROM users
        WHERE branch_name = ?
        ORDER BY user_id DESC
      `, [user.branch_name]);
      rows = result;
    }

    return NextResponse.json({ success: true, rows });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: "계정 목록 조회 실패",
      error,
    });
  }
}