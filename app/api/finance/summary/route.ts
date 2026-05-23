import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest, isAdminOrOwner } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const user = getUserFromRequest(req);

    const today = new Date()
      .toISOString()
      .slice(0, 10);

    let branchCondition = "";
    const params: any[] = [];

    if (!isAdminOrOwner(user.role)) {
      branchCondition =
        " AND branch_name = ? ";
      params.push(user.branch_name);
    }

    const [todayRows]: any = await pool.query(
      `
      SELECT IFNULL(SUM(amount),0) total
      FROM payments
      WHERE DATE(payment_date)=?
      ${branchCondition}
      `,
      [today, ...params]
    );

    const [monthRows]: any = await pool.query(
      `
      SELECT IFNULL(SUM(amount),0) total
      FROM payments
      WHERE DATE_FORMAT(payment_date,'%Y-%m')
      = DATE_FORMAT(CURDATE(),'%Y-%m')
      ${branchCondition}
      `,
      params
    );

    const [methodRows]: any = await pool.query(
      `
      SELECT
        payment_method,
        IFNULL(SUM(amount),0) total
      FROM payments
      WHERE 1=1
      ${branchCondition}
      GROUP BY payment_method
      `,
      params
    );

    const [branchRows]: any = await pool.query(
      `
      SELECT
        branch_name,
        IFNULL(SUM(amount),0) total
      FROM payments
      WHERE 1=1
      ${branchCondition}
      GROUP BY branch_name
      ORDER BY total DESC
      `,
      params
    );

    const [recentRows]: any = await pool.query(
      `
      SELECT
        p.*,
        m.name
      FROM payments p
      LEFT JOIN members m
        ON p.member_id = m.member_id
      WHERE 1=1
      ${branchCondition.replace(
        "branch_name",
        "p.branch_name"
      )}
      ORDER BY payment_id DESC
      LIMIT 10
      `,
      params
    );

    return NextResponse.json({
      success: true,

      today_sales:
        todayRows[0]?.total || 0,

      month_sales:
        monthRows[0]?.total || 0,

      payment_methods:
        methodRows || [],

      branch_sales:
        branchRows || [],

      recent_payments:
        recentRows || [],
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: "재무 요약 조회 실패",
      error,
    });
  }
}