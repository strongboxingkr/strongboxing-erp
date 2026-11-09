import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";

export async function GET(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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