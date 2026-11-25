/**
 * 실제 라우트 핸들러(payments/add POST)를 mock pool로 실행하는 통합 검증.
 * - mock pool: DB 연결 없이 쿼리 기록
 * - 실제 라우트 코드 임포트, 실제 Request 객체 사용
 */
import { POST } from "@/app/api/payments/add/route";
import { poolState } from "@/lib/db";

let passed = 0;
let failed = 0;
function assert(cond: boolean, label: string) {
  if (cond) { console.log(`  ✓ ${label}`); passed++; }
  else { console.error(`  ✗ ${label}`); failed++; }
}
function makeReq(body: object): Request {
  return new Request("http://localhost/api/payments/add", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// GENERAL 분기에서 member rows가 필요
function setupMember() {
  poolState.memberRows = [{ member_id: 1, name: "테스트", branch_name: "철산점", product_name: null, end_date: null, locker_no: null }];
}
function setupPassProduct() {
  poolState.productRows = [{
    option_id: 1, option_name: "1개월 기간권", option_value: "PERIOD",
    option_type: "PASS_PRODUCT", use_yn: "Y", duration_months: 1, count_value: null
  }];
}

// ── [A] GENERAL 분기 ───────────────────────────────────────────────────────
console.log("\n[A] GENERAL 결제 — payment_purpose='GENERAL', members 불변");
{
  poolState.reset();
  setupMember();
  const req = makeReq({
    member_id: 1, branch_name: "철산점", payment_date: "2026-11-11",
    payment_method: "CARD", amount: 10000, final_amount: 10000,
    memo: "입관비", payment_purpose: "GENERAL",
  });
  const res = await POST(req);
  const json = await res.json();

  assert(json.success === true, "응답 success:true");

  const inserts = poolState.calls.filter(c => c.sql.toLowerCase().includes("insert into payments"));
  assert(inserts.length === 1, "payments INSERT 1건");

  const sql = inserts[0].sql;
  assert(sql.includes("'GENERAL'"), "INSERT에 payment_purpose='GENERAL' 리터럴 포함");
  assert(!sql.includes("'PASS'"), "INSERT에 'PASS' 없음");

  const updateMembers = poolState.calls.filter(c => c.sql.toLowerCase().includes("update members"));
  assert(updateMembers.length === 0, "members UPDATE 없음 (회원권 불변)");

  // params 개수: member_id, branch_name, payment_date, payment_method, product_name||null,
  //              amount, discount_amount, refund_amount, final_amount, memo, idempotency_key||null = 11
  assert(inserts[0].params.length === 11, `INSERT params 11개 (실제: ${inserts[0].params.length})`);
  assert(inserts[0].params[0] === 1, "params[0]=member_id=1");
  assert(inserts[0].params[5] === 10000, "params[5]=amount=10000");
}

// ── [B] PASS 분기 (PERIOD) ────────────────────────────────────────────────
console.log("\n[B] PASS 결제 (PERIOD) — payment_purpose='PASS', 같은 트랜잭션에서 members UPDATE");
{
  poolState.reset();
  setupMember();
  setupPassProduct();
  const req = makeReq({
    member_id: 1, branch_name: "철산점", payment_date: "2026-11-11",
    payment_method: "CARD", product_name: "1개월 기간권",
    amount: 60000, final_amount: 60000, payment_purpose: "PASS",
  });
  const res = await POST(req);
  const json = await res.json();

  assert(json.success === true, "응답 success:true");

  const inserts = poolState.calls.filter(c => c.sql.toLowerCase().includes("insert") && c.sql.toLowerCase().includes("payments"));
  assert(inserts.length === 1, "payments INSERT 1건");

  const sql = inserts[0].sql;
  assert(sql.includes("'PASS'"), "INSERT에 payment_purpose='PASS' 리터럴 포함");
  assert(!sql.includes("'GENERAL'"), "INSERT에 'GENERAL' 없음");

  // params 개수: idempotency_key 없음 → 14개
  // member_id, branch_name, payment_date, payment_method, product_name,
  // pass_type, total_count, start_date, end_date,
  // amount, discount_amount, refund_amount, final_amount, memo = 14
  assert(inserts[0].params.length === 14, `INSERT params 14개 (실제: ${inserts[0].params.length})`);

  const updateMembers = poolState.calls.filter(c => c.sql.toLowerCase().includes("update members"));
  assert(updateMembers.length === 1, "members UPDATE 1건 (회원권 갱신)");

  assert(poolState.txState.began, "트랜잭션 beginTransaction 호출됨");
  assert(poolState.txState.committed, "트랜잭션 commit 호출됨");
  assert(!poolState.txState.rolled, "rollback 없음");

  // payments INSERT가 members UPDATE보다 먼저 발생했는지
  const iIdx = poolState.calls.findIndex(c => c.sql.toLowerCase().includes("insert") && c.sql.toLowerCase().includes("payments"));
  const uIdx = poolState.calls.findIndex(c => c.sql.toLowerCase().includes("update members"));
  assert(iIdx < uIdx, "payments INSERT → members UPDATE 순서");
}

// ── [C] DAILY 분기 ───────────────────────────────────────────────────────
console.log("\n[C] DAILY 결제 — payment_purpose='PASS'(API 계약), members 불변, day_passes INSERT");
{
  poolState.reset();
  setupMember();
  poolState.productRows = [{
    option_id: 2, option_name: "일일권", option_value: "DAILY",
    option_type: "PASS_PRODUCT", use_yn: "Y", duration_months: 0, count_value: null
  }];
  const req = makeReq({
    member_id: 1, branch_name: "철산점", payment_date: "2026-11-11",
    payment_method: "CARD", product_name: "일일권",
    amount: 10000, final_amount: 10000, payment_purpose: "PASS",
    use_date: "2026-11-11",
  });
  const res = await POST(req);
  const json = await res.json();

  assert(json.success === true, "응답 success:true");

  const inserts = poolState.calls.filter(c => c.sql.toLowerCase().includes("insert into payments") || c.sql.toLowerCase().includes("insert ignore into payments"));
  assert(inserts.length === 1, "payments INSERT 1건");

  const sql = inserts[0].sql;
  assert(sql.toLowerCase().includes("daily"), "pass_type='DAILY' 포함");
  assert(sql.includes("'PASS'"), "payment_purpose='PASS' 리터럴 포함 (API 계약 일치)");

  const dayPassInserts = poolState.calls.filter(c => c.sql.toLowerCase().includes("insert into day_passes"));
  assert(dayPassInserts.length === 1, "day_passes INSERT 1건");

  const updateMembers = poolState.calls.filter(c => c.sql.toLowerCase().includes("update members"));
  assert(updateMembers.length === 0, "members UPDATE 없음 (기존 회원권 불변)");

  // params: idempotency_key 없음 → 11개
  assert(inserts[0].params.length === 11, `INSERT params 11개 (실제: ${inserts[0].params.length})`);
}

// ── [D] idempotency 목적 충돌 — 추가 저장 없음 ───────────────────────────
console.log("\n[D] idempotency 목적 충돌 — GENERAL 기존 행에 PASS 재시도 → 충돌 거부, 추가 저장 없음");
{
  poolState.reset();
  setupMember();
  // 기존 행: DEFAULT GENERAL로 저장된 행 (컬럼 추가 전 행 시뮬레이션)
  poolState.existing = [{ payment_id: 42, member_id: 1, product_name: "1개월 기간권", amount: 60000, payment_purpose: "GENERAL" }];
  const req = makeReq({
    member_id: 1, branch_name: "철산점", payment_date: "2026-11-11",
    payment_method: "CARD", product_name: "1개월 기간권",
    amount: 60000, final_amount: 60000, payment_purpose: "PASS",
    idempotency_key: "key-conflict-test",
  });
  const res = await POST(req);
  const json = await res.json();

  assert(json.success === false, "충돌 → success:false");
  assert(json.message.includes("이미 처리된 결제가 있을 수 있습니다"), "충돌 메시지에 '이미 처리된 결제가 있을 수 있습니다' 포함");
  assert(json.message.includes("결제 내역을 먼저 확인"), "충돌 메시지에 '결제 내역을 먼저 확인' 포함");

  const inserts = poolState.calls.filter(c => c.sql.toLowerCase().includes("insert into payments") || c.sql.toLowerCase().includes("insert ignore into payments"));
  assert(inserts.length === 0, "충돌 시 추가 INSERT 없음");

  const updateMembers = poolState.calls.filter(c => c.sql.toLowerCase().includes("update members"));
  assert(updateMembers.length === 0, "충돌 시 members UPDATE 없음");
}

// ── [E] idempotency 동일 목적 재시도 — 멱등 성공, 추가 저장 없음 ──────────
console.log("\n[E] idempotency 동일 목적 재시도 — PASS→PASS 동일 → 멱등 성공, 추가 저장 없음");
{
  poolState.reset();
  setupMember();
  poolState.existing = [{ payment_id: 55, member_id: 1, product_name: "1개월 기간권", amount: 60000, payment_purpose: "PASS" }];
  const req = makeReq({
    member_id: 1, branch_name: "철산점", payment_date: "2026-11-11",
    payment_method: "CARD", product_name: "1개월 기간권",
    amount: 60000, final_amount: 60000, payment_purpose: "PASS",
    idempotency_key: "key-idempotent-test",
  });
  const res = await POST(req);
  const json = await res.json();

  assert(json.success === true, "멱등 재시도 → success:true");
  assert(json.idempotent === true, "idempotent:true");
  assert(json.payment_id === 55, "기존 payment_id 반환");

  const inserts = poolState.calls.filter(c => c.sql.toLowerCase().includes("insert"));
  assert(inserts.length === 0, "멱등 시 추가 INSERT 없음");
}

console.log(`\n결과: ${passed}개 통과, ${failed}개 실패`);
if (failed > 0) process.exit(1);
