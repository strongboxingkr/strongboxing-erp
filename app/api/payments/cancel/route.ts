import { NextResponse } from "next/server";
import { withMemberChange } from "@/lib/membership-ops";
import { getUserFromRequest } from "@/lib/auth";

/**
 * 원결제에 이미 연결된 REFUND 행이 있으면 취소(final_amount=0) 거부.
 * 이유: 부분환불 후 취소 → SUM(final_amount) = 0 + (-환불액) = 이중 차감.
 * conn: 트랜잭션 커넥션 (FOR UPDATE 직렬화 보장)
 */
async function assertNoRefundRows(conn: any, paymentId: number, memberId: number) {
  const exact = `[환불] 원결제 #${paymentId}`;
  const withReason = `[환불] 원결제 #${paymentId} — %`;
  const [refundRows]: any = await conn.query(
    `SELECT COALESCE(SUM(ABS(final_amount)),0) AS total_refunded, COUNT(*) AS cnt
     FROM payments
     WHERE member_id = ? AND history_type = 'REFUND'
       AND (memo = ? OR memo LIKE ?)
     LOCK IN SHARE MODE`,
    [memberId, exact, withReason]
  );
  const cnt = Number(refundRows[0].cnt);
  const total = Number(refundRows[0].total_refunded);
  if (cnt > 0) {
    throw Object.assign(new Error("REFUND_EXISTS"), { cnt, total });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ success: false, message: "로그인이 필요합니다." }, { status: 401 });

    const { payment_id } = await req.json();
    if (!payment_id) return NextResponse.json({ success: false, message: "payment_id 없음" });

    let result: any = { success: false };

    await withMemberChange(
      {
        type: "CANCEL",
        reason: "결제 취소",
        source: "payments/cancel",
        refType: "payment",
        refId: Number(payment_id),
        actor: user.name || user.login_id || "직원",
      },
      async (conn) => {
        const [rows]: any = await conn.query(
          "SELECT * FROM payments WHERE payment_id = ?",
          [payment_id]
        );
        if (rows.length === 0) {
          result = { success: false, message: "결제 없음" };
          return;
        }

        const payment = rows[0];

        // 지점 권한 체크
        const isAdminOrOwner = user.role === "ADMIN" || user.role === "OWNER";
        if (!isAdminOrOwner && payment.branch_name !== user.branch_name) {
          result = { success: false, message: "권한이 없습니다." };
          return;
        }

        // 이미 취소된 결제 재취소 방지
        if (Number(payment.final_amount) === 0 && Number(payment.refund_amount) > 0) {
          result = { success: false, message: "이미 취소된 결제입니다." };
          return;
        }

        // GENERAL 결제 (pass_type IS NULL): payments만 취소, members 절대 불변
        const isPassPayment =
          payment.pass_type !== null &&
          payment.pass_type !== undefined &&
          payment.pass_type !== "";

        if (!isPassPayment) {
          // 이미 연결된 환불 행이 있으면 취소 거부 (이중 차감 방지)
          await assertNoRefundRows(conn, Number(payment_id), Number(payment.member_id));
          await conn.query(
            "UPDATE payments SET memo = CONCAT('[취소] ', IFNULL(memo, '')), refund_amount = final_amount, final_amount = 0 WHERE payment_id = ?",
            [payment_id]
          );
          result = {
            success: true,
            message: "일반 결제 취소 완료",
            members_updated: false,
          };
          return;
        }

        // PASS 결제: 현재 활성 회원권과 이 결제가 동일한지 확인
        const [memberRows]: any = await conn.query(
          "SELECT * FROM members WHERE member_id = ?",
          [payment.member_id]
        );

        if (memberRows.length === 0) {
          // 회원 없으면 payment만 취소 (환불 사전검사 포함)
          await assertNoRefundRows(conn, Number(payment_id), Number(payment.member_id));
          await conn.query(
            "UPDATE payments SET memo = CONCAT('[취소] ', IFNULL(memo, '')), refund_amount = final_amount, final_amount = 0 WHERE payment_id = ?",
            [payment_id]
          );
          result = { success: true, message: "결제 취소 완료 (회원 없음)", members_updated: false };
          return;
        }

        const member = memberRows[0];
        const payStart = payment.start_date ? String(payment.start_date).slice(0, 10) : null;
        const payEnd = payment.end_date ? String(payment.end_date).slice(0, 10) : null;
        const memStart = member.start_date ? String(member.start_date).slice(0, 10) : null;
        const memEnd = member.end_date ? String(member.end_date).slice(0, 10) : null;

        const isCurrentMembership =
          member.product_name === payment.product_name &&
          payStart === memStart &&
          payEnd === memEnd;

        // 환불 사전검사 후 payment 취소 처리
        await assertNoRefundRows(conn, Number(payment_id), Number(payment.member_id));
        await conn.query(
          "UPDATE payments SET memo = CONCAT('[취소] ', IFNULL(memo, '')), refund_amount = final_amount, final_amount = 0 WHERE payment_id = ?",
          [payment_id]
        );

        if (!isCurrentMembership) {
          // 재결제 후 이전 결제 취소: 현재 회원권 절대 건드리지 않음
          result = {
            success: true,
            message: "결제 취소 완료",
            members_updated: false,
            warning: "현재 활성 회원권과 다른 결제입니다. 회원권에는 변경이 없습니다. 수동 확인 필요",
          };
          return;
        }

        // 현재 회원권과 일치: 명시적 EXPIRED 처리 + 회원권 필드 초기화
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

        result = {
          success: true,
          message: "회원권 결제 취소 완료. 회원이 EXPIRED 처리됐습니다.",
          members_updated: true,
        };
      }
    );

    return NextResponse.json(result);
  } catch (error: any) {
    if (error?.message === "REFUND_EXISTS") {
      return NextResponse.json(
        {
          success: false,
          message: `이 결제에 이미 환불 기록 ${error.cnt}건(합계 ${error.total}원)이 연결되어 있습니다. ` +
            `취소(전액 0 처리) 시 집계 이중 차감이 발생합니다. ` +
            `환불 기록을 먼저 확인하고, 필요 시 관리자가 직접 처리해 주세요.`,
          refund_count: error.cnt,
          refund_total: error.total,
        },
        { status: 409 }
      );
    }
    return NextResponse.json({ success: false, message: "취소 처리 실패", error });
  }
}
