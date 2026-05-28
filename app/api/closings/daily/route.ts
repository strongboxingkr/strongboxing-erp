import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest, isAdminOrOwner } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const user = getUserFromRequest(req);
    const { searchParams } = new URL(req.url);

    const branch_name = searchParams.get("branch_name");
    const date = searchParams.get("date") || new Date().toISOString().slice(0, 10);

    let branchCondition = "";
    const params: any[] = [date];

    if (isAdminOrOwner(user.role)) {
      if (branch_name && branch_name !== "전체") {
        branchCondition = " AND branch_name = ? ";
        params.push(branch_name);
      }
    } else {
      branchCondition = " AND branch_name = ? ";
      params.push(user.branch_name);
    }

    const [closingRows]: any = await pool.query(
      `
      SELECT *
      FROM daily_closings
      WHERE closing_date = ?
        ${branchCondition}
      ORDER BY branch_name ASC
      `,
      params
    );

    const [sales]: any = await pool.query(
      `
      SELECT
        IFNULL(SUM(final_amount), 0) AS sales_amount,
        IFNULL(SUM(CASE WHEN payment_method = 'CARD' THEN final_amount ELSE 0 END), 0) AS card_amount,
        IFNULL(SUM(CASE WHEN payment_method = 'CASH' THEN final_amount ELSE 0 END), 0) AS cash_amount,
        IFNULL(SUM(CASE WHEN payment_method = 'TRANSFER' THEN final_amount ELSE 0 END), 0) AS transfer_amount
      FROM payments
      WHERE payment_date = ?
        ${branchCondition}
      `,
      params
    );

    const [expenses]: any = await pool.query(
      `
      SELECT IFNULL(SUM(amount), 0) AS expense_amount
      FROM expenses
      WHERE expense_date = ?
        ${branchCondition}
      `,
      params
    );

    const [newMembers]: any = await pool.query(
      `
      SELECT COUNT(*) AS count
      FROM members
      WHERE DATE(created_at) = ?
        ${branchCondition}
      `,
      params
    );

    const [checkins]: any = await pool.query(
      `
      SELECT COUNT(*) AS count
      FROM attendance
      WHERE DATE(checkin_time) = ?
        AND result = 'SUCCESS'
        ${branchCondition}
      `,
      params
    );

    const [reservations]: any = await pool.query(
      `
      SELECT COUNT(*) AS count
      FROM naver_reservations
      WHERE DATE(created_at) = ?
        ${branchCondition}
      `,
      params
    );

    return NextResponse.json({
      success: true,
      date,
      saved_closings: closingRows,
      current: {
        sales_amount: sales[0].sales_amount || 0,
        card_amount: sales[0].card_amount || 0,
        cash_amount: sales[0].cash_amount || 0,
        transfer_amount: sales[0].transfer_amount || 0,
        expense_amount: expenses[0].expense_amount || 0,
        new_members: newMembers[0].count || 0,
        checkins: checkins[0].count || 0,
        reservations: reservations[0].count || 0,
      },
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: "일마감 조회 실패",
      error,
    });
  }
}