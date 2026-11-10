import { NextResponse } from "next/server";
import { withMemberChange } from "@/lib/membership-ops";
import { getUserFromRequest, canAccessBranch } from "@/lib/auth";

function toDateStr(d: any): string | null {
  if (!d) return null;
  return String(d).slice(0, 10);
}

/**
 * 환불 기록 메모 패턴에서 정확한 원결제 ID를 조회하는 SQL 조건과 파라미터를 반환한다.
 * LIKE '#42%'는 #420·#421도 매칭하므로 아래 두 패턴으로 정확히 구분한다:
 *   1) 사유 없음:  memo = '[환불] 원결제 #42'
 *   2) 사유 있음:  memo LIKE '[환불] 원결제 #42 — %'  (ID 뒤에 반드시 ' — ' 구분자)
 */
function refundMemoCondition(paymentId: number): { sql: string; params: (string | number)[] } {
  const exact = `[환불] 원결제 #${paymentId}`;
  const withReason = `[환불] 원결제 #${paymentId} — %`; // U+2014 em-dash
  return {
    sql: `(memo = ? OR memo LIKE ?)`,
    params: [exact, withReason],
  };
}

export async function POST(req: Request) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ success: false, message: "로그인이 필요합니다." }, { status: 401 });

    const body = await req.json();
    const {
      member_id,
      payment_id,      // 원결제 ID (필수)
      refund_amount,
      refund_reason,
      payment_method,
      terminate_pass,  // true: 금액 환불 + 회원권 해지. false/생략: 금액 환불만.
    } = body;

    if (!member_id || !payment_id || !refund_amount) {
      return NextResponse.json({ success: false, message: "member_id, payment_id, refund_amount는 필수입니다." });
    }
    if (Number(refund_amount) <= 0) {
      return NextResponse.json({ success: false, message: "환불 금액은 0보다 커야 합니다." });
    }

    const { default: pool } = await import("@/lib/db");

    // ── 원결제 조회 (지점 권한·금액 확인, 트랜잭션 밖) ─────
    const [payRows]: any = await pool.query(
      `SELECT * FROM payments WHERE payment_id = ? AND member_id = ? LIMIT 1`,
      [payment_id, member_id]
    );
    if (payRows.length === 0) {
      return NextResponse.json({ success: false, message: "해당 회원의 결제 내역을 찾을 수 없습니다." });
    }
    const originalPayment = payRows[0];

    if (!canAccessBranch(user.role, user.branch_name, originalPayment.branch_name)) {
      return NextResponse.json({ success: false, message: "해당 지점에 대한 권한이 없습니다." }, { status: 403 });
    }

    const [memberRows]: any = await pool.query(
      `SELECT * FROM members WHERE member_id = ? LIMIT 1`,
      [member_id]
    );
    if (memberRows.length === 0) {
      return NextResponse.json({ success: false, message: "회원을 찾을 수 없습니다." }, { status: 404 });
    }
    const member = memberRows[0];
    const createdBy = user.login_id || "관리자";

    const isPassPayment = !!(originalPayment.pass_type);

    // ── terminate_pass 사전 검증 (INSERT 전에 거부) ──────────
    // 이 블록에서 거부하면 DB에 아무것도 쓰지 않는다.
    if (terminate_pass) {
      if (!isPassPayment) {
        return NextResponse.json({
          success: false,
          message: "GENERAL 결제(회원권 아님)는 terminate_pass를 사용할 수 없습니다. 금액 환불만 가능합니다.",
        }, { status: 400 });
      }

      // 현재 회원권과의 연결 판단: 상품명 + 시작일 + 종료일 3-필드 일치 (best-effort)
      // 이 방법으로 "확정"이 아닌 "최선 추정"만 가능.
      // 같은 상품을 같은 날짜로 재등록한 경우 오식별 가능성 존재.
      const isCurrentPass =
        originalPayment.product_name === member.product_name &&
        toDateStr(originalPayment.start_date) === toDateStr(member.start_date) &&
        toDateStr(originalPayment.end_date) === toDateStr(member.end_date);

      if (!isCurrentPass) {
        return NextResponse.json({
          success: false,
          message:
            "원결제와 현재 회원권의 연결을 확인할 수 없습니다. " +
            "현재 회원권(상품명·기간)이 이 결제와 다릅니다. " +
            "회원권 해지 없이 금액만 환불하려면 terminate_pass를 false로 재요청해 주세요.",
          hint: "terminate_pass=false 로 금액 환불만 가능합니다.",
        }, { status: 409 });
      }
      // isCurrentPass=true 이어도 best-effort 식별임을 기록에 남김
    }

    // ── 트랜잭션: 환불 INSERT + (terminate_pass=true이면) members EXPIRED ─
    let insertedPaymentId = 0;
    let passUpdated = false;

    await withMemberChange(
      {
        type: "REFUND",
        reason: refund_reason || "회원 환불",
        source: "member-refund",
        actor: createdBy,
      },
      async (conn) => {
        // 1. 원결제 행 선점 잠금 — 같은 payment_id 동시 환불 직렬화
        await conn.query(
          `SELECT final_amount FROM payments WHERE payment_id = ? FOR UPDATE`,
          [payment_id]
        );
        // FOR UPDATE 이후의 non-locking SELECT는 스냅샷을 사용할 수 있으므로
        // 기존 환불 누계 조회에 LOCK IN SHARE MODE 추가 — 최신 커밋 데이터 읽기.
        // (MySQL InnoDB REPEATABLE READ에서 locking read는 최신 커밋 버전을 읽는다)
        const { sql: memoSql, params: memoParams } = refundMemoCondition(Number(payment_id));
        const [prevRefunds]: any = await conn.query(
          `SELECT COALESCE(SUM(ABS(final_amount)), 0) AS total_refunded
           FROM payments
           WHERE member_id = ? AND history_type = 'REFUND' AND ${memoSql}
           LOCK IN SHARE MODE`,
          [member_id, ...memoParams]
        );
        const alreadyRefunded = Number(prevRefunds[0].total_refunded);
        const originalFinalAmount = Number(originalPayment.final_amount);
        const remaining = originalFinalAmount - alreadyRefunded;

        if (Number(refund_amount) > remaining) {
          throw Object.assign(new Error("OVER_REFUND"), {
            remaining,
            alreadyRefunded,
            originalFinalAmount,
          });
        }

        // 2. 환불 결제 기록 — 메모에 원결제 ID 저장 (source_payment_id 컬럼 없으므로 메모 패턴 사용)
        const memo = `[환불] 원결제 #${payment_id}${refund_reason ? ` — ${refund_reason}` : ""}`;
        const [paymentResult]: any = await conn.query(
          `INSERT INTO payments (
            member_id, branch_name, payment_date, payment_method,
            product_name, pass_type, amount, discount_amount,
            refund_amount, final_amount, operator_name, history_type, memo
          ) VALUES (?, ?, CURDATE(), ?, ?, ?, 0, 0, ?, ?, ?, 'REFUND', ?)`,
          [
            member_id,
            originalPayment.branch_name,
            payment_method || "TRANSFER",
            originalPayment.product_name,
            originalPayment.pass_type,
            Number(refund_amount),
            -Math.abs(Number(refund_amount)),
            createdBy,
            memo,
          ]
        );
        insertedPaymentId = paymentResult.insertId;

        await conn.query(
          `SET @sbm_change_ref_type = 'payment', @sbm_change_ref_id = ?`,
          [insertedPaymentId]
        );

        // 3. 회원권 해지 — terminate_pass=true이고 isCurrentPass 확인된 경우만 도달
        if (terminate_pass) {
          await conn.query(
            `UPDATE members
             SET status = 'EXPIRED', product_name = NULL, pass_type = NULL,
                 remaining_count = 0, start_date = NULL, end_date = NULL
             WHERE member_id = ?`,
            [member_id]
          );
          passUpdated = true;
        }

        // 4. 이력 — source_payment_id와 식별 방법을 new_value에 기록
        await conn.query(
          `INSERT INTO member_histories (member_id, member_name, action_type, action_memo, old_value, new_value, created_by)
           VALUES (?, ?, 'REFUND', ?, ?, ?, ?)`,
          [
            member_id,
            member.name,
            refund_reason || "회원 환불",
            JSON.stringify({ ...member, _source_payment_id: payment_id }),
            JSON.stringify({
              refund_amount,
              refund_reason,
              payment_id: insertedPaymentId,
              source_payment_id: payment_id,
              passUpdated,
              passIdentificationBasis: passUpdated
                ? "product_name+start_date+end_date 3-field match (best-effort)"
                : null,
            }),
            createdBy,
          ]
        );
      }
    );

    return NextResponse.json({
      success: true,
      message: passUpdated ? "환불 및 회원권 해지 완료" : "환불 처리 완료",
      payment_id: insertedPaymentId,
      passUpdated,
      ...(passUpdated
        ? { passIdentificationWarning: "회원권 연결은 상품명·기간 일치 기반 추정입니다. 동일 상품 재등록 케이스에서 오식별 가능성이 있습니다." }
        : {}),
    });
  } catch (error: any) {
    if (error?.message === "OVER_REFUND") {
      return NextResponse.json(
        {
          success: false,
          message: `환불 가능 금액을 초과했습니다. 남은 환불 가능액: ${error.remaining}원 (원결제: ${error.originalFinalAmount}원, 기환불: ${error.alreadyRefunded}원)`,
        },
        { status: 409 }
      );
    }
    console.error(error);
    return NextResponse.json({ success: false, message: "환불 처리 실패", error }, { status: 500 });
  }
}
