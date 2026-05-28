import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";

export async function POST(req: Request, context: any) {
  const memberId = context.params.id;

  try {
    const user = getUserFromRequest(req);
    const body = await req.json();

    const {
      payment_date,
      payment_method,
      product_name,
      pass_type,
      amount,
      discount_amount,
      refund_amount,
      final_amount,
      unpaid_amount,
      start_date,
      end_date,
      total_count,
      memo,
      staff_name,
    } = body;

    const [memberRows]: any = await pool.query(
      "SELECT * FROM members WHERE member_id = ?",
      [memberId]
    );

    if (memberRows.length === 0) {
      return NextResponse.json(
        { success: false, message: "회원을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const member = memberRows[0];
    const finalStaffName = staff_name || "관리자";

    const [paymentResult]: any = await pool.query(
      `
      INSERT INTO payments (
        member_id,
        branch_name,
        payment_date,
        payment_method,
        product_name,
        pass_type,
        start_date,
        end_date,
        total_count,
        amount,
        discount_amount,
        refund_amount,
        final_amount,
        unpaid_amount,
        operator_name,
        history_type,
        memo
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        memberId,
        member.branch_name,
        payment_date || new Date(),
        payment_method,
        product_name,
        pass_type,
        start_date || null,
        end_date || null,
        total_count || 0,
        amount || 0,
        discount_amount || 0,
        refund_amount || 0,
        final_amount || 0,
        unpaid_amount || 0,
        finalStaffName,
        "RENEWAL",
        memo || null,
      ]
    );

    await pool.query(
      `
      UPDATE members
      SET
        product_name = ?,
        pass_type = ?,
        remaining_count = ?,
        start_date = ?,
        end_date = ?,
        status = 'ACTIVE',
        staff_name = ?
      WHERE member_id = ?
      `,
      [
        product_name,
        pass_type,
        pass_type === "COUNT" ? total_count || 0 : 0,
        start_date || null,
        end_date || null,
        finalStaffName,
        memberId,
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
        memberId,
        member.name,
        "RENEWAL",
        "회원권 재등록",
        JSON.stringify(member),
        JSON.stringify({
          payment_id: paymentResult.insertId,
          ...body,
        }),
        finalStaffName,
      ]
    );

    return NextResponse.json({
      success: true,
      message: "재등록이 완료되었습니다.",
      payment_id: paymentResult.insertId,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: "재등록 처리 중 오류가 발생했습니다.",
        error,
      },
      { status: 500 }
    );
  }
}