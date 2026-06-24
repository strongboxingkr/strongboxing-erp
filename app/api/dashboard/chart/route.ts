import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const branch_name = searchParams.get("branch_name");

    const branchFilter = branch_name && branch_name !== "전체" ? " AND branch_name = ?" : "";
    const params = branch_name && branch_name !== "전체" ? [branch_name] : [];

    // payments 테이블
    const [payRows]: any = await pool.query(
      `SELECT DATE_FORMAT(payment_date, '%m/%d') AS date, DATE(payment_date) AS raw_date, IFNULL(SUM(final_amount), 0) AS sales
       FROM payments
       WHERE payment_date >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
       ${branchFilter}
       GROUP BY DATE(payment_date)
       ORDER BY DATE(payment_date)`,
      params
    );

    // daily_sales 테이블 (이지스포 업로드)
    const [dsRows]: any = await pool.query(
      `SELECT DATE_FORMAT(sale_date, '%m/%d') AS date, DATE(sale_date) AS raw_date, IFNULL(SUM(total_amount), 0) AS sales
       FROM daily_sales
       WHERE sale_date >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
       ${branchFilter}
       GROUP BY DATE(sale_date)
       ORDER BY DATE(sale_date)`,
      params
    );

    // 두 소스 합치기
    const merged: Record<string, number> = {};
    for (const r of payRows) merged[r.date] = (merged[r.date] || 0) + Number(r.sales);
    for (const r of dsRows) merged[r.date] = (merged[r.date] || 0) + Number(r.sales);

    // 최근 7일 날짜 채우기
    const rows = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
      rows.push({ date: key, sales: merged[key] || 0 });
    }

    return NextResponse.json({ success: true, rows });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error });
  }
}
