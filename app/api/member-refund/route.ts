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
      terminate_pass,  // 항상 거부: 현재 스키마로 신뢰할 수 있는 회원권 연결 불가
    } = body;

    if (!member_id || !payment_id || !refund_amount) {
      return NextResponse.json({ success: false, message: "member_id, payment_id, refund_amount는 필수입니다." });
    }
    if (Number(refund_amount) <= 0) {
      return NextResponse.json({ success: false, message: "환불 금액은 0보다 커야 합니다." });
    }

    // ── terminate_pass: 현재 스키마로 신뢰할 수 있는 회원권 연결 확인 불가 → 항상 거부 ─
    // 상품명·시작일·종료일 3-field 비교는 같은 상품 재등록 시 오식별 가능.
    // 금액 환불 후 회원 수정 화면에서 회원권을 별도로 조정해야 한다.
    if (terminate_pass) {
      return NextResponse.json({
        success: false,
        message:
          "회원권 자동 해지는 현재 지원하지 않습니다. " +
          "현재 스키마에서 원결제와 현재 회원권의 연결을 신뢰할 수 있게 확인할 수 없습니다 " +
          "(상품명·시작일·종료일 3-field 비교는 재등록 케이스에서 오식별 위험). " +
          "금액 환불 후 회원 수정 화면에서 회원권을 별도로 조정해 주세요.",
        hint: "terminate_pass=false 로 금액 환불만 가능합니다.",
      }, { status: 409 });
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

    // ── 트랜잭션: 환불 누계 검증 + INSERT ─────────────────────
    let insertedPaymentId = 0;

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

        // 2. 출처 불명 환불 감지:
        //    메모에 '[환불] 원결제 #' 패턴이 없고 member_histories에도 source_payment_id가 없는 기록.
        //    이런 기록이 있으면 이 원결제의 환불 누계를 확정할 수 없으므로 거부한다.
        //    (불확실한 금액을 0으로 간주하지 않음)
        const [unlinkedRows]: any = await conn.query(
          `SELECT COUNT(*) AS cnt, COALESCE(SUM(ABS(p.final_amount)), 0) AS unlinked_total
           FROM payments p
           WHERE p.member_id = ?
             AND p.history_type = 'REFUND'
             AND p.memo NOT LIKE '[환불] 원결제 #%'
             AND NOT EXISTS (
               SELECT 1 FROM member_histories h
               WHERE h.member_id = p.member_id
                 AND h.action_type = 'REFUND'
                 AND JSON_UNQUOTE(JSON_EXTRACT(h.new_value, '$.payment_id')) = CAST(p.payment_id AS CHAR)
                 AND JSON_EXTRACT(h.new_value, '$.source_payment_id') IS NOT NULL
             )
           LOCK IN SHARE MODE`,
          [member_id]
        );
        if (Number(unlinkedRows[0].cnt) > 0) {
          throw Object.assign(new Error("UNLINKED_REFUND_HISTORY"), {
            unlinkedCount: Number(unlinkedRows[0].cnt),
            unlinkedTotal: Number(unlinkedRows[0].unlinked_total),
          });
        }

        // 3. 이 원결제에 연결된 환불 누계 계산 (두 경로 중복 없이 합산)
        //    경로 A: 메모 패턴 (새 형식)
        const { sql: memoSql, params: memoParams } = refundMemoCondition(Number(payment_id));
        const [memoRefunds]: any = await conn.query(
          `SELECT COALESCE(SUM(ABS(final_amount)), 0) AS total
           FROM payments
           WHERE member_id = ? AND history_type = 'REFUND' AND ${memoSql}
           LOCK IN SHARE MODE`,
          [member_id, ...memoParams]
        );

        //    경로 B: member_histories source_payment_id (메모 패턴 없는 구형 기록)
        const [historyRefunds]: any = await conn.query(
          `SELECT COALESCE(SUM(ABS(p.final_amount)), 0) AS total
           FROM payments p
           INNER JOIN member_histories h ON h.member_id = p.member_id
             AND h.action_type = 'REFUND'
             AND JSON_UNQUOTE(JSON_EXTRACT(h.new_value, '$.payment_id')) = CAST(p.payment_id AS CHAR)
             AND JSON_EXTRACT(h.new_value, '$.source_payment_id') = ?
           WHERE p.member_id = ?
             AND p.history_type = 'REFUND'
             AND NOT (${memoSql})
           LOCK IN SHARE MODE`,
          [Number(payment_id), member_id, ...memoParams]
        );

        const alreadyRefunded = Number(memoRefunds[0].total) + Number(historyRefunds[0].total);
        const originalFinalAmount = Number(originalPayment.final_amount);
        const remaining = originalFinalAmount - alreadyRefunded;

        if (Number(refund_amount) > remaining) {
          throw Object.assign(new Error("OVER_REFUND"), {
            remaining,
            alreadyRefunded,
            originalFinalAmount,
          });
        }

        // 4. 환불 결제 기록 — 메모에 원결제 ID 저장 (source_payment_id 컬럼 없으므로 메모 패턴 사용)
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

        // 5. 이력 — source_payment_id를 new_value에 기록 (추후 member_histories 경로 B 조회에 사용)
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
            }),
            createdBy,
          ]
        );
      }
    );

    return NextResponse.json({
      success: true,
      message: "환불 처리 완료",
      payment_id: insertedPaymentId,
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
    if (error?.message === "UNLINKED_REFUND_HISTORY") {
      return NextResponse.json(
        {
          success: false,
          message:
            `이 회원의 환불 이력 중 원결제를 확인할 수 없는 항목이 ${error.unlinkedCount}건 있어 환불 누계를 확정할 수 없습니다. ` +
            `관리자가 해당 환불 기록을 직접 확인한 후 처리해 주세요.`,
          unlinkedCount: error.unlinkedCount,
          unlinkedTotal: error.unlinkedTotal,
        },
        { status: 409 }
      );
    }
    console.error(error);
    return NextResponse.json({ success: false, message: "환불 처리 실패", error }, { status: 500 });
  }
}
