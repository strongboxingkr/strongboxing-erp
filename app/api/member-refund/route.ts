import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const user = getUserFromRequest(req);
    const body = await req.json();

    const {
      member_id,
      refund_amount,
      refund_reason,
      payment_method,
    } = body;

    if (!member_id || !refund_amount) {
      return NextResponse.json({
        success: false,
        message: "member_id와 refund_amount는 필수입니다.",
      });
    }

    const [memberRows]: any = await pool.query(
      `
      SELECT *
      FROM members
      WHERE member_id = ?
      LIMIT 1
      `,
      [member_id]
    );

    if (memberRows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "회원을 찾을 수 없습니다.",
        },
        { status: 404 }
      );
    }

    const member = memberRows[0];
    const createdBy = user.login_id || "관리자";

    const [paymentResult]: any = await pool.query(
      `
      INSERT INTO payments (
        member_id,
        branch_name,
        payment_date,
        payment_method,
        product_name,
        pass_type,
        amount,
        discount_amount,
        refund_amount,
        final_amount,
        unpaid_amount,
        operator_name,
        history_type,
        memo
      )
      VALUES (?, ?, CURDATE(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        member.member_id,
        member.branch_name,
        payment_method || "TRANSFER",
        member.product_name,
        member.pass_type,
        0,
        0,
        refund_amount,
        -Math.abs(refund_amount),
        0,
        createdBy,
        "REFUND",
        refund_reason || "회원 환불",
      ]
    );

    await pool.query(
      `
      INSERT INTO member_histories (
        member_id,
        member_name,
        action_type,
        action_memo,
        old_value,
        new_value,
        created_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        member.member_id,
        member.name,
        "REFUND",
        "회원 환불 처리",
        JSON.stringify(member),
        JSON.stringify({
          refund_amount,
          refund_reason,
          payment_id: paymentResult.insertId,
        }),
        createdBy,
      ]
    );

    return NextResponse.json({
      success: true,
      message: "환불 처리 완료",
      payment_id: paymentResult.insertId,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: "환불 처리 실패",
        error,
      },
      { status: 500 }
    );
  }
}