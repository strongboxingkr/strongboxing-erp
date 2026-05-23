import { NextResponse } from "next/server";
import pool from "@/lib/db";

function addMonths(dateString: string, months: number) {
  const date = new Date(dateString);
  date.setMonth(date.getMonth() + months);
  return date.toISOString().slice(0, 10);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      member_id,
      branch_name,
      payment_date,
      payment_method,
      product_name,
      amount,
      discount_amount,
      refund_amount,
      final_amount,
      memo,
    } = body;

    const [memberRows]: any = await pool.query(
      "SELECT * FROM members WHERE member_id = ?",
      [member_id]
    );

    if (memberRows.length === 0) {
      return NextResponse.json({
        success: false,
        message: "회원 없음",
      });
    }

    const [productRows]: any = await pool.query(
      `
      SELECT *
      FROM settings_options
      WHERE option_type = 'PASS_PRODUCT'
      AND option_name = ?
      AND use_yn = 'Y'
      LIMIT 1
      `,
      [product_name]
    );

    if (productRows.length === 0) {
      return NextResponse.json({
        success: false,
        message: "회원권 상품 설정을 찾을 수 없습니다.",
      });
    }

    const product = productRows[0];

    const pass_type = product.option_value; // PERIOD / COUNT
    const duration_months = Number(product.duration_months || 0);
    const count_value = Number(product.count_value || 0);

    const start_date = payment_date;
    const end_date =
      pass_type === "PERIOD"
        ? addMonths(payment_date, duration_months || 1)
        : payment_date;

    const remaining_count =
      pass_type === "COUNT" ? count_value : 0;

    await pool.query(
      `
      INSERT INTO payments
      (
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
        memo
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        member_id,
        branch_name,
        payment_date,
        payment_method,
        product_name,
        pass_type,
        amount,
        discount_amount || 0,
        refund_amount || 0,
        final_amount,
        memo || "",
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
        status = 'ACTIVE'
      WHERE member_id = ?
      `,
      [
        product_name,
        pass_type,
        remaining_count,
        start_date,
        end_date,
        member_id,
      ]
    );

    return NextResponse.json({
      success: true,
      message: "결제 등록 완료",
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json({
      success: false,
      message: "결제 등록 실패",
      error,
    });
  }
}