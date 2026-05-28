import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest, isAdminOrOwner } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const user = getUserFromRequest(req);
    const { searchParams } = new URL(req.url);

    const branch_name = searchParams.get("branch_name");
    const today_only = searchParams.get("today_only") || "Y";
    const limit = Number(searchParams.get("limit") || 10);

    let sql = `
      SELECT 
        a.attendance_id,
        a.member_id,
        COALESCE(a.member_name, m.name) AS name,
        COALESCE(a.branch_name, m.branch_name) AS branch_name,
        a.pass_type AS attendance_pass_type,
        a.used_count,
        a.checkin_time,
        a.result,
        a.memo,
        m.phone,
        m.product_name,
        m.remaining_count,
        m.end_date,
        m.status
      FROM attendance a
      LEFT JOIN members m ON a.member_id = m.member_id
      WHERE 1=1
    `;

    const params: any[] = [];

    if (today_only === "Y") {
      sql += ` AND DATE(a.checkin_time) = CURDATE() `;
    }

    if (isAdminOrOwner(user.role)) {
      if (branch_name && branch_name !== "전체") {
        sql += ` AND COALESCE(a.branch_name, m.branch_name) = ? `;
        params.push(branch_name);
      }
    } else {
      if (!user.branch_name) {
        return NextResponse.json({
          success: false,
          message: "지점 정보가 없습니다.",
        });
      }

      sql += ` AND COALESCE(a.branch_name, m.branch_name) = ? `;
      params.push(user.branch_name);
    }

    sql += `
      ORDER BY a.attendance_id DESC
      LIMIT ?
    `;

    params.push(limit);

    const [rows]: any = await pool.query(sql, params);

    return NextResponse.json({
      success: true,
      rows,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: "최근 출석 조회 실패",
      error,
    });
  }
}