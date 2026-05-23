import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest, isAdminOrOwner } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const user = getUserFromRequest(req);

    const { searchParams } = new URL(req.url);

    const closing_date =
      searchParams.get("closing_date") ||
      new Date().toISOString().slice(0, 10);

    const branch_name = searchParams.get("branch_name");

    let targetBranch = branch_name;

    if (!isAdminOrOwner(user.role)) {
      targetBranch = user.branch_name || "";
    }

    if (!targetBranch) {
      return NextResponse.json({
        success: false,
        message: "지점 정보 없음",
      });
    }

    const [salesRows]: any = await pool.query(
      `
      SELECT
        IFNULL(SUM(amount),0) total,
        IFNULL(SUM(CASE WHEN payment_method='CARD' THEN amount END),0) card_amount,
        IFNULL(SUM(CASE WHEN payment_method='CASH' THEN amount END),0) cash_amount,
        IFNULL(SUM(CASE WHEN payment_method='TRANSFER' THEN amount END),0) transfer_amount
      FROM payments
      WHERE branch_name = ?
      AND DATE(payment_date) = ?
      `,
      [targetBranch, closing_date]
    );

    const [memberRows]: any = await pool.query(
      `
      SELECT COUNT(*) cnt
      FROM members
      WHERE branch_name = ?
      AND DATE(created_at) = ?
      `,
      [targetBranch, closing_date]
    );

    const [checkinRows]: any = await pool.query(
      `
      SELECT COUNT(*) cnt
      FROM attendance a
      JOIN members m
        ON a.member_id = m.member_id
      WHERE m.branch_name = ?
      AND DATE(a.checkin_time) = ?
      `,
      [targetBranch, closing_date]
    );

    const [reservationRows]: any = await pool.query(
      `
      SELECT COUNT(*) cnt
      FROM naver_reservations
      WHERE branch_name = ?
      AND reservation_date = ?
      `,
      [targetBranch, closing_date]
    );

    const [closingRows]: any = await pool.query(
      `
      SELECT *
      FROM daily_closings
      WHERE branch_name = ?
      AND closing_date = ?
      LIMIT 1
      `,
      [targetBranch, closing_date]
    );

    return NextResponse.json({
      success: true,

      branch_name: targetBranch,
      closing_date,

      sales: salesRows[0]?.total || 0,
      card_amount: salesRows[0]?.card_amount || 0,
      cash_amount: salesRows[0]?.cash_amount || 0,
      transfer_amount: salesRows[0]?.transfer_amount || 0,

      new_members: memberRows[0]?.cnt || 0,
      checkins: checkinRows[0]?.cnt || 0,
      reservations: reservationRows[0]?.cnt || 0,

      closing: closingRows[0] || null,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json({
      success: false,
      error,
    });
  }
}