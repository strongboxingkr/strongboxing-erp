import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      member_id,
      branch_name,
      name,
      phone,
      product_name,
      pass_type,
      remaining_count,
      start_date,
      end_date,
      status,
      memo,
    } = body;

    const phone_last4 = phone.slice(-4);

    await pool.query(
      `
      UPDATE members
      SET
        branch_name = ?,
        name = ?,
        phone = ?,
        phone_last4 = ?,
        product_name = ?,
        pass_type = ?,
        remaining_count = ?,
        start_date = ?,
        end_date = ?,
        status = ?,
        memo = ?
      WHERE member_id = ?
      `,
      [
        branch_name,
        name,
        phone,
        phone_last4,
        product_name,
        pass_type,
        remaining_count,
        start_date,
        end_date,
        status,
        memo,
        member_id,
      ]
    );

    return NextResponse.json({
      success: true,
      message: "회원 수정 완료",
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error,
    });
  }
}