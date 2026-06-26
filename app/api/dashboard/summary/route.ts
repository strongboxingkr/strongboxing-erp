import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest, isAdminOrOwner } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const user = getUserFromRequest(req);

    const { searchParams } = new URL(req.url);
    const branch_name = searchParams.get("branch_name");

    const finalBranchName = isAdminOrOwner(user.role)
      ? branch_name
      : user.branch_name;

    let branchWhere = "";
    const params: any[] = [];

    if (finalBranchName) {
      branchWhere = " AND branch_name = ? ";
      params.push(finalBranchName);
    }

    const [todaySales]: any = await pool.query(
      `
      SELECT IFNULL(SUM(final_amount), 0) AS amount
      FROM payments
      WHERE payment_date = CURDATE()
      ${branchWhere}
      `,
      params
    );

    const [monthSales]: any = await pool.query(
      `
      SELECT IFNULL(SUM(final_amount), 0) AS amount
      FROM payments
      WHERE DATE_FORMAT(payment_date, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')
      ${branchWhere}
      `,
      params
    );

    const [activeMembers]: any = await pool.query(
      `
      SELECT COUNT(*) AS count
      FROM members
      WHERE status = 'ACTIVE'
      ${branchWhere}
      `,
      params
    );

    const [todayAttendance]: any = await pool.query(
      `
      SELECT COUNT(*) AS count
      FROM attendance
      WHERE result = 'SUCCESS'
        AND DATE(checkin_time) = CURDATE()
      ${branchWhere}
      `,
      params
    );

    const [todayNew]: any = await pool.query(
      `SELECT COUNT(*) AS count FROM members WHERE DATE(created_at) = CURDATE() ${branchWhere}`,
      params
    );

    const [monthNew]: any = await pool.query(
      `SELECT COUNT(*) AS count FROM members WHERE DATE_FORMAT(created_at, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m') ${branchWhere}`,
      params
    );

    return NextResponse.json({
      success: true,
      data: {
        today_sales: todaySales[0].amount,
        month_sales: monthSales[0].amount,
        active_members: activeMembers[0].count,
        today_attendance: todayAttendance[0].count,
        today_new: todayNew[0].count,
        month_new: monthNew[0].count,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: "대시보드 요약 조회 실패",
        error,
      },
      { status: 500 }
    );
  }
}