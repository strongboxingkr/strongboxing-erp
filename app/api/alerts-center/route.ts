import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest, isAdminOrOwner } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const user = getUserFromRequest(req);

    const branchFilter = !isAdminOrOwner(user.role)
      ? " AND branch_name = ? "
      : "";

    const params = !isAdminOrOwner(user.role) ? [user.branch_name] : [];

    const [reservations]: any = await pool.query(
      `
      SELECT *
      FROM naver_reservations
      WHERE reservation_date = CURDATE()
      AND status IN ('예약접수', '예약확정')
      ${branchFilter}
      ORDER BY reservation_id DESC
      `,
      params
    );

    const [members]: any = await pool.query(
      `
      SELECT *
      FROM members
      WHERE status = 'ACTIVE'
      AND (
        end_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)
        OR (pass_type = 'COUNT' AND remaining_count <= 3)
      )
      ${branchFilter}
      ORDER BY end_date ASC
      `,
      params
    );

    const [crm]: any = await pool.query(
      `
      SELECT *
      FROM crm_leads
      WHERE next_contact_date <= CURDATE()
      AND status IN ('상담중', '방문예약', '재연락필요', '보류')
      ${branchFilter}
      ORDER BY next_contact_date ASC
      `,
      params
    );

    const [notices]: any = await pool.query(
      isAdminOrOwner(user.role)
        ? `
          SELECT *
          FROM notices
          WHERE use_yn = 'Y'
          ORDER BY notice_id DESC
          LIMIT 5
        `
        : `
          SELECT *
          FROM notices
          WHERE use_yn = 'Y'
          AND (branch_name = '전체' OR branch_name = ?)
          ORDER BY notice_id DESC
          LIMIT 5
        `,
      isAdminOrOwner(user.role) ? [] : [user.branch_name]
    );

    return NextResponse.json({
      success: true,
      reservations,
      members,
      crm,
      notices,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: "알림센터 조회 실패",
      error,
    });
  }
}