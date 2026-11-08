import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { taggedQuery } from "@/lib/membership-ops";

export async function POST(req: Request) {
  try {
    const { payment_id } = await req.json();
    if (!payment_id) return NextResponse.json({ success: false, message: "payment_id 없음" });

    const [rows]: any = await pool.query(
      "SELECT * FROM payments WHERE payment_id = ?",
      [payment_id]
    );
    if (rows.length === 0) return NextResponse.json({ success: false, message: "결제 없음" });

    const payment = rows[0];

    // 결제 취소 처리 (삭제 대신 status 표시를 위해 memo에 취소 기록)
    await pool.query(
      "UPDATE payments SET memo = CONCAT('[취소] ', IFNULL(memo, '')), refund_amount = final_amount, final_amount = 0 WHERE payment_id = ?",
      [payment_id]
    );

    // 해당 회원의 마지막 결제가 이거라면 상태를 EXPIRED로
    const [lastPayRows]: any = await pool.query(
      "SELECT payment_id FROM payments WHERE member_id = ? AND final_amount > 0 ORDER BY payment_id DESC LIMIT 1",
      [payment.member_id]
    );

    if (lastPayRows.length === 0) {
      await taggedQuery({ type: "CANCEL", reason: "결제 취소", source: "payments/cancel", refType: "payment", refId: Number(payment_id), actor: "직원" },
        "UPDATE members SET status = 'EXPIRED' WHERE member_id = ?",
        [payment.member_id]
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error });
  }
}
