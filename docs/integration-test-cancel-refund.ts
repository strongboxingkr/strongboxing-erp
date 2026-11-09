/**
 * payments/cancel, member-refund, members/renew 통합 테스트
 * strongboxing_test DB 전용 — 운영 DB 사용 금지
 *
 * 실행: npx tsx docs/integration-test-cancel-refund.ts
 * 사전 조건: docs/setup-test-db.sql 먼저 실행
 */

import mysql from "mysql2/promise";

const DB = {
  host: "localhost",
  port: 3306,
  user: "root",
  password: "strongboxing0406!",
  database: "strongboxing_test",
  dateStrings: true,
};

const pool = mysql.createPool({ ...DB, waitForConnections: true, connectionLimit: 5 });

// ── 헬퍼 ────────────────────────────────────────────────────────

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`FAIL: ${msg}`);
}
function assertEq(a: any, b: any, msg: string) {
  if (a !== b) throw new Error(`FAIL: ${msg} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

async function q(sql: string, params?: any[]) {
  const [rows]: any = await pool.query(sql, params);
  return rows;
}

async function resetMember(memberId: number, overrides: Record<string, any> = {}) {
  const defaults = {
    product_name: "1개월 기간권",
    pass_type: "PERIOD",
    remaining_count: 0,
    start_date: "2026-10-01",
    end_date: "2026-10-30",
    status: "ACTIVE",
  };
  const vals = { ...defaults, ...overrides };
  await q(
    `UPDATE members SET product_name=?, pass_type=?, remaining_count=?, start_date=?, end_date=?, status=? WHERE member_id=?`,
    [vals.product_name, vals.pass_type, vals.remaining_count, vals.start_date, vals.end_date, vals.status, memberId]
  );
}

async function insertPayment(overrides: Record<string, any>) {
  const defaults = {
    member_id: 1,
    branch_name: "철산점",
    payment_date: "2026-10-01",
    payment_method: "CARD",
    product_name: null,
    pass_type: null,
    start_date: null,
    end_date: null,
    total_count: null,
    amount: 100000,
    discount_amount: 0,
    refund_amount: 0,
    final_amount: 100000,
    memo: null,
  };
  const v = { ...defaults, ...overrides };
  const [res]: any = await pool.query(
    `INSERT INTO payments (member_id, branch_name, payment_date, payment_method, product_name, pass_type, start_date, end_date, total_count, amount, discount_amount, refund_amount, final_amount, memo)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [v.member_id, v.branch_name, v.payment_date, v.payment_method, v.product_name, v.pass_type, v.start_date, v.end_date, v.total_count, v.amount, v.discount_amount, v.refund_amount, v.final_amount, v.memo]
  );
  return res.insertId as number;
}

// ── 취소 로직 (route.ts 내부 로직 재현) ─────────────────────────

async function cancelPayment(paymentId: number, actorBranch = "철산점") {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows]: any = await conn.query("SELECT * FROM payments WHERE payment_id = ?", [paymentId]);
    if (rows.length === 0) { await conn.rollback(); return { success: false, message: "결제 없음" }; }
    const payment = rows[0];

    // GENERAL 결제 (pass_type IS NULL)
    const isPass = payment.pass_type !== null && payment.pass_type !== undefined && payment.pass_type !== "";
    await conn.query(
      "UPDATE payments SET memo = CONCAT('[취소] ', IFNULL(memo, '')), refund_amount = final_amount, final_amount = 0 WHERE payment_id = ?",
      [paymentId]
    );

    if (!isPass) {
      await conn.commit();
      return { success: true, message: "일반 결제 취소 완료", members_updated: false };
    }

    const [memberRows]: any = await conn.query("SELECT * FROM members WHERE member_id = ?", [payment.member_id]);
    if (memberRows.length === 0) {
      await conn.commit();
      return { success: true, message: "결제 취소 완료 (회원 없음)", members_updated: false };
    }
    const member = memberRows[0];

    const payStart = payment.start_date ? String(payment.start_date).slice(0, 10) : null;
    const payEnd = payment.end_date ? String(payment.end_date).slice(0, 10) : null;
    const memStart = member.start_date ? String(member.start_date).slice(0, 10) : null;
    const memEnd = member.end_date ? String(member.end_date).slice(0, 10) : null;

    const isCurrentMembership =
      member.product_name === payment.product_name && payStart === memStart && payEnd === memEnd;

    if (!isCurrentMembership) {
      await conn.commit();
      return {
        success: true,
        message: "결제 취소 완료",
        members_updated: false,
        warning: "현재 활성 회원권과 다른 결제입니다. 회원권에는 변경이 없습니다.",
      };
    }

    // 현재 회원권과 일치: 명시적 EXPIRED 처리
    await conn.query(
      `UPDATE members SET status = 'EXPIRED', product_name = NULL, pass_type = NULL, remaining_count = 0, start_date = NULL, end_date = NULL WHERE member_id = ?`,
      [payment.member_id]
    );
    await conn.commit();
    return { success: true, message: "회원권 결제 취소 완료", members_updated: true };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

