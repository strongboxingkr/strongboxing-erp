import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest, canAccessBranch } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ success: false, message: "로그인이 필요합니다." }, { status: 401 });

    const body = await req.json();
    const { member_id } = body;

    // 대상 회원 지점 확인 후 권한 체크
    const [memberRows]: any = await pool.query(
      "SELECT branch_name FROM members WHERE member_id = ? LIMIT 1",
      [member_id]
    );
    if (memberRows.length === 0) return NextResponse.json({ success: false, message: "회원 없음" });
    if (!canAccessBranch(user.role, user.branch_name, memberRows[0].branch_name)) {
      return NextResponse.json({ success: false, message: "권한이 없습니다." }, { status: 403 });
    }

    await pool.query(
      `
      UPDATE members
      SET status = 'DELETED'
      WHERE member_id = ?
      `,
      [member_id]
    );

    return NextResponse.json({
      success: true,
      message: "회원 삭제 완료",
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error,
    });
  }
}