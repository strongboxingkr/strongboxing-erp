import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest, isAdminOrOwner } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const user = await getUserFromRequest(req);

    if (!user) return NextResponse.json({ success: false, message: "로그인이 필요합니다." }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const year = searchParams.get("year") || new Date().getFullYear().toString();
    const month = searchParams.get("month") || String(new Date().getMonth() + 1);
    const branch_name = searchParams.get("branch_name");

    const finalBranch = isAdminOrOwner(user.role) ? branch_name : user.branch_name;
    const branchWhere = finalBranch ? "AND p.branch_name = ?" : "";
    const params: any[] = finalBranch ? [finalBranch] : [];

    // 월별 일자별 집계
    const [dailyRows]: any = await pool.query(
      `
      SELECT
        DATE_FORMAT(p.payment_date, '%Y-%m-%d') AS sale_date,
        MIN(DAY(p.payment_date)) AS sale_day,
        MIN(DAYOFWEEK(p.payment_date)) AS dow,
        IFNULL(SUM(CASE WHEN p.payment_method = 'CASH' THEN p.final_amount ELSE 0 END), 0) AS cash_amount,
        IFNULL(SUM(CASE WHEN p.payment_method = 'CARD' THEN p.final_amount ELSE 0 END), 0) AS card_amount,
        IFNULL(SUM(CASE WHEN p.payment_method = 'TRANSFER' THEN p.final_amount ELSE 0 END), 0) AS transfer_amount,
        IFNULL(SUM(p.final_amount), 0) AS total_amount,
        COUNT(*) AS count
      FROM payments p
      WHERE YEAR(p.payment_date) = ?
        AND MONTH(p.payment_date) = ?
        AND p.final_amount > 0
        AND (p.status IS NULL OR p.status != 'CANCELLED')
        ${branchWhere}
      GROUP BY sale_date
      ORDER BY sale_date DESC
      `,
      [year, month, ...params]
    );

    return NextResponse.json({ success: true, rows: dailyRows });
  } catch (error) {
    return NextResponse.json({ success: false, error });
  }
}
