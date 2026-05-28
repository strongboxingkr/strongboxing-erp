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

    const [summary]: any = await pool.query(
      `
      SELECT
        IFNULL(SUM(final_amount), 0) AS total_sales,
        IFNULL(SUM(refund_amount), 0) AS total_refund,
        IFNULL(SUM(unpaid_amount), 0) AS total_unpaid,
        COUNT(*) AS payment_count
      FROM payments
      WHERE DATE_FORMAT(payment_date, '%Y-%m') = ?
        ${branchCondition}
      `,
      params
    );

    const [byMethod]: any = await pool.query(
      `
      SELECT
        payment_method,
        IFNULL(SUM(final_amount), 0) AS amount,
        COUNT(*) AS count
      FROM payments
      WHERE DATE_FORMAT(payment_date, '%Y-%m') = ?
        ${branchCondition}
      GROUP BY payment_method
      ORDER BY amount DESC
      `,
      params
    );

    const [byProduct]: any = await pool.query(
      `
      SELECT
        product_name,
        IFNULL(SUM(final_amount), 0) AS amount,
        COUNT(*) AS count
      FROM payments
      WHERE DATE_FORMAT(payment_date, '%Y-%m') = ?
        ${branchCondition}
      GROUP BY product_name
      ORDER BY amount DESC
      `,
      params
    );

    const [daily]: any = await pool.query(
      `
      SELECT
        payment_date,
        IFNULL(SUM(final_amount), 0) AS amount,
        COUNT(*) AS count
      FROM payments
      WHERE DATE_FORMAT(payment_date, '%Y-%m') = ?
        ${branchCondition}
      GROUP BY payment_date
      ORDER BY payment_date ASC
      `,
      params
    );

    return NextResponse.json({
      success: true,
      month,
      summary: summary[0],
      by_method: byMethod,
      by_product: byProduct,
      daily,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: "월별 매출 조회 실패",
      error,
    });
  }
}