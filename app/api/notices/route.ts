import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest, isAdminOrOwner } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const user = getUserFromRequest(req);

    let sql = `
      SELECT *
      FROM notices
      WHERE use_yn = 'Y'
    `;

    const params: any[] = [];

    if (!isAdminOrOwner(user.role)) {
      sql += ` AND (branch_name = '전체' OR branch_name = ?) `;
      params.push(user.branch_name);
    }

    sql += ` ORDER BY notice_id DESC `;

    const [rows]: any = await pool.query(sql, params);

    return NextResponse.json({
      success: true,
      rows,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: "공지 조회 실패",
      error,
    });
  }
}