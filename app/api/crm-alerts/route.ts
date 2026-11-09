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
      SELECT *
      FROM crm_leads
      WHERE next_contact_date <= CURDATE()
      AND status IN ('상담중', '방문예약', '재연락필요', '보류')
    `;

    const params: any[] = [];

    if (branch_name) {
      sql += ` AND branch_name = ? `;
      params.push(branch_name);
    }

    sql += ` ORDER BY next_contact_date ASC, lead_id DESC `;

    const [rows]: any = await pool.query(sql, params);

    return NextResponse.json({
      success: true,
      rows,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: "CRM 알림 조회 실패",
      error,
    });
  }
}