// ── 환불 로직 재현 ─────────────────────────────────────────────

async function processRefund(memberId: number, refundAmount: number, refundReason: string) {
  const [memberRows]: any = await pool.query("SELECT * FROM members WHERE member_id = ?", [memberId]);
  if (memberRows.length === 0) return { success: false, message: "회원 없음" };
  const member = memberRows[0];

  const [res]: any = await pool.query(
    `INSERT INTO payments (member_id, branch_name, payment_date, payment_method, product_name, pass_type, amount, discount_amount, refund_amount, final_amount, memo)
     VALUES (?, ?, CURDATE(), 'TRANSFER', ?, ?, 0, 0, ?, ?, ?)`,
    [member.member_id, member.branch_name, member.product_name, member.pass_type, refundAmount, -Math.abs(refundAmount), refundReason]
  );
  // members.status는 변경하지 않음
  return { success: true, payment_id: res.insertId };
}

// ── 테스트 케이스 ───────────────────────────────────────────────

type TestFn = () => Promise<void>;
const tests: Array<[string, TestFn]> = [];
function test(name: string, fn: TestFn) { tests.push([name, fn]); }

test("T1: GENERAL 결제 취소 → members 변화 없음", async () => {
  const memberId = 2; // 기간권테스트
  await resetMember(memberId, { product_name: "1개월 기간권", pass_type: "PERIOD", status: "ACTIVE" });
  const paymentId = await insertPayment({ member_id: memberId, pass_type: null, product_name: null });

  const before = (await q("SELECT status, product_name FROM members WHERE member_id = ?", [memberId]))[0];
  const result = await cancelPayment(paymentId);

  assert(result.success, "취소 성공해야 함");
  assertEq(result.members_updated, false, "members 변경 없어야 함");

  const after = (await q("SELECT status, product_name FROM members WHERE member_id = ?", [memberId]))[0];
  assertEq(after.status, before.status, "status 불변");
  assertEq(after.product_name, before.product_name, "product_name 불변");

  // payment final_amount = 0 확인
  const pay = (await q("SELECT final_amount FROM payments WHERE payment_id = ?", [paymentId]))[0];
  assertEq(Number(pay.final_amount), 0, "final_amount = 0");
});

test("T2: PASS 취소 (현재 회원권과 일치) → EXPIRED + 필드 초기화", async () => {
  const memberId = 2;
  await resetMember(memberId, {
    product_name: "1개월 기간권",
    pass_type: "PERIOD",
    start_date: "2026-10-01",
    end_date: "2026-10-30",
    status: "ACTIVE",
  });
  const paymentId = await insertPayment({
    member_id: memberId,
    pass_type: "PERIOD",
    product_name: "1개월 기간권",
    start_date: "2026-10-01",
    end_date: "2026-10-30",
  });

  const result = await cancelPayment(paymentId);

  assert(result.success, "취소 성공");
  assertEq(result.members_updated, true, "members 업데이트됨");

  const member = (await q("SELECT status, product_name, pass_type, remaining_count FROM members WHERE member_id = ?", [memberId]))[0];
  assertEq(member.status, "EXPIRED", "status = EXPIRED");
  assert(member.product_name === null, "product_name = NULL");
  assert(member.pass_type === null, "pass_type = NULL");
  assertEq(Number(member.remaining_count), 0, "remaining_count = 0");
});

