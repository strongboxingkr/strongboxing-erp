import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest, canAccessBranch } from "@/lib/auth";

export async function GET(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { searchParams } = new URL(req.url);
    const member_id = searchParams.get("member_id");

    if (!member_id) {
      return NextResponse.json({
        success: false,
        message: "member_id가 필요합니다.",
      });
    }

    const [memberRows]: any = await pool.query(
      `SELECT branch_name FROM members WHERE member_id = ? LIMIT 1`,
      [member_id]
    );
    if (memberRows.length === 0) return NextResponse.json({ success: false, message: "회원 없음" }, { status: 404 });
    if (!canAccessBranch(user.role, user.branch_name, memberRows[0].branch_name)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [rows]: any = await pool.query(
      `
      SELECT *
      FROM member_files
      WHERE member_id = ?
      ORDER BY file_id DESC
      `,
      [member_id]
    );

    return NextResponse.json({
      success: true,
      rows,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: "회원 파일 조회 실패",
      error,
    });
  }
}
