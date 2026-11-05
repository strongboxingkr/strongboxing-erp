import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";

export async function PATCH(req: Request, context: any) {
  try {
    getUserFromRequest(req);
    const paymentId = context.params.id;
    const body = await req.json();
    const { payment_date, payment_method, amount, final_amount } = body;

    await pool.query(
      `UPDATE payments SET payment_date = ?, payment_method = ?, amount = ?, final_amount = ? WHERE payment_id = ?`,
      [payment_date, payment_method, amount, final_amount, paymentId]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error });
  }
}
