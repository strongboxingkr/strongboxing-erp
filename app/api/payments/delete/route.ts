import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";

export async function DELETE(req: Request) {
  try {
    const user = getUserFromRequest(req);
    const { searchParams } = new URL(req.url);
    const payment_id = searchParams.get("payment_id");

    if (!payment_id) return NextResponse.json({ success: false, message: "payment_id 필요" });

    // 해당 결제 조회
    const [rows]: any = await pool.query(
      `SELECT * FROM payments WHERE payment_id = ?`,
      [payment_id]
    );
    if (!rows.length) return NextResponse.json({ success: false, message: "결제 내역 없음" });

    const payment = rows[0];

    // 관장은 자기 지점만 삭제 가능
    const isAdmin = user.role === "ADMIN" || user.role === "OWNER";
    if (!isAdmin && payment.branch_name !== user.branch_name) {
      return NextResponse.json({ success: false, message: "권한이 없습니다" });
    }

    await pool.query(`DELETE FROM payments WHERE payment_id = ?`, [payment_id]);

    return NextResponse.json({ success: true, message: "결제 삭제 완료" });
  } catch (error) {
    return NextResponse.json({ success: false, message: "결제 삭제 실패", error });
  }
}
