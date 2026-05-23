import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const branch_name = searchParams.get("branch_name");

    const branchFilter =
      branch_name && branch_name !== "전체" ? ` AND branch_name = ? ` : "";

    const params =
      branch_name && branch_name !== "전체" ? [branch_name] : [];

    const [rows]: any = await pool.query(
      `
      SELECT
        DATE_FORMAT(payment_date, '%m/%d') AS date,
        IFNULL(SUM(final_amount), 0) AS sales
      FROM payments
      WHERE payment_date >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
      ${branchFilter}
      GROUP BY DATE(payment_date), DATE_FORMAT(payment_date, '%m/%d')
      ORDER BY DATE(payment_date)
      `,
      params
    );

    return NextResponse.json({
      success: true,
      rows,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json({
      success: false,
      error,
    });
  }
}