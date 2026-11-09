import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest, canAccessBranch } from "@/lib/auth";

export async function GET(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const branch_name = searchParams.get("branch_name");
  if (branch_name && !canAccessBranch(user.role, user.branch_name, branch_name)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const branchFilter = branch_name ? `AND m.branch_name = ?` : (canAccessBranch(user.role, user.branch_name, null) ? "" : `AND m.branch_name = ?`);
  const params = branch_name ? [branch_name] : (!canAccessBranch(user.role, user.branch_name, null) ? [user.branch_name] : []);

  const [rows]: any = await pool.query(`
    SELECT
      a.attendance_id,
      a.checkin_time,
      a.result,
      m.name,
      m.phone,
      m.branch_name,
      m.product_name,
      m.remaining_count,
      m.end_date,
      m.status
    FROM attendance a
    JOIN members m ON a.member_id = m.member_id
    ${branchFilter}
    ORDER BY a.attendance_id DESC
    LIMIT 10
  `, params);

  return NextResponse.json({
    success: true,
    rows,
  });
}
