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

    // ── DAILY 결제 취소: payments 행 보존 + refund 기록, day_pass CANCELLED ──
    // PERIOD/COUNT는 기존 행 삭제 방식 유지; DAILY만 상태 변경 방식
    if (payment.pass_type === "DAILY") {
      // 이미 취소된 결제인지 확인 (refund_amount == final_amount)
      if (Number(payment.refund_amount) >= Number(payment.final_amount) && Number(payment.final_amount) > 0) {
        return NextResponse.json({ success: false, message: "이미 취소된 결제입니다." });
      }

      const conn = await (pool as any).getConnection();
      try {
        await conn.beginTransaction();
        const [dpRows]: any = await conn.query(
          "SELECT pass_id, status, attendance_id FROM day_passes WHERE payment_id = ? FOR UPDATE",
          [payment_id]
        );
        if (dpRows.length > 0 && dpRows[0].status === "USED") {
          await conn.rollback();
          return NextResponse.json({
            success: false,
            message: "이미 사용된 일일권입니다. 출석 기록을 먼저 취소한 후 결제 취소를 진행해주세요.",
            attendance_id: dpRows[0].attendance_id,
          });
        }

        const cancelNote = `[결제취소 ${new Date(Date.now() + 9*3600000).toISOString().slice(0,10)}]`;
        await conn.query(
          `UPDATE payments SET refund_amount = final_amount, memo = CONCAT(COALESCE(memo,''), ' ', ?) WHERE payment_id = ?`,
          [cancelNote, payment_id]
        );

        if (dpRows.length > 0) {
          await conn.query("UPDATE day_passes SET status='CANCELLED' WHERE pass_id=?", [dpRows[0].pass_id]);
        }
        await conn.commit();
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }
      return NextResponse.json({ success: true, message: "일일권 결제 취소 완료" });
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
