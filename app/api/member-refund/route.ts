import { NextResponse } from "next/server";
import { withMemberChange } from "@/lib/membership-ops";
import { getUserFromRequest, canAccessBranch } from "@/lib/auth";

function toDateStr(d: any): string | null {
  if (!d) return null;
  return String(d).slice(0, 10);
}

export async function POST(req: Request) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ success: false, message: "로그인이 필요합니다." }, { status: 401 });

    const body = await req.json();
    const {
      member_id,
      payment_id,   // 원결제 ID (필수)
      refund_amount,
      refund_reason,
      payment_method,
      terminate_pass, // true: 회원권 해지도 함께 처리 (정책 조건 충족 시)
    } = body;

    if (!member_id || !payment_id || !refund_amount) {
      return NextResponse.json({
        success: false,
        message: "member_id, payment_id, refund_amount는 필수입니다.",
      });
    }
    if (Number(refund_amount) <= 0) {
      return NextResponse.json({ success: false, message: "환불 금액은 0보다 커야 합니다." });
    }

    // ── 원결제 조회 (지점 권한 확인용) ──────────────────────
    // withMemberChange 트랜잭션 밖에서 먼저 읽어 권한 체크
    // conn 없이 pool 직접 사용 — 쓰기 없으므로 안전
    const { default: pool } = await import("@/lib/db");

    const [payRows]: any = await pool.query(
      `SELECT * FROM payments WHERE payment_id = ? AND member_id = ? LIMIT 1`,
      [payment_id, member_id]
    );
    if (payRows.length === 0) {
      return NextResponse.json({
        success: false,
        message: "해당 회원의 결제 내역을 찾을 수 없습니다.",
      });
    }
    const originalPayment = payRows[0];

    if (!canAccessBranch(user.role, user.branch_name, originalPayment.branch_name)) {
      return NextResponse.json({
        success: false,
        message: "해당 지점에 대한 권한이 없습니다.",
      }, { status: 403 });
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

    // 현재 회원권이 이 원결제로 등록된 것인지 판단
    // product_name + start_date + end_date 세 필드가 모두 일치해야 현재 패스로 간주
    const isCurrentPass = isPassPayment && (
      originalPayment.product_name === member.product_name &&
      toDateStr(originalPayment.start_date) === toDateStr(member.start_date) &&
      toDateStr(originalPayment.end_date) === toDateStr(member.end_date)
    );

    let refundResult: {
      payment_id: number;
      passUpdated: boolean;
      passUpdateSkipReason: string | null;
      requiresManualReview: boolean;
    } = {
      payment_id: 0,
      passUpdated: false,
      passUpdateSkipReason: null,
      requiresManualReview: false,
    };

    await withMemberChange(
      {
        type: "REFUND",
        reason: refund_reason || "회원 환불",
        source: "member-refund",
        actor: createdBy,
      },
      async (conn) => {
        // ── 1. 원결제 선점 잠금 + 초과 환불 방지 ─────────────
        await conn.query(
          `SELECT final_amount FROM payments WHERE payment_id = ? FOR UPDATE`,
          [payment_id]
        );
        const originalFinalAmount = Number(originalPayment.final_amount);

        // 기존 환불 누계: 메모 패턴으로 연결된 환불 합산
        const memoPattern = `[환불] 원결제 #${payment_id}%`;
        const [prevRefunds]: any = await conn.query(
          `SELECT COALESCE(SUM(ABS(final_amount)), 0) AS total_refunded
           FROM payments
           WHERE member_id = ? AND history_type = 'REFUND' AND memo LIKE ?`,
          [member_id, memoPattern]
        );
        const alreadyRefunded = Number(prevRefunds[0].total_refunded);
        const remaining = originalFinalAmount - alreadyRefunded;

        if (Number(refund_amount) > remaining) {
          throw Object.assign(new Error("OVER_REFUND"), {
            remaining,
            alreadyRefunded,
            originalFinalAmount,
          });
        }

        // ── 2. 환불 결제 기록 삽입 ────────────────────────────
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
        const insertedPaymentId = paymentResult.insertId;

        await conn.query(
          `SET @sbm_change_ref_type = 'payment', @sbm_change_ref_id = ?`,
          [insertedPaymentId]
        );

        // ── 3. 회원권 상태 변경 — 정책 조건부 ───────────────
        let passUpdated = false;
        let passUpdateSkipReason: string | null = null;

        if (terminate_pass) {
          if (!isPassPayment) {
            // GENERAL 결제 환불은 회원권 변경 없음
            passUpdateSkipReason = "GENERAL 결제 환불은 회원권을 변경하지 않습니다.";
          } else if (!isCurrentPass) {
            // 과거 결제 환불이고 현재 회원권이 다른 결제로 갱신된 상태
            passUpdateSkipReason =
              "이 결제는 현재 활성 회원권과 다릅니다. 현재 회원권은 변경되지 않았습니다.";
          } else {
            // 현재 패스이고 terminate_pass=true → 만료 처리
            await conn.query(
              `UPDATE members
               SET status = 'EXPIRED', product_name = NULL, pass_type = NULL,
                   remaining_count = 0, start_date = NULL, end_date = NULL
               WHERE member_id = ?`,
              [member_id]
            );
            passUpdated = true;
          }
        }

        // ── 4. 이력 기록 ─────────────────────────────────────
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
              passUpdateSkipReason,
            }),
            createdBy,
          ]
        );

        refundResult = {
          payment_id: insertedPaymentId,
          passUpdated,
          passUpdateSkipReason,
          requiresManualReview: !!(terminate_pass && !passUpdated && passUpdateSkipReason),
        };
      }
    );

    // 회원권 변경을 요청했으나 처리 불가 → 전체 성공 반환 금지
    // 환불 기록은 이미 커밋됨 (payment_id 포함 반환)
    if (refundResult.requiresManualReview) {
      return NextResponse.json(
        {
          success: false,
          message: `환불은 기록됐으나 회원권 상태를 자동 변경할 수 없습니다: ${refundResult.passUpdateSkipReason}`,
          payment_id: refundResult.payment_id,
          requiresManualReview: true,
          passUpdateSkipReason: refundResult.passUpdateSkipReason,
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "환불 처리 완료",
      payment_id: refundResult.payment_id,
      passUpdated: refundResult.passUpdated,
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
