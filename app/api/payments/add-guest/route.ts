import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { branch_name, payment_date, payment_method, product_name, final_amount, memo } = body;

    if (!branch_name) return NextResponse.json({ success: false, message: "지점 선택 필요" });
    if (!product_name) return NextResponse.json({ success: false, message: "상품 선택 필요" });
    if (final_amount === undefined || final_amount === null || final_amount === "") return NextResponse.json({ success: false, message: "금액 입력 필요" });

    await pool.query(
      `INSERT INTO payments (member_id, branch_name, payment_date, payment_method, product_name, amount, discount_amount, refund_amount, final_amount, memo)
       VALUES (NULL, ?, ?, ?, ?, ?, 0, 0, ?, ?)`,
      [branch_name, payment_date || new Date().toISOString().slice(0, 10), payment_method || "CARD", product_name, final_amount, final_amount, memo || "비회원"]
    );

    return NextResponse.json({ success: true, message: "비회원 결제 등록 완료" });
  } catch (error) {
    return NextResponse.json({ success: false, message: "결제 등록 실패", error });
  }
}
