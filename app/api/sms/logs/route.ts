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

    const [rows]: any = await pool.query(`
      SELECT *
      FROM sms_logs
      WHERE DATE(created_at) = CURDATE()
      ORDER BY sms_id DESC
      LIMIT 200
    `);

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