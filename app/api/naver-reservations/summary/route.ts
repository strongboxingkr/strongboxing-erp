import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest, isAdminOrOwner } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const user = getUserFromRequest(req);
    const { searchParams } = new URL(req.url);

    const branch_name = searchParams.get("branch_name");
    const month =
      searchParams.get("month") || new Date().toISOString().slice(0, 7);

    let branchCondition = "";
    const params: any[] = [month];

    if (isAdminOrOwner(user.role)) {
      if (branch_name && branch_name !== "전체") {
        branchCondition = " AND branch_name = ? ";
        params.push(branch_name);
      }
    } else {
      branchCondition = " AND branch_name = ? ";
      params.push(user.branch_name);
    }

    const [byStatus]: any = await pool.query(
      `
      SELECT
        status,
        COUNT(*) AS count
      FROM naver_reservations
      WHERE DATE_FORMAT(created_at, '%Y-%m') = ?
        ${branchCondition}
      GROUP BY status
      ORDER BY count DESC
      `,
      params
    );

    const [total]: any = await pool.query(
      `
      SELECT COUNT(*) AS count
      FROM naver_reservations
      WHERE DATE_FORMAT(created_at, '%Y-%m') = ?
        ${branchCondition}
      `,
      params
    );

    const [unread]: any = await pool.query(
      `
      SELECT COUNT(*) AS count
      FROM naver_reservations
      WHERE DATE_FORMAT(created_at, '%Y-%m') = ?
        AND is_read = 'N'
        ${branchCondition}
      `,
      params
    );

    return NextResponse.json({
      success: true,
      month,
      total: total[0].count,
      unread: unread[0].count,
      by_status: byStatus,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: "예약 통계 조회 실패",
      error,
    });
  }
}