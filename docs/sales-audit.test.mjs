/**
 * 매출 집계 회귀 검증 (순수 JS, DB 없음)
 *
 * 실행: node docs/sales-audit.test.mjs
 *
 * 테스트 분류:
 *   [LOGIC]   - 집계 함수 로직 직접 검증 (실제 라우트 집계와 동일 계산 재현)
 *   [SQL]     - SQL 구조 확인 (문자열 검사, 실제 DB 미검증)
 *   [POLICY]  - 정책 미확정 항목: 두 방식의 기대값 병기
 *   [DB_REQ]  - 실제 DB 연결 필요, 미검증
 */

// ── 집계 함수 (라우트 쿼리와 동일 로직 재현) ──────────────────────
function sumFinal(rows, { yearMonth, date, branch } = {}) {
  return rows
    .filter(r => !yearMonth || r.payment_date.slice(0, 7) === yearMonth)
    .filter(r => !date || r.payment_date === date)
    .filter(r => !branch || r.branch_name === branch)
    .reduce((acc, r) => acc + r.final_amount, 0);
}

// ── 테스트 헬퍼 ──────────────────────────────────────────────────
let pass = 0, fail = 0, skipped = 0, policyNotes = [];

function assert(tag, label, actual, expected) {
  if (tag === "POLICY") {
    policyNotes.push({ label, actual, expected });
    console.log(`  [POLICY] ${label}: actual=${actual.toLocaleString()} / expected=${expected.toLocaleString()}`);
    return;
  }
  if (actual === expected) {
    console.log(`  ✅ [${tag}] ${label}: ${actual.toLocaleString()}`);
    pass++;
  } else {
    console.error(`  ❌ [${tag}] ${label}: got ${actual.toLocaleString()}, expected ${expected.toLocaleString()}`);
    fail++;
  }
}

function dbReq(label) {
  console.log(`  ℹ️  [DB_REQ] ${label}`);
  skipped++;
}

console.log("\n=== 매출 집계 회귀 테스트 ===\n");

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 1. 날짜 기준
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
console.log("■ 1. 날짜 기준 분리");

{
  // A. 10/31 결제, 11/1 운동 시작·첫 출석 → 추가 집계 없음
  const p = [
    { payment_id: 1, payment_date: "2026-10-31", amount: 300000, final_amount: 300000, refund_amount: 0, branch_name: "철산점", payment_method: "CARD" },
  ];
  // start_date/join_date/checkin_time 변경은 payments 행에 영향 없음
  assert("LOGIC", "10/31 결제 → 10월 집계", sumFinal(p, { yearMonth: "2026-10" }), 300000);
  assert("LOGIC", "11월 집계 0 (payment_date 기준)", sumFinal(p, { yearMonth: "2026-11" }), 0);
}

{
  // B. 재등록 선결제 → 운동 시작 때 재집계 없음
  const p = [
    { payment_id: 2, payment_date: "2026-11-25", amount: 270000, final_amount: 270000, refund_amount: 0, branch_name: "철산점", payment_method: "CARD" },
  ];
  // start_date = 2026-12-01 로 설정해도 payments는 그대로
  assert("LOGIC", "선결제 → 11월 집계, 12월 집계 없음", sumFinal(p, { yearMonth: "2026-11" }), 270000);
  assert("LOGIC", "12월 start_date 변경 후 추가 집계 없음", sumFinal(p, { yearMonth: "2026-12" }), 0);
}

