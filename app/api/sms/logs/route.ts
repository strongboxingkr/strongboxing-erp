import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest, canAccessBranch } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const branch = searchParams.get("branch_name");
    if (!canAccessBranch(user.role, user.branch_name, branch)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const targetType = searchParams.get("target_type");
    const dateFrom = searchParams.get("date_from");
    const dateTo = searchParams.get("date_to");

    const params: any[] = [];
    let branchClause = "";
    let typeClause = "";
    let dateClause = "AND DATE(created_at) = CURDATE()";

    if (branch) {
      branchClause = "AND branch_name = ?";
      params.push(branch);
    }
    if (targetType) {
      typeClause = "AND target_type = ?";
      params.push(targetType);
    }
    if (dateFrom && dateTo) {
      dateClause = "AND DATE(created_at) BETWEEN ? AND ?";
      params.push(dateFrom, dateTo);
    } else if (dateFrom) {
      dateClause = "AND DATE(created_at) >= ?";
      params.push(dateFrom);
    }

    const [rows]: any = await pool.query(`
      SELECT *
      FROM sms_logs
      WHERE 1=1
      ${dateClause}
      ${branchClause}
      ${typeClause}
      ORDER BY sms_id DESC
      LIMIT 500
    `, params);

    return NextResponse.json({
      success: true,
      rows,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: "문자 이력 조회 실패",
      error,
    });
  }
}