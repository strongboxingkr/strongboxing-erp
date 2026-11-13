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
      -- 회원권 결제 이력 (등록/재등록)
      SELECT
        payment_id AS history_id,
        member_id,
        CASE WHEN pass_type = 'DAILY' THEN 'DAILY_PASS' ELSE 'PAYMENT' END AS action_type,
        CONCAT(
          product_name,
          IF(start_date IS NOT NULL AND end_date IS NOT NULL,
            CONCAT(' | ', DATE_FORMAT(start_date,'%Y-%m-%d'), ' ~ ', DATE_FORMAT(end_date,'%Y-%m-%d')), ''),
          IF(pass_type = 'COUNT' AND total_count IS NOT NULL,
            CONCAT(' | ', total_count, '회권'), ''),
          ' | ', FORMAT(final_amount, 0), '원',
          CONCAT(' (', payment_method, ')')
        ) AS action_memo,
        NULL AS old_value, NULL AS new_value,
        payment_date AS created_at,
        NULL AS created_by
      FROM payments
      WHERE member_id = ? AND pass_type IN ('PERIOD','COUNT','DAILY')

      UNION ALL

      -- 휴회 이력
      SELECT
        hold_id, member_id, 'HOLD' AS action_type,
        CONCAT(
          hold_start, ' ~ ', hold_end, ' (', hold_days, '일)',
          ' | 만료일 ', old_end_date, ' → ', new_end_date,
          IF(reason IS NOT NULL AND reason != '', CONCAT(' / ', reason), '')
        ) AS action_memo,
        NULL, NULL,
        created_at, created_by
      FROM member_holds
      WHERE member_id = ?

      UNION ALL

      -- 실제 정보 수정 이력 (출석·자동갱신 제외, old/new가 다른 항목만)
      SELECT
        history_id, member_id, action_type, action_memo, old_value, new_value, created_at, created_by
      FROM member_histories
      WHERE member_id = ?
        AND action_type NOT IN ('ATTENDANCE','ATTENDANCE_UNDO')

      ORDER BY created_at DESC
      `,
      [memberId, memberId, memberId]
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
