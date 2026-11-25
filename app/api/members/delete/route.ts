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

    const conn = await (pool as any).getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(`DELETE FROM attendance WHERE member_id = ?`, [member_id]);
      await conn.query(`DELETE FROM payments WHERE member_id = ?`, [member_id]);
      await conn.query(`DELETE FROM member_histories WHERE member_id = ?`, [member_id]);
      await conn.query(`DELETE FROM member_holds WHERE member_id = ?`, [member_id]);
      await conn.query(`DELETE FROM members WHERE member_id = ?`, [member_id]);
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }

    return NextResponse.json({
      success: true,
      message: "회원 삭제 완료",
    });
  } catch (error: any) {
    console.error("회원 삭제 오류:", error);
    return NextResponse.json({
      success: false,
      message: error?.message || "회원 삭제 실패",
    });
  }
}