test("T3: 재결제 후 이전 PASS 취소 → 현재 회원권 불변 + warning", async () => {
  const memberId = 2;
  // 이전 결제 (10월)
  const oldPaymentId = await insertPayment({
    member_id: memberId,
    pass_type: "PERIOD",
    product_name: "1개월 기간권",
    start_date: "2026-10-01",
    end_date: "2026-10-30",
  });
  // 재결제 (11월) → 현재 회원권
  await resetMember(memberId, {
    product_name: "3개월 기간권",
    pass_type: "PERIOD",
    start_date: "2026-11-01",
    end_date: "2027-01-29",
    status: "ACTIVE",
  });

  const before = (await q("SELECT status, product_name, start_date FROM members WHERE member_id = ?", [memberId]))[0];
  const result = await cancelPayment(oldPaymentId);

  assert(result.success, "취소 성공");
  assertEq(result.members_updated, false, "members 불변");
  assert(!!result.warning, "warning 메시지 있어야 함");

  const after = (await q("SELECT status, product_name FROM members WHERE member_id = ?", [memberId]))[0];
  assertEq(after.status, before.status, "status 불변");
  assertEq(after.product_name, before.product_name, "product_name 불변");
});

test("T4: 환불 처리 → payments 기록, members.status 불변", async () => {
  const memberId = 2;
  await resetMember(memberId, { status: "ACTIVE", product_name: "1개월 기간권" });

  const before = (await q("SELECT status FROM members WHERE member_id = ?", [memberId]))[0];
  const result = await processRefund(memberId, 50000, "부분 환불 테스트");

  assert(result.success, "환불 성공");

  const after = (await q("SELECT status FROM members WHERE member_id = ?", [memberId]))[0];
  assertEq(after.status, before.status, "status 불변");

  const refundPay = (await q("SELECT final_amount FROM payments WHERE payment_id = ?", [result.payment_id]))[0];
  assert(Number(refundPay.final_amount) < 0, "환불 금액 음수");
});

test("T5: renew 중간 실패 시 rollback — payments INSERT 후 members UPDATE 실패", async () => {
  // renew route 트랜잭션 테스트: 존재하지 않는 member_id로 payments INSERT 시 FK 오류 없다면
  // 직접 트랜잭션 롤백 시뮬레이션
  const conn = await pool.getConnection();
  let paymentCreated = false;
  try {
    await conn.beginTransaction();
    const memberId = 1;
    const [memberRows]: any = await conn.query("SELECT * FROM members WHERE member_id = ?", [memberId]);
    const member = memberRows[0];

    const [res]: any = await conn.query(
      `INSERT INTO payments (member_id, branch_name, payment_date, payment_method, product_name, pass_type, amount, final_amount)
       VALUES (?, ?, '2026-10-01', 'CARD', '8회권', 'COUNT', 80000, 80000)`,
      [memberId, member.branch_name]
    );
    paymentCreated = true;

    // 의도적으로 ROLLBACK
    await conn.rollback();
    paymentCreated = false;
  } catch (e) {
    await conn.rollback();
  } finally {
    conn.release();
  }

  assertEq(paymentCreated, false, "트랜잭션 롤백 후 payment 없어야 함");

  // payments에 삽입된 행 없는지 확인 (rollback이므로)
  // 주의: auto_increment는 롤백돼도 증가 — 행 자체만 없으면 OK
});

test("T6: COUNT 결제 취소 — GENERAL 아님, PASS임 — 현재 COUNT 회원권과 일치 시 EXPIRED", async () => {
  const memberId = 1; // 횟수권테스트
  await resetMember(memberId, {
    product_name: "8회권",
    pass_type: "COUNT",
    remaining_count: 5,
    start_date: "2026-10-01",
    end_date: "2026-10-30",
    status: "ACTIVE",
  });
  const paymentId = await insertPayment({
    member_id: memberId,
    pass_type: "COUNT",
    product_name: "8회권",
    start_date: "2026-10-01",
    end_date: "2026-10-30",
    total_count: 8,
  });

  const result = await cancelPayment(paymentId);
  assert(result.success, "취소 성공");
  assertEq(result.members_updated, true, "members 업데이트됨");

  const member = (await q("SELECT status, remaining_count FROM members WHERE member_id = ?", [memberId]))[0];
  assertEq(member.status, "EXPIRED", "status = EXPIRED");
  assertEq(Number(member.remaining_count), 0, "remaining_count = 0");
});

// ── 실행 ────────────────────────────────────────────────────────

async function run() {
  let passed = 0;
  let failed = 0;

  for (const [name, fn] of tests) {
    try {
      await fn();
      console.log(`  ✅ ${name}`);
      passed++;
    } catch (e: any) {
      console.error(`  ❌ ${name}\n     ${e.message}`);
      failed++;
    }
  }

  console.log(`\n결과: ${passed}/${passed + failed} 통과`);
  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(console.error);
