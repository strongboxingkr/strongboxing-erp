import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest, isAdminOrOwner, canAccessBranch } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const branch = searchParams.get("branch_name");
  const year = searchParams.get("year");
  const month = searchParams.get("month");

  let where = "WHERE 1=1";
  const params: any[] = [];

  if (branch) {
    where += " AND branch_name = ?";
    params.push(branch);
  } else if (!isAdminOrOwner(user.role)) {
    where += " AND branch_name = ?";
    params.push(user.branch_name);
  }

  if (year) { where += " AND YEAR(sale_date) = ?"; params.push(year); }
  if (month) { where += " AND MONTH(sale_date) = ?"; params.push(month); }

  const [rows] = await pool.query(`SELECT * FROM daily_sales ${where} ORDER BY sale_date DESC`, params) as any;
  return NextResponse.json({ rows });
}
