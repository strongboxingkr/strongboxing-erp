import { NextResponse } from "next/server";
import pool from "@/lib/db";

function addDays(dateString: string, days: number) {
  const date = new Date(dateString);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function addMonths(dateString: string, months: number) {
  // 30일 × 개월수 방식 (이지스포 동일)
  return addDays(dateString, months * 30);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      member_id,
      branch_name,
      payment_date,
      start_date: start_date_input,
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

    const product = productRows[0] || null;

    // 상품명에서 기간/횟수 파싱 (DB에 없어도 동작)
    const pass_type = product?.option_value ||
      (/(회권|회$)/.test(product_name || "") ? "COUNT" : "PERIOD");
    const duration_months = Number(product?.duration_months || 0) ||
      (() => {
        const m = (product_name || "").match(/(\d+)\s*개월/);
        return m ? parseInt(m[1]) : 0;
      })() ||
      (() => {
        const y = (product_name || "").match(/(\d+)\s*년/);
        return y ? parseInt(y[1]) * 12 : 0;
      })() || 1;
    const countFromDB = Number(product?.count_value || 0);
    const countMatch = (product_name || "").match(/(\d+)\s*회/);
    const countFromName = countMatch ? parseInt(countMatch[1]) : 0;
    const count_value = countFromDB || countFromName;

    const start_date = start_date_input || payment_date;
    const countMonths = pass_type === "COUNT" ? Math.ceil(count_value / 12) : 0;
    const end_date =
      pass_type === "PERIOD"
        ? addMonths(payment_date, duration_months)
        : addMonths(payment_date, countMonths || 1);

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
        amount,
        discount_amount,
        refund_amount,
        final_amount,
        memo
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        member_id,
        branch_name,
        payment_date,
        payment_method,
        product_name,
        amount,
        discount_amount || 0,
        refund_amount || 0,
        final_amount ?? amount,
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