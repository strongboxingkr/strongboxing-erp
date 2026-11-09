import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest, canAccessBranch } from "@/lib/auth";

export async function GET(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { searchParams } = new URL(req.url);

    const branch_name = searchParams.get("branch_name");
    if (branch_name && !canAccessBranch(user.role, user.branch_name, branch_name)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let sql = `
      SELECT
        member_id,
        branch_name,
        name,
        phone,
        pass_type,
        remaining_count,
        end_date,
        status
      FROM members
      WHERE status = 'ACTIVE'
      AND (
        (pass_type = 'DATE' AND DATE(end_date) BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 3 DAY))
        OR (pass_type = 'COUNT' AND remaining_count <= 3)
      )
    `;

    const params: any[] = [];

    if (branch_name) {
      sql += ` AND branch_name = ? `;
      params.push(branch_name);
    }

    sql += `
      ORDER BY ABS(DATEDIFF(end_date, CURDATE())) ASC, remaining_count ASC
    `;

    const [rows]: any = await pool.query(sql, params);

    return NextResponse.json({
      success: true,
      rows,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json({
      success: false,
      message: "회원 알림 조회 실패",
      error,
    });
  }
}