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
      // 이미 취소된 결제인지 확인: bb7dc74 이후 final_amount=0으로 판별
      const alreadyCancelled =
        Number(payment.final_amount) === 0 && Number(payment.refund_amount) > 0;
      if (alreadyCancelled) {
        return NextResponse.json({ success: false, message: "이미 취소된 결제입니다." });
      }

      const conn = await (pool as any).getConnection();
      try {
        await conn.beginTransaction();

        // 원결제 행 배타 잠금 + 최신 상태 재읽기
        // 트랜잭션 밖 사전체크(alreadyCancelled)는 초기 필터용이며,
        // 잠금 후 최신 값으로 취소 여부를 반드시 재검증한다
        const [lockedPayment]: any = await conn.query(
          `SELECT final_amount, refund_amount, member_id FROM payments WHERE payment_id = ? FOR UPDATE`,
          [payment_id]
        );
        if (!lockedPayment.length) {
          await conn.rollback();
          return NextResponse.json({ success: false, message: "결제 내역 없음" });
        }
        const lp = lockedPayment[0];
        if (Number(lp.final_amount) === 0 && Number(lp.refund_amount) > 0) {
          await conn.rollback();
          return NextResponse.json({ success: false, message: "이미 취소된 결제입니다." });
        }

        // 환불 행 존재 검사 (잠금 후, 같은 트랜잭션 최신 읽기)
        const exactMemo = `[환불] 원결제 #${payment_id}`;
        const likeMemo = `[환불] 원결제 #${payment_id} — %`;
        const [refundCheck]: any = await conn.query(
          `SELECT COALESCE(SUM(ABS(final_amount)),0) AS total_refunded, COUNT(*) AS cnt
           FROM payments
           WHERE member_id = ? AND history_type = 'REFUND'
             AND (memo = ? OR memo LIKE ?)
           FOR UPDATE`,
          [lp.member_id, exactMemo, likeMemo]
        );
        if (Number(refundCheck[0].cnt) > 0) {
          await conn.rollback();
          return NextResponse.json({
            success: false,
            message: `이 결제에 이미 환불 기록 ${refundCheck[0].cnt}건(합계 ${refundCheck[0].total_refunded}원)이 있습니다. ` +
              `취소 시 이중 차감 위험 — 환불 기록을 먼저 확인해 주세요.`,
            refund_count: refundCheck[0].cnt,
            refund_total: refundCheck[0].total_refunded,
          }, { status: 409 });
        }

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
        // refund_amount = final_amount 먼저 (MySQL SET 순서: 왼쪽부터 평가),
        // 그 다음 final_amount = 0 → 집계에서 제외, 원금은 refund_amount에 보존
        await conn.query(
          `UPDATE payments SET refund_amount = final_amount, final_amount = 0, memo = CONCAT(COALESCE(memo,''), ' ', ?) WHERE payment_id = ?`,
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

    // PASS/PERIOD/COUNT 삭제: 트랜잭션 안에서 잠금 후 최신 상태 재검증
    await withMemberChange(
      { type: "DELETE", reason: "결제 삭제", source: "payments/delete", actor: user.login_id || "관리자" },
      async (conn) => {
        // 원결제 배타 잠금 + 최신 상태 재읽기 (취소/환불 여부 재검증)
        const [lockedRows]: any = await conn.query(
          `SELECT final_amount, refund_amount, history_type, member_id, product_name, end_date FROM payments WHERE payment_id = ? FOR UPDATE`,
          [payment_id]
        );
        if (!lockedRows.length) throw Object.assign(new Error("NOT_FOUND"), {});
        const lp = lockedRows[0];
        if (Number(lp.final_amount) === 0 && Number(lp.refund_amount) > 0) {
          throw Object.assign(new Error("ALREADY_CANCELLED"), {});
        }
        if (lp.history_type === "REFUND") {
          throw Object.assign(new Error("IS_REFUND"), {});
        }

        // 환불 행 존재 검사
        const exactMemo = `[환불] 원결제 #${payment_id}`;
        const likeMemo = `[환불] 원결제 #${payment_id} — %`;
        const [refundCheck]: any = await conn.query(
          `SELECT COUNT(*) AS cnt FROM payments
           WHERE member_id = ? AND history_type = 'REFUND' AND (memo = ? OR memo LIKE ?)
           FOR UPDATE`,
          [lp.member_id, exactMemo, likeMemo]
        );
        if (Number(refundCheck[0].cnt) > 0) {
          throw Object.assign(new Error("REFUND_EXISTS"), { cnt: refundCheck[0].cnt });
        }

        // 현재 회원권과 일치 여부 확인
        const [memberRows]: any = await conn.query(
          `SELECT * FROM members WHERE member_id = ? LIMIT 1`,
          [lp.member_id]
        );
        const member = memberRows[0] || null;
        const isPass = payment.pass_type != null;
        const isCurrentPass = isPass && member &&
          member.product_name === lp.product_name &&
          (member.end_date?.slice(0, 10) === lp.end_date?.slice(0, 10) || !member.end_date);

        await conn.query(`DELETE FROM payments WHERE payment_id = ?`, [payment_id]);

        if (isCurrentPass && member) {
          await conn.query(
            `UPDATE members
             SET status = 'EXPIRED',
                 product_name = NULL,
                 pass_type = NULL,
                 remaining_count = 0,
                 start_date = NULL,
                 end_date = NULL
             WHERE member_id = ?`,
            [lp.member_id]
          );
        }
      }
    );

    return NextResponse.json({ success: true, message: "결제 삭제 완료" });
  } catch (error: any) {
    if (error?.message === "NOT_FOUND") {
      return NextResponse.json({ success: false, message: "결제 내역 없음" }, { status: 404 });
    }
    if (error?.message === "ALREADY_CANCELLED") {
      return NextResponse.json({ success: false, message: "이미 취소된 결제입니다." }, { status: 409 });
    }
    if (error?.message === "IS_REFUND") {
      return NextResponse.json({ success: false, message: "환불 기록은 삭제할 수 없습니다." }, { status: 409 });
    }
    if (error?.message === "REFUND_EXISTS") {
      return NextResponse.json({
        success: false,
        message: `이 결제에 환불 기록 ${error.cnt}건이 연결되어 있습니다. 환불 기록을 먼저 확인해 주세요.`,
      }, { status: 409 });
    }
    return NextResponse.json({ success: false, message: "결제 삭제 실패", error });
  }
}
