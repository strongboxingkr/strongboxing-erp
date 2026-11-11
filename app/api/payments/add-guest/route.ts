import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest, canAccessBranch } from "@/lib/auth";
import { resolveGuestIdempotencyConflict } from "@/lib/payment-guard";

export async function POST(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    const {
      branch_name, payment_date, payment_method, product_name, final_amount, memo,
      use_date: use_date_input, // 일일권 지정 이용일 (없으면 KST 오늘)
      guest_name,               // 비회원 성명 (일일권 추적용)
      guest_phone,              // 비회원 연락처
      idempotency_key,
    } = body;

    // idempotency_key 중복 확인
    if (idempotency_key) {
      const [existing]: any = await pool.query(
        `SELECT payment_id, product_name, final_amount FROM payments WHERE idempotency_key = ? LIMIT 1`,
        [idempotency_key]
      );
      if (existing.length > 0) {
        const prev = existing[0];
        const contentMismatch =
          Number(prev.final_amount) !== Number(final_amount) ||
          (prev.product_name || null) !== (product_name || null);
        if (contentMismatch) {
          return NextResponse.json({
            success: false,
            message: "동일한 idempotency_key로 다른 결제 내용이 이미 처리됐습니다. 새 키를 사용해주세요.",
          }, { status: 409 });
        }
        return NextResponse.json({
          success: true,
          message: "결제 완료 (중복 요청 — 기존 결과 반환)",
          payment_id: prev.payment_id,
          idempotent: true,
        });
      }
    }

    if (branch_name && !canAccessBranch(user.role, user.branch_name, branch_name)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!branch_name) return NextResponse.json({ success: false, message: "지점 선택 필요" });
    if (!product_name) return NextResponse.json({ success: false, message: "상품 선택 필요" });
    if (final_amount === undefined || final_amount === null || final_amount === "") return NextResponse.json({ success: false, message: "금액 입력 필요" });

    // 상품이 일일권(DAILY)인지 확인
    const [productRows]: any = await pool.query(
      `SELECT option_value FROM settings_options WHERE option_type='PASS_PRODUCT' AND option_name=? AND use_yn='Y' LIMIT 1`,
      [product_name]
    );
    const isDailyPass = productRows[0]?.option_value === "DAILY";

    const kstToday = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
    const payDate = payment_date || kstToday;
    const useDate = use_date_input ? String(use_date_input).slice(0, 10) : kstToday;

    try {
      if (isDailyPass) {
        // 비회원 일일권: 결제 기록만 저장 (입장코드·출석 처리 없음)
        const [result]: any = await pool.query(
          `INSERT INTO payments (member_id, branch_name, payment_date, payment_method, product_name, pass_type, total_count, start_date, end_date, amount, discount_amount, refund_amount, final_amount, memo, idempotency_key, payment_purpose)
           VALUES (NULL, ?, ?, ?, ?, 'DAILY', 1, ?, NULL, ?, 0, 0, ?, ?, ?, 'PASS')`,
          [branch_name, payDate, payment_method || "CARD", product_name, useDate, final_amount, final_amount, memo || "비회원 일일권", idempotency_key || null]
        );
        return NextResponse.json({ success: true, message: "비회원 일일권 등록 완료", payment_id: result.insertId });
      }

      // 일반 비회원 결제 (non-DAILY)
      const [result]: any = await pool.query(
        `INSERT INTO payments (member_id, branch_name, payment_date, payment_method, product_name, pass_type, amount, discount_amount, refund_amount, final_amount, memo, idempotency_key, payment_purpose)
         VALUES (NULL, ?, ?, ?, ?, 'PERIOD', ?, 0, 0, ?, ?, ?, 'GENERAL')`,
        [branch_name, payDate, payment_method || "CARD", product_name, final_amount, final_amount, memo || "비회원", idempotency_key || null]
      );
      return NextResponse.json({ success: true, message: "비회원 결제 등록 완료", payment_id: result.insertId });
    } catch (insertError: any) {
      // UNIQUE 충돌(동시 요청 경쟁): idempotency_key로 기존 결과 조회
      if ((insertError.code === "ER_DUP_ENTRY" || insertError.errno === 1062) && idempotency_key) {
        const [dupeRows]: any = await pool.query(
          `SELECT payment_id, final_amount, product_name, branch_name FROM payments WHERE idempotency_key = ? LIMIT 1`,
          [idempotency_key]
        );
        if (dupeRows.length > 0) {
          const verdict = resolveGuestIdempotencyConflict(dupeRows[0], { final_amount, product_name, branch_name: branch_name || "" });
          if (verdict === "BRANCH_MISMATCH") {
            // 500 반환 시 클라이언트가 uncertain으로 판정해 무한 재시도 → 409로 명확히 거부
            // branch 정보 미노출: 메시지에 지점명·결제 내용 포함 금지
            return NextResponse.json({ success: false, message: "결제 등록 실패" }, { status: 409 });
          }
          if (verdict === "CONFLICT") {
            return NextResponse.json({ success: false, message: "동일한 idempotency_key로 다른 결제 내용이 이미 처리됐습니다." }, { status: 409 });
          }
          return NextResponse.json({ success: true, message: "결제 완료 (중복 요청 — 기존 결과 반환)", payment_id: dupeRows[0].payment_id, idempotent: true });
        }
      }
      throw insertError;
    }
  } catch (error) {
    return NextResponse.json({ success: false, message: "결제 등록 실패", error });
  }
}