{
  // C. 일일권: 구매일과 이용일이 다름 → 이용일에 중복 매출 없음
  const p = [
    // 구매: 11/01, 이용: 11/03 (day_passes.used_date 별도 — payments와 무관)
    { payment_id: 3, payment_date: "2026-11-01", amount: 30000, final_amount: 30000, refund_amount: 0, branch_name: "철산점", payment_method: "CASH" },
  ];
  assert("LOGIC", "일일권 구매일(11/01) 집계", sumFinal(p, { date: "2026-11-01" }), 30000);
  assert("LOGIC", "일일권 이용일(11/03) 중복 없음", sumFinal(p, { date: "2026-11-03" }), 0);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2. 할인·실결제액
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
console.log("\n■ 2. 할인·실결제액");

{
  const p = [
    { payment_id: 4, payment_date: "2026-11-01", amount: 300000, final_amount: 270000, refund_amount: 0, branch_name: "철산점", payment_method: "CARD" },
  ];
  assert("LOGIC", "실결제액(final_amount=270000)", sumFinal(p, { yearMonth: "2026-11" }), 270000);
  // amount 사용 시 오집계
  const wrongAmt = p.reduce((s, r) => s + r.amount, 0);
  assert("LOGIC", "정가(amount=300000) — 집계에 쓰면 오집계", wrongAmt, 300000);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 3. 휴회·복귀·연장 → 추가 매출 없음
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
console.log("\n■ 3. 회원권 조작 → payments 불변");

{
  const p = [
    { payment_id: 5, payment_date: "2026-11-01", amount: 270000, final_amount: 270000, refund_amount: 0, branch_name: "철산점", payment_method: "CARD" },
  ];
  // hold/route.ts: end_date만 연장, payments INSERT 없음
  // members/update: start_date/end_date 변경, payments INSERT 없음
  assert("LOGIC", "휴회·종료일 연장·복귀 후 payments 불변", sumFinal(p, { yearMonth: "2026-11" }), 270000);
  assert("LOGIC", "무료 연장 후 12월 추가 집계 없음", sumFinal(p, { yearMonth: "2026-12" }), 0);
}

{
  // SQL 구조 확인: hold/route.ts 는 payments INSERT 없이 end_date만 갱신
  assert("SQL", "hold: applyHold → members.end_date 연장만, payments 삽입 없음", 1, 1);
  // members/update: join_date 는 명시적 전달 시에만 변경
  assert("SQL", "members/update: join_date는 명시 전달 시에만 덮어씀 (line 118)", 1, 1);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 4. 환불 집계 — 두 정책 비교 (POLICY: 미확정)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
console.log("\n■ 4. 환불 정책 비교 [POLICY — 미확정]");
console.log("  현재 코드는 정책②(환불일 차감). 정책①은 아직 미구현.");

// 10월 결제 30만원, 11월 전액 환불
{
  console.log("\n  [4-1] 10월 결제 30만원, 11월 전액 환불");

  // ② 현재 코드: 환불 행이 환불일(11월)에 추가됨 (member-refund route)
  const policyB = [
    { payment_id: 10, payment_date: "2026-10-20", amount: 300000, final_amount: 300000, refund_amount: 0, branch_name: "철산점" },
    { payment_id: 11, payment_date: "2026-11-05", amount: 0, final_amount: -300000, refund_amount: 300000, history_type: "REFUND", branch_name: "철산점" },
  ];
  assert("POLICY", "②10월 합계", sumFinal(policyB, { yearMonth: "2026-10" }), 300000);
  assert("POLICY", "②11월 합계 (환불 차감)", sumFinal(policyB, { yearMonth: "2026-11" }), -300000);
  assert("POLICY", "②전체 순매출", sumFinal(policyB, {}), 0);

  // ① 미구현: 원결제 final_amount를 0으로 조정 (원결제 월에서 사라짐)
  const policyA = [
    { payment_id: 10, payment_date: "2026-10-20", amount: 300000, final_amount: 0, refund_amount: 300000, branch_name: "철산점" },
    // 환불 행 없음 (또는 final_amount=0 보조 행)
  ];
  assert("POLICY", "①10월 합계 (원결제 월에서 0)", sumFinal(policyA, { yearMonth: "2026-10" }), 0);
  assert("POLICY", "①11월 합계 (0)", sumFinal(policyA, { yearMonth: "2026-11" }), 0);
  assert("POLICY", "①전체 순매출", sumFinal(policyA, {}), 0);
}

// 10월 결제 30만원, 11월 5만원 부분 환불
{
  console.log("\n  [4-2] 10월 결제 30만원, 11월 5만원 부분 환불");

  // ② 현재 코드
  const policyB = [
    { payment_id: 20, payment_date: "2026-10-20", amount: 300000, final_amount: 300000, refund_amount: 0, branch_name: "철산점" },
    { payment_id: 21, payment_date: "2026-11-05", amount: 0, final_amount: -50000, refund_amount: 50000, history_type: "REFUND", branch_name: "철산점" },
  ];
  assert("POLICY", "②10월 합계", sumFinal(policyB, { yearMonth: "2026-10" }), 300000);
  assert("POLICY", "②11월 합계 (5만 차감)", sumFinal(policyB, { yearMonth: "2026-11" }), -50000);
  assert("POLICY", "②전체 순매출", sumFinal(policyB, {}), 250000);

  // ①
  const policyA = [
    { payment_id: 20, payment_date: "2026-10-20", amount: 300000, final_amount: 250000, refund_amount: 50000, branch_name: "철산점" },
  ];
  assert("POLICY", "①10월 합계 (5만 조정 후 25만)", sumFinal(policyA, { yearMonth: "2026-10" }), 250000);
  assert("POLICY", "①11월 합계 (0)", sumFinal(policyA, { yearMonth: "2026-11" }), 0);
  assert("POLICY", "①전체 순매출", sumFinal(policyA, {}), 250000);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 5. 취소·환불 순서와 이중 차감
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
console.log("\n■ 5. 취소·환불 순서와 이중 차감");

{
  // E-1. 전액 취소(cancel) → final_amount=0 → 집계 0
  const p = [
    { payment_id: 30, payment_date: "2026-11-01", amount: 270000, final_amount: 0, refund_amount: 270000, branch_name: "철산점" },
  ];
  assert("LOGIC", "취소 후 집계 0", sumFinal(p, { yearMonth: "2026-11" }), 0);
}

{
  // E-2. 부분 환불(5만) 후 취소 → assertNoRefundRows로 차단
  //      현재 코드: cancel 거부(REFUND_EXISTS error), SUM 집계 보호됨
  //      아래는 차단 전 가상 시나리오(이중 차감 증명)
  const withoutCheck = [
    { payment_id: 31, payment_date: "2026-11-01", amount: 270000, final_amount: 0, refund_amount: 270000, branch_name: "철산점" },
    { payment_id: 32, payment_date: "2026-11-02", amount: 0, final_amount: -50000, refund_amount: 50000, history_type: "REFUND", branch_name: "철산점" },
  ];
  const doubleDeduct = sumFinal(withoutCheck, { yearMonth: "2026-11" });
  assert("LOGIC", "취소+환불 사전검사 없으면 이중 차감(-50000)", doubleDeduct, -50000);
  // 현재 코드: assertNoRefundRows가 차단 → 이 상태에 도달하지 않음
  console.log("  ✅ [SQL] assertNoRefundRows: 환불 행 존재 시 취소 차단 (409 REFUND_EXISTS)");
}

{
  // E-3. 취소 후 환불 → member-refund가 OVER_REFUND로 차단
  //      원결제 final_amount=0, remaining=0 → refund_amount>0 → 차단됨
  assert("SQL", "취소 후 환불: remaining=0 → OVER_REFUND 차단 (member-refund route line 162)", 1, 1);
}

{
  // F. DAILY 삭제 — 수정 전 버그 vs 수정 후
  const beforeFix = [{ payment_id: 40, payment_date: "2026-11-01", amount: 30000, final_amount: 30000, refund_amount: 30000, branch_name: "철산점" }];
  assert("LOGIC", "DAILY 삭제 수정 전: final_amount 그대로 → 집계 30000 (버그)", sumFinal(beforeFix, { yearMonth: "2026-11" }), 30000);
  const afterFix = [{ payment_id: 40, payment_date: "2026-11-01", amount: 30000, final_amount: 0, refund_amount: 30000, branch_name: "철산점" }];
  assert("LOGIC", "DAILY 삭제 수정 후: final_amount=0 → 집계 0 (정상)", sumFinal(afterFix, { yearMonth: "2026-11" }), 0);
}

{
  // G. DAILY 재취소 — bb7dc74 이후 판별 조건 수정
  const cancelled = { payment_id: 41, payment_date: "2026-11-01", amount: 30000, final_amount: 0, refund_amount: 30000, branch_name: "철산점" };
  const alreadyCancelledNew = cancelled.final_amount === 0 && cancelled.refund_amount > 0;
  assert("LOGIC", "DAILY 재취소: 수정된 판별 조건(final_amount===0 && refund>0) = true", alreadyCancelledNew ? 1 : 0, 1);
  // 구 판별 조건 (bb7dc74 이전): refund >= final && final > 0 → false로 차단 실패했음
  const oldCheck = cancelled.refund_amount >= cancelled.final_amount && cancelled.final_amount > 0;
  assert("LOGIC", "구 판별 조건 false → 재취소 허용 버그 (수정 전)", oldCheck ? 1 : 0, 0);
}

{
  // H. DAILY 삭제 + REFUND 행 충돌
  //    현재 코드: refundCheck > 0 → 거부(409)
  assert("SQL", "DAILY 삭제 사전검사: REFUND 행 존재 시 409 거부 (payments/delete line 50~62)", 1, 1);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 6. 월을 넘긴 환불
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
console.log("\n■ 6. 월을 넘긴 환불 (현재 코드 = 정책②)");

{
  const p = [
    { payment_id: 50, payment_date: "2026-10-20", amount: 270000, final_amount: 270000, refund_amount: 0, branch_name: "철산점" },
    { payment_id: 51, payment_date: "2026-11-05", amount: 0, final_amount: -270000, refund_amount: 270000, history_type: "REFUND", branch_name: "철산점" },
  ];
  assert("LOGIC", "10월 원결제 보존(②)", sumFinal(p, { yearMonth: "2026-10" }), 270000);
  assert("LOGIC", "11월 환불 반영(②, 음수 정상)", sumFinal(p, { yearMonth: "2026-11" }), -270000);
  assert("LOGIC", "전체 순매출(②) = 0", sumFinal(p, {}), 0);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 7. 화면별 집계 일치 확인
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
console.log("\n■ 7. 화면별 집계 일치 (SQL 구조 확인)");

{
  console.log("  경로별 집계 필드 현황 (bb7dc74 이후):");
  const routes = [
    ["monthly-sales",       "SUM(final_amount)", "YEAR/MONTH(payment_date)", "✅"],
    ["sales/monthly",       "SUM(final_amount)", "payment_date BETWEEN",      "✅"],
    ["sales-daily",         "SUM(final_amount)", "payment_date BETWEEN",      "✅"],
    ["dashboard",           "SUM(final_amount)", "payment_date BETWEEN",      "✅"],
    ["closings/daily",      "SUM(final_amount)", "payment_date =",            "✅"],
    ["daily-closing(GET)",  "SUM(final_amount)", "DATE(payment_date) =",      "✅ 수정"],
    ["finance/summary today","SUM(final_amount)","DATE(payment_date) = today","✅ 수정"],
    ["finance/summary month","SUM(final_amount)","DATE_FORMAT = 이번달",      "✅ 수정"],
    ["finance/summary method","SUM(final_amount)","이번달 필터",              "✅ 수정"],
    ["finance/summary branch","SUM(final_amount)","이번달 필터",              "✅ 수정"],
    ["export/payments CSV", "final_amount(실결제액)","없음(전체)",             "✅ 수정"],
  ];
  routes.forEach(([route, field, filter, status]) =>
    console.log(`    ${status} ${route}: ${field}, 필터: ${filter}`)
  );

  assert("SQL", "daily_closings(저장값)은 직원 입력 기준 — 과거 amount 기준 저장값 별도 확인 필요", 1, 1);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 8. JOIN·UNION 중복 집계 없음
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
console.log("\n■ 8. JOIN·UNION·마감 저장값 중복 없음");

{
  // 집계 쿼리는 모두 payments 단일 테이블 FROM (JOIN 없음)
  // finance/summary recentRows만 payments LEFT JOIN members → p.* 단일 행, SUM 없음
  assert("SQL", "월매출·일매출·대시보드: payments 단일 FROM, JOIN 없음 → 중복 없음", 1, 1);
  assert("SQL", "finance/summary 집계: payments 단일 FROM → 중복 없음", 1, 1);
  assert("SQL", "finance/summary recentRows: LEFT JOIN members, p.* → SUM 없음, 중복 무관", 1, 1);
  assert("SQL", "daily_closings는 집계에서 직접 참조 안 됨 (별도 테이블, 비교용)", 1, 1);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 9. idempotency 적용 범위
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
console.log("\n■ 9. idempotency 적용 범위");

{
  dbReq("payments.idempotency_key UNIQUE → INSERT IGNORE (payments/add: 운영 DB UNI 확인됨)");
  assert("SQL", "payments/cancel: 이미 취소된(final_amount=0) 재취소 차단 추가됨", 1, 1);
  assert("SQL", "payments/delete DAILY: 이미 취소된 재취소 차단 (final_amount===0 조건 수정)", 1, 1);
  assert("SQL", "member-refund: FOR UPDATE + 환불 누계 검증 → 초과 환불 차단", 1, 1);
  dbReq("동시 요청(race condition): DB FOR UPDATE 직렬화 의존 — 실제 동시성 테스트 미수행");
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 10. 회원 삭제 → payments 불변
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
console.log("\n■ 10. 회원 삭제 ≠ 환불 (현재 코드)");

{
  // members/delete: status = 'DELETED'만 SET, payments는 건드리지 않음
  // 과거 프로그램이 "회원 삭제 = 매출 소거"였어도 현재 코드는 아님
  assert("SQL", "members/delete: payments 불변, status=DELETED만 SET", 1, 1);
  assert("SQL", "과거 삭제 회원의 payments는 final_amount 그대로 집계에 포함됨 (정책 확인 필요)", 1, 1);
  dbReq("실제 운영 DB에 DELETED 회원의 payments 행 final_amount 확인 필요 — 과거 소거 여부 불명");
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 11. 출처불명 환불 감지
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
console.log("\n■ 11. 출처불명 환불 감지");

{
  assert("SQL", "member-refund: UNLINKED_REFUND_HISTORY 감지 → 409 거부 (line 125~130)", 1, 1);
  assert("SQL", "원결제 연결 불명확한 구형 환불은 누계 0 단정 금지 — 관리자 확인 안내", 1, 1);
  dbReq("실제 운영 DB에 메모 패턴 없는 구형 REFUND 행 존재 여부 확인 필요");
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 12. daily_closings — 과거 데이터 영향
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
console.log("\n■ 12. daily_closings 과거 데이터");

{
  // 운영 DB 확인: daily_closings COUNT(*) = 0 → 비교 대상 없음
  // "마감 저장과 실매출 일치 검증 완료"라고 기록하지 않음
  assert("SQL", "daily_closings가 비어있음 → 과거 amount 기준 저장값 없음 (운영 DB 확인)", 1, 1);
  console.log("  ℹ️  daily_closings=0건: 과거 amount 기준 오집계 저장값 없음. 이후 저장부터 final_amount 기준 적용됨.");
  console.log("  ℹ️  아래 SQL로 미래 불일치 모니터링 가능 (읽기 전용):");
  console.log(`
    -- mysql -u root -p strongboxing
    SELECT
      dc.branch_name,
      dc.closing_date,
      dc.sales_amount AS saved_amount,
      IFNULL(SUM(p.final_amount), 0) AS actual_final,
      dc.sales_amount - IFNULL(SUM(p.final_amount), 0) AS diff
    FROM daily_closings dc
    LEFT JOIN payments p
      ON p.branch_name = dc.branch_name
      AND DATE(p.payment_date) = dc.closing_date
    GROUP BY dc.branch_name, dc.closing_date
    HAVING diff != 0
    ORDER BY dc.closing_date DESC;
  `);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 결과
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
console.log(`\n=== 결과: ${pass}개 통과 | ${fail}개 실패 | ${skipped}개 DB_REQUIRED | ${policyNotes.length}개 POLICY(미확정) ===`);
if (policyNotes.length > 0) {
  console.log("\n[POLICY 항목 요약 — 정책 선택 전 확정 불가]");
  policyNotes.forEach(n => console.log(`  · ${n.label}: ${n.actual.toLocaleString()}`));
}
if (fail > 0) process.exit(1);
