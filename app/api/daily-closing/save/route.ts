import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest, isAdminOrOwner } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const user = getUserFromRequest(req);
    const body = await req.json();

    const {
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
    } = body;

    const targetBranch =
      isAdminOrOwner(user.role) ? branch_name : user.branch_name;

    if (!targetBranch) {
      return NextResponse.json({
        success: false,
        message: "지점 정보가 없습니다.",
      });
    }

    await pool.query(
      `
      INSERT INTO daily_closings
      (
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
      ON DUPLICATE KEY UPDATE
        sales_amount = VALUES(sales_amount),
        card_amount = VALUES(card_amount),
        cash_amount = VALUES(cash_amount),
        transfer_amount = VALUES(transfer_amount),
        new_members = VALUES(new_members),
        checkins = VALUES(checkins),
        reservations = VALUES(reservations),
        memo = VALUES(memo),
        closed_by = VALUES(closed_by)
      `,
      [
        targetBranch,
        closing_date,
        sales_amount || 0,
        card_amount || 0,
        cash_amount || 0,
        transfer_amount || 0,
        new_members || 0,
        checkins || 0,
        reservations || 0,
        memo || "",
        user.login_id || "",
      ]
    );

    return NextResponse.json({
      success: true,
      message: "일일 마감 저장 완료",
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json({
      success: false,
      message: "일일 마감 저장 실패",
      error,
    });
  }
}