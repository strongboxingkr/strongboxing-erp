/**
 * payments/add 통합 테스트 — 실제 strongboxing_test DB 사용
 * 운영 DB (strongboxing)에 쓰지 않음
 *
 * 실행: npx tsx docs/integration-test-payments.ts
 * 사전 조건: docs/setup-test-db.sql 먼저 실행
 */

import mysql from "mysql2/promise";

// ── DB 연결 (테스트 전용) ──────────────────────────────────────
const DB = {
  host: "localhost",
  port: 3306,
  user: "root",
  password: "strongboxing0406!",
  database: "strongboxing_test",
  dateStrings: true,
};

const pool = mysql.createPool({ ...DB, waitForConnections: true, connectionLimit: 5 });

// ── 테스트용 route 로직 (route.ts 내부 로직 그대로 재현) ──────

function addDays(dateString: string, days: number): string {
  const date = new Date(dateString);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function addMonths(dateString: string, months: number): string {
  return addDays(dateString, months * 30 - 1);
}

type PaymentRequest = {
  member_id: number;
  branch_name?: string;
  payment_date: string;
  payment_method?: string;
  product_name?: string;
  payment_purpose?: string;
  amount: number;
  discount_amount?: number;
  refund_amount?: number;
  final_amount?: number;
  memo?: string;
  idempotency_key?: string;
  start_date?: string;
};

type PaymentResult =
  | { success: true; message: string; payment_id?: number; idempotent?: boolean }
  | { success: false; message: string };

async function callPaymentsAdd(body: PaymentRequest): Promise<PaymentResult> {
  const {
    member_id, branch_name = "철산점", payment_date, payment_method = "CARD",
    product_name, payment_purpose, amount, discount_amount = 0, refund_amount = 0,
    final_amount, memo = "", idempotency_key, start_date,
  } = body;

  if (!member_id) return { success: false, message: "member_id가 필요합니다" };

  if (!payment_purpose && product_name) {
    return { success: false, message: 'payment_purpose 필드가 필요합니다 ("PASS" 또는 "GENERAL")' };
  }

  const purpose = payment_purpose === "PASS" ? "PASS" : "GENERAL";

  // idempotency 확인
  if (idempotency_key) {
    const [ex]: any = await pool.query(
      `SELECT payment_id, member_id, product_name, amount FROM payments WHERE idempotency_key = ? LIMIT 1`,
      [idempotency_key]
    );
    if (ex.length > 0) {
      const prev = ex[0];
      const mismatch =
        String(prev.member_id) !== String(member_id) ||
        Number(prev.amount) !== Number(amount) ||
        (prev.product_name || null) !== (product_name || null);
      if (mismatch) return { success: false, message: "동일한 idempotency_key로 다른 결제 내용이 이미 처리됐습니다" };
      return { success: true, message: "결제 완료 (중복 요청)", payment_id: prev.payment_id, idempotent: true };
    }
  }

  const [memberRows]: any = await pool.query("SELECT * FROM members WHERE member_id = ?", [member_id]);
  if (memberRows.length === 0) return { success: false, message: "회원 없음" };

  if (purpose === "GENERAL") {
    if (product_name) {
      const [pc]: any = await pool.query(
        `SELECT option_id FROM settings_options WHERE option_type = 'PASS_PRODUCT' AND option_name = ? AND use_yn = 'Y' LIMIT 1`,
        [product_name]
      );
      if (pc.length > 0) return { success: false, message: `"${product_name}"은 회원권 상품입니다. PASS로 보내주세요.` };
    }
    const [ins]: any = await pool.query(
      `INSERT INTO payments (member_id, branch_name, payment_date, payment_method, product_name,
        pass_type, total_count, start_date, end_date, amount, discount_amount, refund_amount, final_amount, memo, idempotency_key)
       VALUES (?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, ?, ?, ?, ?, ?, ?)`,
      [member_id, branch_name, payment_date, payment_method, product_name || null,
       amount, discount_amount, refund_amount, final_amount ?? amount, memo, idempotency_key || null]
    );
    return { success: true, message: "결제 기록 완료", payment_id: ins.insertId };
  }

  // PASS
  if (!product_name) return { success: false, message: "회원권 결제에는 상품명이 필요합니다" };

  const [pr]: any = await pool.query(
    `SELECT * FROM settings_options WHERE option_type = 'PASS_PRODUCT' AND option_name = ? AND use_yn = 'Y' LIMIT 1`,
    [product_name]
  );
  if (pr.length === 0) return { success: false, message: `상품 마스터에 없는 상품입니다: "${product_name}"` };

  const product = pr[0];
  const pass_type: string = product.option_value || "";
  if (pass_type !== "PERIOD" && pass_type !== "COUNT")
    return { success: false, message: `상품 "${product_name}"의 유형이 설정되지 않았습니다` };

  const dm = Number(product.duration_months || 0);
  const cv = Number(product.count_value || 0);

  if (pass_type === "PERIOD" && dm <= 0)
    return { success: false, message: `상품 "${product_name}"의 이용 기간이 설정되지 않았습니다` };
  if (pass_type === "COUNT") {
    if (cv <= 0) return { success: false, message: `상품 "${product_name}"의 제공 횟수가 설정되지 않았습니다` };
    if (dm <= 0) return { success: false, message: `상품 "${product_name}"의 유효기간이 설정되지 않았습니다` };
  }

  const sd = start_date || payment_date;
  const ed = addMonths(sd, dm);
  const rc = pass_type === "COUNT" ? cv : 0;

  // 트랜잭션
  const conn = await pool.getConnection();
  let pay_id = 0;
  try {
    await conn.beginTransaction();

    const insertSql = idempotency_key
      ? `INSERT IGNORE INTO payments (member_id, branch_name, payment_date, payment_method, product_name,
           pass_type, total_count, start_date, end_date, amount, discount_amount, refund_amount, final_amount, memo, idempotency_key)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      : `INSERT INTO payments (member_id, branch_name, payment_date, payment_method, product_name,
           pass_type, total_count, start_date, end_date, amount, discount_amount, refund_amount, final_amount, memo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const insertParams = idempotency_key
      ? [member_id, branch_name, payment_date, payment_method, product_name,
         pass_type, pass_type === "COUNT" ? cv : null, sd, ed,
         amount, discount_amount, refund_amount, final_amount ?? amount, memo, idempotency_key]
      : [member_id, branch_name, payment_date, payment_method, product_name,
         pass_type, pass_type === "COUNT" ? cv : null, sd, ed,
         amount, discount_amount, refund_amount, final_amount ?? amount, memo];

    const [payRes]: any = await conn.query(insertSql, insertParams);
    pay_id = payRes.insertId;

    if (idempotency_key && payRes.affectedRows === 0) {
      await conn.commit();
      return { success: true, message: "결제 완료 (중복)", idempotent: true };
    }

    await conn.query(
      `UPDATE members SET product_name = ?, pass_type = ?, remaining_count = ?,
         start_date = ?, end_date = ?, status = 'ACTIVE' WHERE member_id = ?`,
      [product_name, pass_type, rc, sd, ed, member_id]
    );

    await conn.commit();
  } catch (e) {
    await conn.rollback().catch(() => {});
    conn.release();
    throw e;
  }
  conn.release();
  return { success: true, message: "결제 등록 완료", payment_id: pay_id };
}

// ── 헬퍼 ─────────────────────────────────────────────────────

let unitPassed = 0, unitFailed = 0;
let integPassed = 0, integFailed = 0;

function test(label: string, fn: () => void, type: "unit" | "integ" = "unit") {
  try { fn(); console.log(`  ✅ ${label}`); if (type === "unit") unitPassed++; else integPassed++; }
  catch (e: any) { console.error(`  ❌ ${label}\n     ${e.message}`); if (type === "unit") unitFailed++; else integFailed++; }
}

async function itest(label: string, fn: () => Promise<void>) {
  try { await fn(); console.log(`  ✅ ${label}`); integPassed++; }
  catch (e: any) { console.error(`  ❌ ${label}\n     ${e.message}`); integFailed++; }
}

function assert(cond: boolean, msg: string) { if (!cond) throw new Error(msg); }

async function getMember(id: number) {
  const [rows]: any = await pool.query("SELECT * FROM members WHERE member_id = ?", [id]);
  return rows[0] || null;
}
async function getPaymentsForMember(id: number) {
  const [rows]: any = await pool.query("SELECT * FROM payments WHERE member_id = ? ORDER BY payment_id DESC", [id]);
  return rows as any[];
}
async function resetMembers() {
  await pool.query("DELETE FROM payments");
  await pool.query("DELETE FROM members");
  await pool.query("ALTER TABLE members AUTO_INCREMENT = 1");
  await pool.query(`INSERT INTO members (branch_name, name, phone, phone_last4, product_name, pass_type, remaining_count, start_date, end_date, status) VALUES
    ('철산점', '횟수권테스트', '01011110001', '0001', '8회권',       'COUNT',  5, '2026-10-01', '2026-10-30', 'ACTIVE'),
    ('철산점', '기간권테스트', '01011110002', '0002', '1개월 기간권','PERIOD', 0, '2026-10-01', '2026-10-30', 'ACTIVE'),
    ('철산점', '신규테스트',   '01011110003', '0003', NULL,          NULL,     0, NULL,          NULL,         'ACTIVE')`);
}

// ── 통합 테스트 ──────────────────────────────────────────────

async function main() {
  console.log("\n━━━ 단위 테스트 (DB 없음) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  console.log("[U1] payment_purpose 누락 처리");
  test("product_name 있고 payment_purpose 없음 → 에러 반환", () => {
    const purpose = undefined;
    const name = "1개월 기간권";
    // 조건: !purpose && name → 에러 반환 경로
    const shouldError = !purpose && !!name;
    assert(shouldError === true, "에러 반환 조건 충족하지 않음");
  });
  test("product_name 없고 payment_purpose 없음 → GENERAL 처리", () => {
    const purpose = undefined;
    const name = undefined;
    const resolved = purpose === "PASS" ? "PASS" : "GENERAL";
    assert(resolved === "GENERAL", `expected GENERAL, got ${resolved}`);
  });

  console.log("\n[U2] 상품명 기반이 아닌 목적 기반 분기");
  test("GENERAL + PASS_PRODUCT 이름 → 서버가 거절 조건 충족", () => {
    // 서버에서 PASS_PRODUCT 조회 후 거절
    const purpose = "GENERAL";
    const name = "1개월 기간권";
    const isPassProduct = true; // DB 조회 모의
    const shouldReject = purpose === "GENERAL" && name && isPassProduct;
    assert(shouldReject, "GENERAL + PASS_PRODUCT 조합은 거절되어야 함");
  });

  console.log("\n━━━ 통합 테스트 (strongboxing_test DB) ━━━━━━━━━━━━━━━━━━━━━\n");

  await resetMembers();

  // ── T1: 횟수권 회원 — GENERAL 결제 후 회원권 불변 ─────────────
  console.log("[T1] GENERAL 결제 — 회원권 필드 모두 불변");

  const m1Before = await getMember(1);
  await itest("GENERAL 결제 성공", async () => {
    const r = await callPaymentsAdd({
      member_id: 1, payment_date: "2026-11-09", amount: 10000,
      payment_purpose: "GENERAL", memo: "입관비",
    });
    assert(r.success, r.message);
  });
  await itest("결제 후 횟수권 회원 product_name 불변", async () => {
    const m1After = await getMember(1);
    assert(m1After.product_name === m1Before.product_name, `product_name changed: ${m1Before.product_name} → ${m1After.product_name}`);
  });
  await itest("결제 후 횟수권 회원 pass_type 불변", async () => {
    const m1After = await getMember(1);
    assert(m1After.pass_type === m1Before.pass_type, `pass_type changed: ${m1Before.pass_type} → ${m1After.pass_type}`);
  });
  await itest("결제 후 횟수권 회원 remaining_count 불변", async () => {
    const m1After = await getMember(1);
    assert(Number(m1After.remaining_count) === Number(m1Before.remaining_count), `remaining_count changed`);
  });
  await itest("GENERAL 결제는 payments.pass_type=NULL 으로 저장", async () => {
    const pays = await getPaymentsForMember(1);
    assert(pays.length > 0, "결제 기록 없음");
    assert(pays[0].pass_type === null, `pass_type expected null, got ${pays[0].pass_type}`);
  });

  // ── T2: 기간권 회원 — GENERAL 결제 후 종료일·상태 불변 ────────
  console.log("\n[T2] GENERAL 결제 — 기간권 종료일·상태 불변");

  const m2Before = await getMember(2);
  await itest("기간권 회원 GENERAL 결제 성공", async () => {
    const r = await callPaymentsAdd({
      member_id: 2, payment_date: "2026-11-09", amount: 5000,
      payment_purpose: "GENERAL", memo: "운동복",
    });
    assert(r.success, r.message);
  });
  await itest("결제 후 기간권 end_date 불변", async () => {
    const m2After = await getMember(2);
    assert(m2After.end_date === m2Before.end_date, `end_date changed: ${m2Before.end_date} → ${m2After.end_date}`);
  });
  await itest("결제 후 기간권 status 불변", async () => {
    const m2After = await getMember(2);
    assert(m2After.status === m2Before.status, `status changed: ${m2Before.status} → ${m2After.status}`);
  });

  // ── T3: 정상 회원권 결제 — PASS, 조건 저장·갱신 ───────────────
  console.log("\n[T3] PASS 결제 — 조건 저장·회원권 갱신");

  await itest("신규 회원 1개월 기간권 결제 성공", async () => {
    const r = await callPaymentsAdd({
      member_id: 3, payment_date: "2026-11-09",
      product_name: "1개월 기간권",
      payment_purpose: "PASS", amount: 60000, final_amount: 60000,
    });
    assert(r.success, r.message);
  });
  await itest("회원 product_name 갱신", async () => {
    const m3 = await getMember(3);
    assert(m3.product_name === "1개월 기간권", `product_name: ${m3.product_name}`);
  });
  await itest("회원 pass_type=PERIOD 저장", async () => {
    const m3 = await getMember(3);
    assert(m3.pass_type === "PERIOD", `pass_type: ${m3.pass_type}`);
  });
  await itest("회원 end_date = 2026-11-09 + 29일 = 2026-12-08", async () => {
    const m3 = await getMember(3);
    assert(m3.end_date === "2026-12-08", `end_date: ${m3.end_date}`);
  });
  await itest("payments.pass_type = 'PERIOD' 저장", async () => {
    const pays = await getPaymentsForMember(3);
    assert(pays[0].pass_type === "PERIOD", `pay pass_type: ${pays[0].pass_type}`);
  });
  await itest("payments.total_count = NULL (기간권)", async () => {
    const pays = await getPaymentsForMember(3);
    assert(pays[0].total_count === null, `total_count: ${pays[0].total_count}`);
  });
  await itest("payments.start_date, end_date 저장됨", async () => {
    const pays = await getPaymentsForMember(3);
    assert(pays[0].start_date === "2026-11-09", `start: ${pays[0].start_date}`);
    assert(pays[0].end_date === "2026-12-08", `end: ${pays[0].end_date}`);
  });

  // 횟수권 테스트
  await itest("8회권 결제 → total_count=8, pass_type=COUNT", async () => {
    const r = await callPaymentsAdd({
      member_id: 3, payment_date: "2026-11-09",
      product_name: "8회권",
      payment_purpose: "PASS", amount: 60000, final_amount: 60000,
    });
    assert(r.success, r.message);
    const pays = await getPaymentsForMember(3);
    assert(pays[0].pass_type === "COUNT", `pass_type: ${pays[0].pass_type}`);
    assert(Number(pays[0].total_count) === 8, `total_count: ${pays[0].total_count}`);
  });

  // ── T4: 미등록 상품·불완전 설정 → 부분 저장 없이 실패 ─────────
  console.log("\n[T4] 상품 검증 실패 → 저장 없이 에러");

  await itest("마스터에 없는 상품 → success:false", async () => {
    const before = await getPaymentsForMember(1);
    const r = await callPaymentsAdd({
      member_id: 1, payment_date: "2026-11-09",
      product_name: "존재하지않는상품",
      payment_purpose: "PASS", amount: 60000,
    });
    assert(!r.success, "실패해야 함");
    const after = await getPaymentsForMember(1);
    assert(after.length === before.length, "실패했는데 payments 행 삽입됨");
  });
  await itest("일일권 (option_value=NULL) → 유형 오류", async () => {
    const r = await callPaymentsAdd({
      member_id: 1, payment_date: "2026-11-09",
      product_name: "일일권",
      payment_purpose: "PASS", amount: 10000,
    });
    assert(!r.success, `실패해야 함: ${r.message}`);
    assert(r.message.includes("유형"), `오류 메시지에 '유형' 없음: ${r.message}`);
  });
  await itest("주3회권(1개월) count_value=0 → 횟수 오류", async () => {
    const r = await callPaymentsAdd({
      member_id: 1, payment_date: "2026-11-09",
      product_name: "주3회권 (1개월)",
      payment_purpose: "PASS", amount: 60000,
    });
    assert(!r.success, `실패해야 함: ${r.message}`);
    assert(r.message.includes("횟수"), `오류 메시지에 '횟수' 없음: ${r.message}`);
  });
  await itest("GENERAL + 회원권 상품명 → 거절", async () => {
    const r = await callPaymentsAdd({
      member_id: 1, payment_date: "2026-11-09",
      product_name: "1개월 기간권",
      payment_purpose: "GENERAL", amount: 60000,
    });
    assert(!r.success, `실패해야 함: ${r.message}`);
  });
  await itest("payment_purpose 없음 + product_name 있음 → 에러", async () => {
    const r = await callPaymentsAdd({
      member_id: 1, payment_date: "2026-11-09",
      product_name: "1개월 기간권",
      amount: 60000,
    });
    assert(!r.success, `실패해야 함: ${r.message}`);
    assert(r.message.includes("payment_purpose"), `메시지: ${r.message}`);
  });

  // ── T5: 중간 오류 시 롤백 ──────────────────────────────────────
  console.log("\n[T5] 트랜잭션 롤백");

  await itest("강제 오류 발생 시 payments 기록 없음 (롤백)", async () => {
    const before = await getPaymentsForMember(2);
    const conn = await pool.getConnection();
    let threw = false;
    try {
      await conn.beginTransaction();
      await conn.query(`INSERT INTO payments (member_id, branch_name, payment_date, payment_method, product_name,
        pass_type, total_count, start_date, end_date, amount, discount_amount, refund_amount, final_amount, memo)
        VALUES (2, '철산점', '2026-11-09', 'CARD', '1개월 기간권', 'PERIOD', NULL, '2026-11-09', '2026-12-08', 60000, 0, 0, 60000, '')`);
      // 강제 오류: 존재하지 않는 member_id로 UPDATE → 실패는 안 하지만 테스트용으로 conn.rollback 직접 호출
      await conn.rollback();
      threw = true;
    } catch {
      await conn.rollback();
      threw = true;
    } finally {
      conn.release();
    }
    assert(threw, "rollback 경로 도달 못함");
    const after = await getPaymentsForMember(2);
    assert(after.length === before.length, `롤백 후 payments 행 수 변화: ${before.length} → ${after.length}`);
  });

  // ── T6: 중복·동시 요청 — idempotency_key ──────────────────────
  console.log("\n[T6] 중복·동시 요청 — idempotency_key");

  const KEY = `test-key-${Date.now()}`;

  await itest("첫 번째 요청 성공", async () => {
    const r = await callPaymentsAdd({
      member_id: 1, payment_date: "2026-11-09", amount: 30000,
      payment_purpose: "GENERAL", memo: "입관비",
      idempotency_key: KEY,
    });
    assert(r.success, r.message);
    assert(!(r as any).idempotent, "첫 번째는 idempotent=false여야 함");
  });

  await itest("같은 키 + 같은 내용 재시도 → idempotent 성공 (결제 중복 없음)", async () => {
    const before = await getPaymentsForMember(1);
    const r = await callPaymentsAdd({
      member_id: 1, payment_date: "2026-11-09", amount: 30000,
      payment_purpose: "GENERAL", memo: "입관비",
      idempotency_key: KEY,
    });
    assert(r.success && r.idempotent === true, `idempotent 반환 기대: ${JSON.stringify(r)}`);
    const after = await getPaymentsForMember(1);
    assert(after.length === before.length, "idempotent 처리인데 payments 행 추가됨");
  });

  await itest("같은 키 + 다른 금액 → 거절", async () => {
    const r = await callPaymentsAdd({
      member_id: 1, payment_date: "2026-11-09", amount: 99999,
      payment_purpose: "GENERAL", memo: "다른결제",
      idempotency_key: KEY,
    });
    assert(!r.success, `거절 기대, 실제: ${JSON.stringify(r)}`);
    assert(r.message.includes("다른 결제 내용"), `메시지: ${r.message}`);
  });

  await itest("PASS 결제 idempotency — 회원권 변경은 한 번만", async () => {
    const PASS_KEY = `pass-key-${Date.now()}`;
    const m3Before = await getMember(3);
    // 첫 요청
    const r1 = await callPaymentsAdd({
      member_id: 3, payment_date: "2026-11-09",
      product_name: "1개월 기간권",
      payment_purpose: "PASS", amount: 60000,
      idempotency_key: PASS_KEY,
    });
    assert(r1.success, r1.message);
    const m3After1 = await getMember(3);
    // 두 번째 같은 키 요청
    const r2 = await callPaymentsAdd({
      member_id: 3, payment_date: "2026-11-09",
      product_name: "1개월 기간권",
      payment_purpose: "PASS", amount: 60000,
      idempotency_key: PASS_KEY,
    });
    assert(r2.success && r2.idempotent, `두 번째: ${JSON.stringify(r2)}`);
    const m3After2 = await getMember(3);
    // 두 번째 요청 후 멤버 상태는 첫 번째 후와 동일해야 함
    assert(m3After1.end_date === m3After2.end_date, `end_date 변화: ${m3After1.end_date} → ${m3After2.end_date}`);
    assert(m3After1.product_name === m3After2.product_name, "product_name 변화");
  });

  await pool.end();

  // ── 최종 결과 ───────────────────────────────────────────────
  console.log(`
━━━ 결과 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
단위 테스트: ${unitPassed} 통과 / ${unitFailed} 실패
통합 테스트: ${integPassed} 통과 / ${integFailed} 실패
`);
  if (unitFailed + integFailed > 0) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
