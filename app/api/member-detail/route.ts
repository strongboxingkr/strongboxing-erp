import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest, canAccessBranch } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const memberId = req.nextUrl.searchParams.get("member_id");

    if (!memberId) {
      return NextResponse.json({
        success: false,
        message: "member_id 필요",
      });
    }

    const [memberRows]: any = await pool.query(
      `
      SELECT *
      FROM members
      WHERE member_id = ?
      LIMIT 1
      `,
      [memberId]
    );

    const member = memberRows[0];
    if (!member) return NextResponse.json({ success: false, message: "회원 없음" }, { status: 404 });

    if (!canAccessBranch(user.role, user.branch_name, member.branch_name)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [paymentRows]: any = await pool.query(
      `
      SELECT *
      FROM payments
      WHERE member_id = ?
      ORDER BY payment_date DESC
      LIMIT 20
      `,
      [memberId]
    );

    const [attendanceRows]: any = await pool.query(
      `
      SELECT *
      FROM attendance
      WHERE member_id = ?
      ORDER BY created_at DESC
      LIMIT 100
      `,
      [memberId]
    );

    const [noteRows]: any = await pool.query(
      `
      SELECT *
      FROM member_notes
      WHERE member_id = ?
      ORDER BY created_at DESC
      LIMIT 20
      `,
      [memberId]
    );

    return NextResponse.json({
      success: true,
      member,
      payments: paymentRows,
      attendance: attendanceRows,
      notes: noteRows,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json({
      success: false,
      message: "회원 상세 조회 실패",
    });
  }
}
