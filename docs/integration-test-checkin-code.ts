/**
 * 출석코드 8자리 지원 통합 테스트
 * 실행: npx tsx docs/integration-test-checkin-code.ts
 *
 * 사전 준비: strongboxing_test DB에 checkin_code VARCHAR(8) 적용 완료
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

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

const TEST_BRANCH_A = "테스트지점A";
const TEST_BRANCH_B = "테스트지점B";
const BASE_ID = 9010;

async function cleanup() {
  await pool.query(`DELETE FROM attendance WHERE member_id BETWEEN ${BASE_ID} AND ${BASE_ID + 10}`);
  await pool.query(`DELETE FROM member_histories WHERE member_id BETWEEN ${BASE_ID} AND ${BASE_ID + 10}`);
  await pool.query(`DELETE FROM members WHERE member_id BETWEEN ${BASE_ID} AND ${BASE_ID + 10}`);
}

async function insertMember(id: number, branch: string, code: string, passType = "PERIOD", endDate = "2027-12-31") {
  await pool.query(
    `INSERT INTO members (member_id, name, phone, phone_last4, branch_name, checkin_code, pass_type, remaining_count, start_date, end_date, status)
     VALUES (?, '테스트${id}', '01000000${id}', '0000', ?, ?, ?, 5, '2026-01-01', ?, 'ACTIVE')
     ON DUPLICATE KEY UPDATE checkin_code=VALUES(checkin_code), branch_name=VALUES(branch_name), status='ACTIVE', end_date=VALUES(end_date)`,
    [id, branch, code, passType, endDate]
  );
}

// 체크인 로직 시뮬레이션 (API route의 핵심 로직)
async function simulateCheckin(code: string, branch?: string): Promise<{ status: number; result: string; message: string }> {
  if (!code || !/^\d{1,8}$/.test(code)) {
    return { status: 400, result: "INVALID", message: "출석번호(숫자 최대 8자리)를 입력해주세요." };
  }

  let sql = `SELECT * FROM members WHERE checkin_code = ?`;
  const params: any[] = [code];
  if (branch) { sql += ` AND branch_name = ?`; params.push(branch); }
  sql += ` LIMIT 2`;

  const [rows]: any = await pool.query(sql, params);

  if (rows.length > 1) return { status: 409, result: "DUPLICATE_CODE", message: "같은 출석번호를 가진 회원이 여러 명입니다." };
  if (rows.length === 0) return { status: 200, result: "NOT_FOUND", message: "회원 없음" };

  const m = rows[0];
  const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
  const endDate = m.end_date ? String(m.end_date).slice(0, 10) : null;
  if (endDate && endDate < today) return { status: 200, result: "EXPIRED", message: "만료" };

  return { status: 200, result: "SUCCESS", message: "출석 완료", ...m };
}

// members/add 검증 시뮬레이션
function validateCheckinCode(code: string): string | null {
  if (!code) return "출석번호 필수";
  if (!/^\d{1,8}$/.test(code)) return "출석번호는 숫자 최대 8자리로 입력해주세요.";
  return null; // OK
}

async function runTests() {
  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      console.log(`  ✅ ${name}`);
      passed++;
    } catch (e: any) {
      console.log(`  ❌ ${name}: ${e.message}`);
      failed++;
    }
  }

  console.log("\n=== 출석코드 8자리 지원 통합 테스트 ===\n");

  await cleanup();

  // ── 등록 검증 ─────────────────────────────────────────────────────────────

  await test("T1: 기존 4자리 코드 — 등록 검증 통과", async () => {
    assert(validateCheckinCode("1234") === null, "4자리 허용");
  });

  await test("T2: 7자리 코드 — 등록 검증 통과", async () => {
    assert(validateCheckinCode("1234567") === null, "7자리 허용");
  });

  await test("T3: 8자리 코드 — 등록 검증 통과", async () => {
    assert(validateCheckinCode("12345678") === null, "8자리 허용");
  });

  await test("T4: 9자리 코드 — 등록 검증 차단", async () => {
    assert(validateCheckinCode("123456789") !== null, "9자리 차단");
  });

  await test("T5: 비숫자 포함 — 등록 검증 차단", async () => {
    assert(validateCheckinCode("12a4") !== null, "비숫자 차단");
  });

  await test("T6: 빈 값 — 등록 검증 차단", async () => {
    assert(validateCheckinCode("") !== null, "빈 값 차단");
  });

  // ── DB 저장 검증 ───────────────────────────────────────────────────────────

  await test("T7: 4자리 코드 DB 저장 및 조회 (앞자리 0 보존)", async () => {
    await insertMember(BASE_ID, TEST_BRANCH_A, "0001");
    const [rows]: any = await pool.query(`SELECT checkin_code FROM members WHERE member_id = ?`, [BASE_ID]);
    assert(rows[0].checkin_code === "0001", `앞자리 0 보존: 기대 '0001', 실제 '${rows[0].checkin_code}'`);
  });

  await test("T8: 7자리 코드 DB 저장 및 조회", async () => {
    await insertMember(BASE_ID + 1, TEST_BRANCH_A, "1234567");
    const [rows]: any = await pool.query(`SELECT checkin_code FROM members WHERE member_id = ?`, [BASE_ID + 1]);
    assert(rows[0].checkin_code === "1234567", `7자리 저장: ${rows[0].checkin_code}`);
  });

  await test("T9: 8자리 코드 DB 저장 및 조회", async () => {
    await insertMember(BASE_ID + 2, TEST_BRANCH_A, "12345678");
    const [rows]: any = await pool.query(`SELECT checkin_code FROM members WHERE member_id = ?`, [BASE_ID + 2]);
    assert(rows[0].checkin_code === "12345678", `8자리 저장: ${rows[0].checkin_code}`);
  });

  // ── 체크인 조회 ────────────────────────────────────────────────────────────

  await test("T10: 4자리 코드로 체크인 — 성공", async () => {
    const r = await simulateCheckin("0001", TEST_BRANCH_A);
    assert(r.result === "SUCCESS", `expected SUCCESS, got ${r.result}: ${r.message}`);
  });

  await test("T11: 7자리 코드로 체크인 — 성공", async () => {
    const r = await simulateCheckin("1234567", TEST_BRANCH_A);
    assert(r.result === "SUCCESS", `expected SUCCESS, got ${r.result}`);
  });

  await test("T12: 8자리 코드로 체크인 — 성공", async () => {
    const r = await simulateCheckin("12345678", TEST_BRANCH_A);
    assert(r.result === "SUCCESS", `expected SUCCESS, got ${r.result}`);
  });

  await test("T13: 9자리 입력 — API 차단", async () => {
    const r = await simulateCheckin("123456789");
    assert(r.result === "INVALID", `expected INVALID, got ${r.result}`);
  });

  await test("T14: 비숫자 입력 — API 차단", async () => {
    const r = await simulateCheckin("123a");
    assert(r.result === "INVALID", `expected INVALID, got ${r.result}`);
  });

  // ── 지점 간 동일 코드 허용 ────────────────────────────────────────────────

  await test("T15: 지점 간 동일 코드 — 각 지점에서 각자 조회됨", async () => {
    await insertMember(BASE_ID + 3, TEST_BRANCH_A, "5555");
    await insertMember(BASE_ID + 4, TEST_BRANCH_B, "5555");
    const rA = await simulateCheckin("5555", TEST_BRANCH_A);
    const rB = await simulateCheckin("5555", TEST_BRANCH_B);
    assert(rA.result === "SUCCESS", `지점A 조회 실패: ${rA.result}`);
    assert(rB.result === "SUCCESS", `지점B 조회 실패: ${rB.result}`);
  });

  // ── 같은 지점 중복 코드 차단 ───────────────────────────────────────────────

  await test("T16: 같은 지점 중복 코드 → DUPLICATE_CODE 반환", async () => {
    await insertMember(BASE_ID + 5, TEST_BRANCH_A, "6666");
    await insertMember(BASE_ID + 6, TEST_BRANCH_A, "6666");
    const r = await simulateCheckin("6666", TEST_BRANCH_A);
    assert(r.result === "DUPLICATE_CODE", `expected DUPLICATE_CODE, got ${r.result}`);
  });

  // ── 긴 코드 앞 4자리 충돌 — 별개로 처리 ──────────────────────────────────

  await test("T17: 8자리 코드의 앞 4자리가 다른 4자리 코드와 같아도 별개 취급", async () => {
    await insertMember(BASE_ID + 7, TEST_BRANCH_A, "7777");
    await insertMember(BASE_ID + 8, TEST_BRANCH_A, "77770000");
    // "7777" 조회 → 정확히 "7777"인 회원 1명만
    const r4 = await simulateCheckin("7777", TEST_BRANCH_A);
    // "77770000" 조회 → 정확히 "77770000"인 회원 1명만
    const r8 = await simulateCheckin("77770000", TEST_BRANCH_A);
    assert(r4.result === "SUCCESS", `4자리 조회: ${r4.result}`);
    assert(r8.result === "SUCCESS", `8자리 조회: ${r8.result}`);
  });

  await cleanup();
  console.log(`\n결과: ${passed}/${passed + failed} 통과`);
  if (failed > 0) process.exit(1);
}

runTests()
  .then(() => pool.end())
  .catch((e) => { console.error(e); process.exit(1); });
