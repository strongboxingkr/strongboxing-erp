import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest, isAdminOrOwner } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ success: false, message: "로그인이 필요합니다." }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const branch_name = searchParams.get("branch_name");
    const status = searchParams.get("status");
    const upcoming = searchParams.get("upcoming");

    let sql = `SELECT * FROM events WHERE use_yn = 'Y'`;
    const params: any[] = [];

    if (!isAdminOrOwner(user.role)) {
      sql += ` AND (branch_name = '전체' OR branch_name = ?)`;
      params.push(user.branch_name);
    } else if (branch_name) {
      sql += ` AND (branch_name = '전체' OR branch_name = ?)`;
      params.push(branch_name);
    }

    if (status) {
      sql += ` AND status = ?`;
      params.push(status);
    }

    if (upcoming === "1") {
      sql += ` AND (date_tbd = 1 OR event_end IS NULL OR event_end >= CURDATE())`;
    }

    sql += ` ORDER BY
      CASE WHEN status = 'PUBLISHED' THEN 0 ELSE 1 END,
      CASE WHEN date_tbd = 1 THEN 1 ELSE 0 END,
      event_start ASC,
      event_id DESC`;

    const [rows]: any = await pool.query(sql, params);
    return NextResponse.json({ success: true, rows });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: "일정 조회 실패", error: error?.message });
  }
}
