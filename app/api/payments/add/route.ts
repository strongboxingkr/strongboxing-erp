import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { withMemberChange } from "@/lib/membership-ops";
import { getErpUser } from "@/lib/erp-session";

function addDays(dateString: string, days: number) {
  const date = new Date(dateString);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function addMonths(dateString: string, months: number) {
  // 시작일 포함 30일 × 개월수 (이지스포 동일: 11/2 등록 → 12/1 만료)
  return addDays(dateString, months * 30 - 1);
}

export async function POST(req: Request) {
  try {
    const user = await getErpUser(req);
    if (!user) return NextResponse.json({ success: false, message: "로그인이 필요합니다." }, { status: 401 });

    const body = await req.json();

    const {
      member_id,
      branch_name,
      payment_date,
      start_date: start_date_input,
      use_date: use_date_input, // 일일권 전용: 지정 이용일 (없으면 KST 오늘)
      payment_method,
      product_name,
      payment_purpose, // "PASS" | "GENERAL" — 호출처가 명시적으로 전달
      amount,
      discount_amount,
      refund_amount,
      final_amount,
      memo,
      idempotency_key, // 클라이언트 발급 UUID (선택)
    } = body;

    if (!member_id) {
      return NextResponse.json({ success: false, message: "member_id가 필요합니다" });
    }

    // ── payment_purpose 명시 필수 ────────────────────────────────
    // 목적 불명시 + 상품명 있음: 과거엔 무조건 members UPDATE 했음 → 명시 요구
    // 목적 불명시 + 상품명 없음: 일반 결제로 안전하게 처리
    if (!payment_purpose && product_name) {
      return NextResponse.json({
        success: false,
        message: 'payment_purpose 필드가 필요합니다 ("PASS" 또는 "GENERAL"). 호출처를 확인해주세요.',
      });
    }

    const purpose: "PASS" | "GENERAL" =
      payment_purpose === "PASS" ? "PASS" : "GENERAL";

    // ── idempotency_key 중복 확인 ────────────────────────────────
    if (idempotency_key) {
      const [existing]: any = await pool.query(
        `SELECT payment_id, member_id, product_name, amount, payment_purpose
         FROM payments
         WHERE idempotency_key = ?
         LIMIT 1`,
        [idempotency_key]
      );
      if (existing.length > 0) {
        const prev = existing[0];
        // 같은 키로 다른 결제 내용(회원·금액·상품) 시도 → 거절
        const contentMismatch =
          String(prev.member_id) !== String(member_id) ||
          Number(prev.amount) !== Number(amount) ||
          (prev.product_name || null) !== (product_name || null);
        if (contentMismatch) {
          return NextResponse.json({
            success: false,
            message: "동일한 idempotency_key로 다른 결제 내용이 이미 처리됐습니다. 새 키를 사용해주세요.",
          });
        }
        // 같은 키 + 같은 내용 → 멱등 성공 반환
        return NextResponse.json({
          success: true,
          message: "결제 완료 (중복 요청 — 기존 결과 반환)",
          payment_id: prev.payment_id,
          idempotent: true,
        });
      }
    }

    const [memberRows]: any = await pool.query(
      "SELECT * FROM members WHERE member_id = ?",
      [member_id]
    );

    if (memberRows.length === 0) {
      return NextResponse.json({ success: false, message: "회원 없음" });
    }

    // ── 일반 결제: payments 기록만, members 갱신 없음 ──────────────
    if (purpose === "GENERAL") {
      // PASS_PRODUCT에 등록된 상품을 GENERAL로 보내면 거절
      // (클라이언트 버그 또는 의도적 우회 방지)
      if (product_name) {
        const [passCheck]: any = await pool.query(
          `SELECT option_id FROM settings_options
           WHERE option_type = 'PASS_PRODUCT' AND option_name = ? AND use_yn = 'Y'
           LIMIT 1`,
          [product_name]
        );
        if (passCheck.length > 0) {
          return NextResponse.json({
            success: false,
            message: `"${product_name}"은 회원권 상품입니다. payment_purpose를 "PASS"로 보내주세요.`,
          });
        }
      }

      await pool.query(
        `INSERT INTO payments
         (member_id, branch_name, payment_date, payment_method, product_name,
          pass_type, total_count, start_date, end_date,
          amount, discount_amount, refund_amount, final_amount, memo, idempotency_key)
         VALUES (?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, ?, ?, ?, ?, ?, ?)`,
        [
          member_id,
          branch_name,
          payment_date,
          payment_method,
          product_name || null,
          amount,
          discount_amount || 0,
          refund_amount || 0,
          final_amount ?? amount,
          memo || "",
          idempotency_key || null,
        ]
      );
      return NextResponse.json({ success: true, message: "결제 기록 완료" });
    }

    // ── 회원권 결제: 상품 검증 → 조건 계산 → 트랜잭션 ───────────

    if (!product_name) {
      return NextResponse.json({
        success: false,
        message: "회원권 결제에는 상품명이 필요합니다",
      });
    }

    const [productRows]: any = await pool.query(
      `SELECT *
       FROM settings_options
       WHERE option_type = 'PASS_PRODUCT'
       AND option_name = ?
       AND use_yn = 'Y'
       LIMIT 1`,
      [product_name]
    );

    const product = productRows[0] || null;

    if (!product) {
      return NextResponse.json({
        success: false,
        message: `상품 마스터에 없는 상품입니다: "${product_name}". 설정 > 상품 마스터를 확인해주세요.`,
      });
    }

    const pass_type: string = product.option_value || "";
    if (pass_type !== "PERIOD" && pass_type !== "COUNT" && pass_type !== "DAILY") {
      return NextResponse.json({
        success: false,
        message: `상품 "${product_name}"의 유형(PERIOD/COUNT/DAILY)이 설정되지 않았습니다. 상품 마스터를 수정해주세요.`,
      });
    }

    // ── 일일권(DAILY) 별도 처리 ───────────────────────────────────
    // members 테이블을 건드리지 않고 payments + day_passes에만 기록
    if (pass_type === "DAILY") {
      const kstToday = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
      const useDate = use_date_input ? String(use_date_input).slice(0, 10) : kstToday;

      // idempotency_key 중복 → 기존 결과 반환
      if (idempotency_key) {
        const [existing]: any = await pool.query(
          `SELECT payment_id FROM payments WHERE idempotency_key = ? LIMIT 1`,
          [idempotency_key]
        );
        if (existing.length > 0) {
          return NextResponse.json({ success: true, message: "일일권 등록 완료 (중복 요청)", idempotent: true });
        }
      }

      const conn = await (pool as any).getConnection();
      try {
        await conn.beginTransaction();

        const pSql = idempotency_key
          ? `INSERT IGNORE INTO payments (member_id, branch_name, payment_date, payment_method, product_name, pass_type, total_count, start_date, end_date, amount, discount_amount, refund_amount, final_amount, memo, idempotency_key) VALUES (?,?,?,?,?,'DAILY',1,?,NULL,?,?,?,?,?,?)`
          : `INSERT INTO payments (member_id, branch_name, payment_date, payment_method, product_name, pass_type, total_count, start_date, end_date, amount, discount_amount, refund_amount, final_amount, memo) VALUES (?,?,?,?,?,'DAILY',1,?,NULL,?,?,?,?,?)`;
        const pParams = idempotency_key
          ? [member_id, branch_name, payment_date, payment_method, product_name, useDate, amount, discount_amount || 0, refund_amount || 0, final_amount ?? amount, memo || "", idempotency_key]
          : [member_id, branch_name, payment_date, payment_method, product_name, useDate, amount, discount_amount || 0, refund_amount || 0, final_amount ?? amount, memo || ""];

        const [payRes]: any = await conn.query(pSql, pParams);

        if (idempotency_key && payRes.affectedRows === 0) {
          await conn.commit();
          return NextResponse.json({ success: true, message: "일일권 등록 완료 (중복 요청)", idempotent: true });
        }

        await conn.query(
          `INSERT INTO day_passes (payment_id, member_id, branch_name, use_date, status) VALUES (?,?,?,?,'PENDING')`,
          [payRes.insertId, member_id, branch_name, useDate]
        );

        await conn.commit();
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }

      return NextResponse.json({ success: true, message: "일일권 등록 완료" });
    }

    // ── 기존 PERIOD / COUNT 처리 ──────────────────────────────────
    const duration_months = Number(product.duration_months || 0);
    const count_value = Number(product.count_value || 0);

    if (pass_type === "PERIOD" && duration_months <= 0) {
      return NextResponse.json({
        success: false,
        message: `상품 "${product_name}"의 이용 기간(개월)이 설정되지 않았습니다. 상품 마스터를 수정해주세요.`,
      });
    }

    if (pass_type === "COUNT") {
      if (count_value <= 0) {
        return NextResponse.json({
          success: false,
          message: `상품 "${product_name}"의 제공 횟수가 설정되지 않았습니다. 상품 마스터를 수정해주세요.`,
        });
      }
      if (duration_months <= 0) {
        return NextResponse.json({
          success: false,
          message: `상품 "${product_name}"의 유효기간(개월)이 설정되지 않았습니다. 상품 마스터를 수정해주세요.`,
        });
      }
    }

    const start_date = start_date_input || payment_date;
    const end_date = addMonths(start_date, duration_months);
    const remaining_count = pass_type === "COUNT" ? count_value : 0;

    const hadPayment = !!memberRows[0].product_name || !!memberRows[0].end_date;
    await withMemberChange(
      {
        type: hadPayment ? "RENEW" : "REGISTER",
        reason: hadPayment ? "회원권 결제(연장·재등록)" : "회원권 등록",
        source: "payments/add",
        actor: "직원",
      },
      async (conn) => {
        // idempotency_key UNIQUE 제약이 있을 때 동시 중복 삽입 방지
        // INSERT IGNORE: 같은 키가 경쟁 삽입되면 두 번째는 조용히 무시됨
        const insertSql = idempotency_key
          ? `INSERT IGNORE INTO payments
             (member_id, branch_name, payment_date, payment_method, product_name,
              pass_type, total_count, start_date, end_date,
              amount, discount_amount, refund_amount, final_amount, memo, idempotency_key)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          : `INSERT INTO payments
             (member_id, branch_name, payment_date, payment_method, product_name,
              pass_type, total_count, start_date, end_date,
              amount, discount_amount, refund_amount, final_amount, memo)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        const insertParams = idempotency_key
          ? [
              member_id, branch_name, payment_date, payment_method, product_name,
              pass_type, pass_type === "COUNT" ? count_value : null,
              start_date, end_date,
              amount, discount_amount || 0, refund_amount || 0, final_amount ?? amount,
              memo || "", idempotency_key,
            ]
          : [
              member_id, branch_name, payment_date, payment_method, product_name,
              pass_type, pass_type === "COUNT" ? count_value : null,
              start_date, end_date,
              amount, discount_amount || 0, refund_amount || 0, final_amount ?? amount,
              memo || "",
            ];

        const [payRes]: any = await conn.query(insertSql, insertParams);

        // INSERT IGNORE + 중복 키: affectedRows=0 → members UPDATE 없이 반환
        if (idempotency_key && payRes.affectedRows === 0) {
          return; // 이미 처리된 요청이므로 members는 수정하지 않음
        }

        await conn.query(
          `SET @sbm_change_ref_type = 'payment', @sbm_change_ref_id = ?`,
          [payRes.insertId]
        );

        await conn.query(
          `UPDATE members
           SET product_name = ?, pass_type = ?, remaining_count = ?,
               start_date = ?, end_date = ?, status = 'ACTIVE'
           WHERE member_id = ?`,
          [product_name, pass_type, remaining_count, start_date, end_date, member_id]
        );
      }
    );

    return NextResponse.json({ success: true, message: "결제 등록 완료" });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, message: "결제 등록 실패", error });
  }
}
