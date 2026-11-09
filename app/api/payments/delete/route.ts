import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { withMemberChange } from "@/lib/membership-ops";
import { getUserFromRequest } from "@/lib/auth";

export async function DELETE(req: Request) {
  try {
    const user = await getUserFromRequest(req);

    if (!user) return NextResponse.json({ success: false, message: "로그인이 필요합니다." }, { status: 401 });

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

    // 삭제할 결제가 PASS이고 현재 회원 패스와 일치하는지 확인
    const isPass = payment.pass_type != null;
    const [memberRows]: any = await pool.query(
      `SELECT * FROM members WHERE member_id = ? LIMIT 1`,
      [payment.member_id]
    );
    const member = memberRows[0] || null;
    const isCurrentPass = isPass && member &&
      member.product_name === payment.product_name &&
      (member.end_date?.slice(0, 10) === payment.end_date?.slice(0, 10) || !member.end_date);

    if (isCurrentPass && member) {
      await withMemberChange(
        { type: "DELETE", reason: "결제 삭제", source: "payments/delete", actor: user.login_id || "관리자" },
        async (conn) => {
          await conn.query(`DELETE FROM payments WHERE payment_id = ?`, [payment_id]);
          await conn.query(
            `UPDATE members
             SET status = 'EXPIRED',
                 product_name = NULL,
                 pass_type = NULL,
                 remaining_count = 0,
                 start_date = NULL,
                 end_date = NULL
             WHERE member_id = ?`,
            [payment.member_id]
          );
        }
      );
    } else {
      await pool.query(`DELETE FROM payments WHERE payment_id = ?`, [payment_id]);
    }

    return NextResponse.json({ success: true, message: "결제 삭제 완료" });
  } catch (error) {
    return NextResponse.json({ success: false, message: "결제 삭제 실패", error });
  }
}
