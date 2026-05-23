import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest, isAdminOrOwner } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const user = getUserFromRequest(req);
    const { searchParams } = new URL(req.url);

    const branch_name = searchParams.get("branch_name");

    let sql = `
      SELECT *
      FROM lessons
      WHERE 1=1
    `;

    const params: any[] = [];

    if (isAdminOrOwner(user.role)) {
      if (branch_name) {
        sql += ` AND branch_name = ? `;
        params.push(branch_name);
      }
    } else {
      sql += ` AND branch_name = ? `;
      params.push(user.branch_name);
    }

    sql += ` ORDER BY lesson_date ASC, lesson_time ASC `;

    const [rows]: any = await pool.query(sql, params);

    return NextResponse.json({
      success: true,
      rows,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: "수업 조회 실패",
      error,
    });
  }
}