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
        status,
        product_name,
        CASE
          WHEN pass_type = 'DATE' AND DATE(end_date) < CURDATE() THEN '기간 만료'
          WHEN pass_type = 'DATE' AND DATE(end_date) = CURDATE() THEN '오늘 만료'
          WHEN pass_type = 'DATE' AND DATEDIFF(DATE(end_date), CURDATE()) = 1 THEN '만료 예정 (1일)'
          WHEN pass_type = 'DATE' AND DATEDIFF(DATE(end_date), CURDATE()) = 2 THEN '만료 예정 (2일)'
          WHEN pass_type = 'DATE' AND DATEDIFF(DATE(end_date), CURDATE()) = 3 THEN '만료 예정 (3일)'
          WHEN pass_type = 'COUNT' AND remaining_count = 0 THEN '횟수 소진'
          WHEN pass_type = 'COUNT' AND remaining_count <= 3 THEN CONCAT('횟수 부족 (', remaining_count, '회)')
          ELSE NULL
        END AS alert_type
      FROM members
      WHERE status = 'ACTIVE'
      AND (
        (pass_type = 'DATE' AND DATE(end_date) <= DATE_ADD(CURDATE(), INTERVAL 3 DAY))
        OR (pass_type = 'COUNT' AND remaining_count <= 3)
      )
    `;

    const params: any[] = [];
    if (branch_name) {
      sql += ` AND branch_name = ?`;
      params.push(branch_name);
    }

    sql += ` ORDER BY
      CASE WHEN pass_type = 'DATE' AND DATE(end_date) < CURDATE() THEN 0
           WHEN pass_type = 'DATE' AND DATE(end_date) = CURDATE() THEN 1
           WHEN pass_type = 'COUNT' AND remaining_count = 0 THEN 2
           ELSE 3 END ASC,
      ABS(DATEDIFF(end_date, CURDATE())) ASC,
      remaining_count ASC
    `;

    const [rows]: any = await pool.query(sql, params);
    return NextResponse.json({ success: true, rows });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, message: "조회 실패", error });
  }
}
