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
      `SELECT branch_name FROM members WHERE member_id = ? LIMIT 1`,
      [memberId]
    );
    if (memberRows.length === 0) return NextResponse.json({ success: false, message: "회원 없음" }, { status: 404 });
    if (!canAccessBranch(user.role, user.branch_name, memberRows[0].branch_name)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [rows]: any = await pool.query(
      `
      SELECT
        history_id, member_id, action_type, action_memo, old_value, new_value, created_at, created_by
      FROM member_histories
      WHERE member_id = ?
        AND action_type NOT IN ('ATTENDANCE', 'ATTENDANCE_UNDO')
      UNION ALL
      SELECT
        hold_id,
        member_id,
        'HOLD' AS action_type,
        CONCAT(
          '휴회 ', hold_start, ' ~ ', hold_end, ' (', hold_days, '일)',
          ' | 만료일 ', old_end_date, ' → ', new_end_date,
          IF(reason IS NOT NULL AND reason != '', CONCAT(' / ', reason), '')
        ) AS action_memo,
        NULL, NULL,
        created_at,
        created_by
      FROM member_holds
      WHERE member_id = ?
      ORDER BY created_at DESC
      `,
      [memberId, memberId]
    );

    return NextResponse.json({
      success: true,
      rows,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json({
      success: false,
      message: "이력 조회 실패",
    });
  }
}
