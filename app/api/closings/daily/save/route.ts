import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest, isAdminOrOwner } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const user = getUserFromRequest(req);
    const body = await req.json();

    const { branch_name, closing_date, memo } = body;

    const finalBranchName = isAdminOrOwner(user.role)
      ? branch_name
      : user.branch_name;

    const finalDate =
      closing_date || new Date().toISOString().slice(0, 10);

    if (!finalBranchName) {
      return NextResponse.json({
        success: false,
        message: "지점 정보가 필요합니다.",
      });
    }

    const [sales]: any = await pool.query(
      `
      SELECT
        IFNULL(SUM(final_amount), 0) AS sales_amount,
        IFNULL(SUM(CASE WHEN payment_method = 'CARD' THEN final_amount ELSE 0 END), 0) AS card_amount,
        IFNULL(SUM(CASE WHEN payment_method = 'CASH' THEN final_amount ELSE 0 END), 0) AS cash_amount,
        IFNULL(SUM(CASE WHEN payment_method = 'TRANSFER' THEN final_amount ELSE 0 END), 0) AS transfer_amount
      FROM payments
      WHERE payment_date = ?
        AND branch_name = ?
      `,
      [finalDate, finalBranchName]
    );

    const [newMembers]: any = await pool.query(
      `
      SELECT COUNT(*) AS count
      FROM members
      WHERE DATE(created_at) = ?
        AND branch_name = ?
      `,
      [finalDate, finalBranchName]
    );

    const [checkins]: any = await pool.query(
      `
      SELECT COUNT(*) AS count
      FROM attendance
      WHERE DATE(checkin_time) = ?
        AND branch_name = ?
        AND result = 'SUCCESS'
      `,
      [finalDate, finalBranchName]
    );

    const [reservations]: any = await pool.query(
      `
      SELECT COUNT(*) AS count
      FROM naver_reservations
      WHERE DATE(created_at) = ?
        AND branch_name = ?
      `,
      [finalDate, finalBranchName]
    );

    const [existing]: any = await pool.query(
      `
      SELECT closing_id
      FROM daily_closings
      WHERE closing_date = ?
        AND branch_name = ?
      LIMIT 1
      `,
      [finalDate, finalBranchName]
    );

    const row = sales[0];

    if (existing.length > 0) {
      await pool.query(
        `
        UPDATE daily_closings
        SET
          sales_amount = ?,
          card_amount = ?,
          cash_amount = ?,
          transfer_amount = ?,
          new_members = ?,
          checkins = ?,
          reservations = ?,
          memo = ?,
          closed_by = ?
        WHERE closing_id = ?
        `,
        [
          row.sales_amount || 0,
          row.card_amount || 0,
          row.cash_amount || 0,
          row.transfer_amount || 0,
          newMembers[0].count || 0,
          checkins[0].count || 0,
          reservations[0].count || 0,
          memo || null,
          user.login_id || "관리자",
          existing[0].closing_id,
        ]
      );

      return NextResponse.json({
        success: true,
        message: "일마감이 수정 저장되었습니다.",
        closing_id: existing[0].closing_id,
      });
    }

    const [result]: any = await pool.query(
      `
      INSERT INTO daily_closings (
        branch_name,
        closing_date,
        sales_amount,
        card_amount,
        cash_amount,
        transfer_amount,
        new_members,
        checkins,
        reservations,
        memo,
        closed_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        finalBranchName,
        finalDate,
        row.sales_amount || 0,
        row.card_amount || 0,
        row.cash_amount || 0,
        row.transfer_amount || 0,
        newMembers[0].count || 0,
        checkins[0].count || 0,
        reservations[0].count || 0,
        memo || null,
        user.login_id || "관리자",
      ]
    );

    return NextResponse.json({
      success: true,
      message: "일마감이 저장되었습니다.",
      closing_id: result.insertId,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: "일마감 저장 실패",
        error,
      },
      { status: 500 }
    );
  }
}