import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";

export async function PATCH(req: Request, context: any) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ success: false, message: "로그인이 필요합니다." }, { status: 401 });
    const paymentId = context.params.id;
    const body = await req.json();
    const { payment_date, payment_method, amount, final_amount } = body;

    // 취소(final_amount=0 & refund_amount>0) 또는 환불(history_type=REFUND) 결제는 수정 불가
    const [rows]: any = await pool.query(
      `SELECT final_amount, refund_amount, history_type FROM payments WHERE payment_id = ?`,
      [paymentId]
    );
    if (!rows.length) return NextResponse.json({ success: false, message: "결제 없음" }, { status: 404 });
    const p = rows[0];
    if (Number(p.final_amount) === 0 && Number(p.refund_amount) > 0) {
      return NextResponse.json({ success: false, message: "이미 취소된 결제는 수정할 수 없습니다." }, { status: 409 });
    }
    if (p.history_type === "REFUND") {
      return NextResponse.json({ success: false, message: "환불 기록은 수정할 수 없습니다." }, { status: 409 });
    }

    await pool.query(
      `UPDATE payments SET payment_date = ?, payment_method = ?, amount = ?, final_amount = ? WHERE payment_id = ?`,
      [payment_date, payment_method, amount, final_amount, paymentId]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error });
  }
}
