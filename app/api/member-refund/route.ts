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

    // ── 회원 존재 확인 (트랜잭션 밖, 불변 필드) ─────────────
    const [memberRows]: any = await pool.query(
      `SELECT * FROM members WHERE member_id = ? LIMIT 1`,
      [member_id]
    );
    if (memberRows.length === 0) {
      return NextResponse.json({ success: false, message: "회원을 찾을 수 없습니다." }, { status: 404 });
    }
    const member = memberRows[0];
    const createdBy = user.login_id || "관리자";

    // ── 트랜잭션: 원결제 최신 상태 잠금 후 모든 검증 ──────────
    // 주의: 원결제를 트랜잭션 밖에서 미리 읽지 않는다.
    //       잠금 전 조회 → 잠금 후 취소 완료 → 취소 전 금액으로 환불 승인이 되는
    //       레이스 컨디션을 차단하기 위해, 원결제의 모든 필드를 FOR UPDATE 직후
    //       최신 값으로 읽어 검증한다.
    let insertedPaymentId = 0;

    await withMemberChange(
      {
        type: "REFUND",
        reason: refund_reason || "회원 환불",
        source: "member-refund",
        actor: createdBy,
      },
      async (conn) => {
        // 1. 원결제 행 배타 잠금 + 최신 필드 전체 읽기
        //    이 시점 이후 같은 행의 취소·환불·DAILY 삭제는 대기함
        const [lockedRows]: any = await conn.query(
          `SELECT * FROM payments WHERE payment_id = ? AND member_id = ? FOR UPDATE`,
          [payment_id, member_id]
        );
        if (lockedRows.length === 0) {
          throw Object.assign(new Error("PAYMENT_NOT_FOUND"), {});
        }
        // 트랜잭션 밖 스냅샷 사용 금지: 잠금 직후 최신값으로 모든 검증 수행
        const lockedPayment = lockedRows[0];

        // 2. 지점 권한 재검증 (잠금 후 최신 branch_name 기준)
        if (!canAccessBranch(user.role, user.branch_name, lockedPayment.branch_name)) {
          throw Object.assign(new Error("ACCESS_DENIED"), {});
        }

        // 3. 취소된 원결제 명시적 거부 (final_amount=0 & refund_amount>0)
        //    취소 후 remaining = 0 → OVER_REFUND로도 걸리지만, 명확한 거부 메시지 제공
        if (Number(lockedPayment.final_amount) === 0 && Number(lockedPayment.refund_amount) > 0) {
          throw Object.assign(new Error("PAYMENT_CANCELLED"), {});
        }

        // 4. 출처 불명 환불 감지 (잠금 후 최신 읽기)
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

        // 5. 이 원결제에 연결된 환불 누계 계산 (잠금 후 최신 읽기, 두 경로 중복 없이 합산)
        const { sql: memoSql, params: memoParams } = refundMemoCondition(Number(payment_id));
        const [memoRefunds]: any = await conn.query(
          `SELECT COALESCE(SUM(ABS(final_amount)), 0) AS total
           FROM payments
           WHERE member_id = ? AND history_type = 'REFUND' AND ${memoSql}
           LOCK IN SHARE MODE`,
          [member_id, ...memoParams]
        );

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
        // 잠금 후 최신 final_amount 사용 (트랜잭션 밖 스냅샷 금지)
        const originalFinalAmount = Number(lockedPayment.final_amount);
        const remaining = originalFinalAmount - alreadyRefunded;

        if (Number(refund_amount) > remaining) {
          throw Object.assign(new Error("OVER_REFUND"), {
            remaining,
            alreadyRefunded,
            originalFinalAmount,
          });
        }

        // 6. 환불 결제 기록 — 메모에 원결제 ID 저장 (source_payment_id 컬럼 없으므로 메모 패턴 사용)
        const memo = `[환불] 원결제 #${payment_id}${refund_reason ? ` — ${refund_reason}` : ""}`;
        const [paymentResult]: any = await conn.query(
          `INSERT INTO payments (
            member_id, branch_name, payment_date, payment_method,
            product_name, pass_type, amount, discount_amount,
            refund_amount, final_amount, operator_name, history_type, memo,
            payment_purpose
          ) VALUES (?, ?, CURDATE(), ?, ?, ?, 0, 0, ?, ?, ?, 'REFUND', ?, 'REFUND')`,
          [
            member_id,
            lockedPayment.branch_name,
            payment_method || "TRANSFER",
            lockedPayment.product_name,
            lockedPayment.pass_type,
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
    if (error?.message === "PAYMENT_NOT_FOUND") {
      return NextResponse.json({ success: false, message: "해당 회원의 결제 내역을 찾을 수 없습니다." }, { status: 404 });
    }
    if (error?.message === "ACCESS_DENIED") {
      return NextResponse.json({ success: false, message: "해당 지점에 대한 권한이 없습니다." }, { status: 403 });
    }
    if (error?.message === "PAYMENT_CANCELLED") {
      return NextResponse.json({
        success: false,
        message: "이미 취소된 결제입니다. 취소된 결제는 환불할 수 없습니다.",
      }, { status: 409 });
    }
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
