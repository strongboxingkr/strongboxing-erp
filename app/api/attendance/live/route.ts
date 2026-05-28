import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest, isAdminOrOwner } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const user = getUserFromRequest(req);
    const { searchParams } = new URL(req.url);

    const branch_name = searchParams.get("branch_name");

    let branchCondition = "";
    const params: any[] = [];

    if (isAdminOrOwner(user.role)) {
      if (branch_name && branch_name !== "전체") {
        branchCondition = " AND COALESCE(a.branch_name, m.branch_name) = ? ";
        params.push(branch_name);
      }
    } else {
      branchCondition = " AND COALESCE(a.branch_name, m.branch_name) = ? ";
      params.push(user.branch_name);
    }

    const [todayRows]: any = await pool.query(
      `
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
        m.pass_type,
        m.remaining_count,
        m.end_date
      FROM attendance a
      JOIN members m ON a.member_id = m.member_id
      WHERE DATE(a.checkin_time) = CURDATE()
        AND a.result = 'SUCCESS'
        ${branchCondition}
      ORDER BY a.checkin_time DESC
      `,
      params
    );

    const [branchRows]: any = await pool.query(
      `
      SELECT
        COALESCE(a.branch_name, m.branch_name) AS branch_name,
        COUNT(*) AS count
      FROM attendance a
      JOIN members m ON a.member_id = m.member_id
      WHERE DATE(a.checkin_time) = CURDATE()
        AND a.result = 'SUCCESS'
        ${branchCondition}
      GROUP BY COALESCE(a.branch_name, m.branch_name)
      ORDER BY count DESC
      `,
      params
    );

    return NextResponse.json({
      success: true,
      total: todayRows.length,
      rows: todayRows,
      branches: branchRows,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json({
      success: false,
      message: "실시간 출석 조회 실패",
      error,
    });
  }
}