import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET() {
  const [rows]: any = await pool.query(`
    SELECT *
    FROM branch_monthly_targets
    ORDER BY target_month DESC, branch_name
  `);

  return NextResponse.json({
    success: true,
    rows,
  });
}