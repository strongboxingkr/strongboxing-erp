import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { lockPaymentForEdit, paymentGuardErrorResponse } from "@/lib/payment-guard";

export async function PATCH(req: Request, context: any) {
  const conn = await (pool as any).getConnection();
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ success: false, message: "로그인이 필요합니다." }, { status: 401 });
    const paymentId = context.params.id;
    const body = await req.json();
    const { payment_date, payment_method, amount, final_amount } = body;

    await conn.beginTransaction();

    // FOR UPDATE 잠금 후 최신 상태 검증 (cancel·delete·member-refund와 동일 잠금 순서)
    await lockPaymentForEdit(conn, paymentId);

    await conn.query(
      `UPDATE payments SET payment_date = ?, payment_method = ?, amount = ?, final_amount = ? WHERE payment_id = ?`,
      [payment_date, payment_method, amount, final_amount, paymentId]
    );

    await conn.commit();
    return NextResponse.json({ success: true });
  } catch (error: any) {
    await conn.rollback();
    const guardRes = paymentGuardErrorResponse(error);
    if (guardRes) return NextResponse.json(guardRes.body, { status: guardRes.status });
    return NextResponse.json({ success: false, error });
  } finally {
    conn.release();
  }
}
