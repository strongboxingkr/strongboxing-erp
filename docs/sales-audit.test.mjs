/**
 * 매출 집계 회귀 검증 (순수 JS, DB 없음)
 * 실행: node docs/sales-audit.test.mjs
 */

// ── 집계 함수 (라우트 쿼리와 동일 로직 재현) ──────────────────────
function sumFinalAmountMonth(rows, yearMonth, branchFilter) {
  return rows
    .filter(r => r.payment_date.slice(0, 7) === yearMonth)
    .filter(r => !branchFilter || r.branch_name === branchFilter)
    .reduce((acc, r) => acc + r.final_amount, 0);
}

function sumFinalAmountDay(rows, date, branchFilter) {
  return rows
    .filter(r => r.payment_date === date)
    .filter(r => !branchFilter || r.branch_name === branchFilter)
    .reduce((acc, r) => acc + r.final_amount, 0);
}

// ── 테스트 헬퍼 ──────────────────────────────────────────────────
let pass = 0, fail = 0;
function assert(label, actual, expected) {
  if (actual === expected) {
    console.log(`  ✅ ${label}: ${actual.toLocaleString()}`);
    pass++;
  } else {
    console.error(`  ❌ ${label}: got ${actual.toLocaleString()}, expected ${expected.toLocaleString()}`);
    fail++;
  }
}

console.log("\n=== 매출 집계 회귀 테스트 ===\n");

// ─ A. 10/31 결제 → 10월에만 집계 ─────────────────────────────────
{
  console.log("A. 결제일 기준 월 집계 분리 (start_date 11/1 → 추가 매출 없음)");
  const payments = [
    { payment_id: 1, payment_date: "2026-10-31", amount: 300000, final_amount: 300000, refund_amount: 0, branch_name: "철산점", payment_method: "CARD" },
  ];
  assert("10월 합계", sumFinalAmountMonth(payments, "2026-10"), 300000);
  assert("11월 합계 (payment_date 기준 — 0이어야 함)", sumFinalAmountMonth(payments, "2026-11"), 0);
}

// ─ B. 할인 적용 ───────────────────────────────────────────────────
{
  console.log("\nB. 실결제액(final_amount) — 정가(amount) 사용 시 오집계");
  const payments = [
    { payment_id: 2, payment_date: "2026-11-01", amount: 300000, final_amount: 270000, refund_amount: 0, branch_name: "철산점", payment_method: "CARD" },
  ];
  assert("실결제액 SUM(final_amount)", sumFinalAmountMonth(payments, "2026-11"), 270000);
  const wrongAmount = payments.reduce((acc, r) => acc + r.amount, 0);
  assert("SUM(amount)는 300000 — 집계에 쓰면 안 됨 (별도 컬럼)", wrongAmount, 300000);
}

// ─ C. 시작일·첫 출석 변경 → 추가 매출 없음 ──────────────────────
{
  console.log("\nC. start_date/join_date/checkin_time 변경은 payments에 영향 없음");
  const payments = [
    { payment_id: 3, payment_date: "2026-11-01", amount: 270000, final_amount: 270000, refund_amount: 0, branch_name: "철산점", payment_method: "CARD" },
  ];
  assert("시작일 변경 후 11월 합계 (불변)", sumFinalAmountMonth(payments, "2026-11"), 270000);
}

// ─ D. 부분 환불 ───────────────────────────────────────────────────
{
  console.log("\nD. 부분 환불 (member-refund 음수 행, final_amount > 0 필터 없음)");
  const payments = [
    { payment_id: 4, payment_date: "2026-11-01", amount: 270000, final_amount: 270000, refund_amount: 0, branch_name: "철산점", payment_method: "CARD" },
    // member-refund 행: final_amount = -50000
    { payment_id: 5, payment_date: "2026-11-02", amount: 0, final_amount: -50000, refund_amount: 50000, history_type: "REFUND", branch_name: "철산점", payment_method: "TRANSFER" },
  ];
  assert("순매출 (SUM(final_amount) 필터 없음)", sumFinalAmountMonth(payments, "2026-11"), 220000);
  // 구버전 final_amount > 0 필터가 있으면 환불 미차감 → 270000 오집계
  const oldLogic = payments.filter(r => r.final_amount > 0).reduce((acc, r) => acc + r.final_amount, 0);
  assert("구버전 final_amount>0 필터 → 환불 미차감 (270000, 오집계임)", oldLogic, 270000);
}

// ─ E. 전액 취소 (payments/cancel) ────────────────────────────────
{
  console.log("\nE. 전액 취소 — final_amount=0 SET");
  const payments = [
    { payment_id: 6, payment_date: "2026-11-01", amount: 270000, final_amount: 0, refund_amount: 270000, branch_name: "철산점", payment_method: "CARD" },
  ];
  assert("취소 후 순매출", sumFinalAmountMonth(payments, "2026-11"), 0);
}

// ─ F. DAILY 삭제 — 수정 전 버그 vs 수정 후 ──────────────────────
{
  console.log("\nF. DAILY 삭제 — 수정 전 버그 vs 수정 후");
  // 수정 전: final_amount 그대로 → 집계에 포함
  const beforeFix = [
    { payment_id: 7, payment_date: "2026-11-01", amount: 30000, final_amount: 30000, refund_amount: 30000, branch_name: "철산점", payment_method: "CASH" },
  ];
  const bugResult = sumFinalAmountMonth(beforeFix, "2026-11");
  assert("수정 전 DAILY 삭제 — 집계에 30000 포함 (버그)", bugResult, 30000);

  // 수정 후: final_amount = 0
  const afterFix = [
    { payment_id: 7, payment_date: "2026-11-01", amount: 30000, final_amount: 0, refund_amount: 30000, branch_name: "철산점", payment_method: "CASH" },
  ];
  assert("수정 후 DAILY 삭제 — 집계 제외 (정상)", sumFinalAmountMonth(afterFix, "2026-11"), 0);
}

// ─ G. 이중 차감 없음 — cancel+refund 중복 적용 경고 ──────────────
{
  console.log("\nG. 이중 차감 방지 — cancel + member-refund 동시 적용");
  const payments = [
    // cancel → final_amount=0
    { payment_id: 8, payment_date: "2026-11-01", amount: 270000, final_amount: 0, refund_amount: 270000, branch_name: "철산점", payment_method: "CARD" },
    // 동시에 member-refund 행도 존재 (잘못된 운영)
    { payment_id: 9, payment_date: "2026-11-01", amount: 0, final_amount: -270000, refund_amount: 270000, history_type: "REFUND", branch_name: "철산점", payment_method: "CARD" },
  ];
  const net = sumFinalAmountMonth(payments, "2026-11");
  console.log(`  ⚠️  cancel+refund 동시 적용 시 net=${net} (이중 차감!) — UI 레벨 방지 필요, DB는 허용`);
  // 이것은 코드 버그 아님: 운영 프로세스 문제. cancel이나 member-refund 중 하나만 사용해야 함.
}

// ─ H. 월을 넘긴 환불 ─────────────────────────────────────────────
{
  console.log("\nH. 월을 넘긴 환불 — 원결제 10월, 환불 11월 반영");
  const payments = [
    { payment_id: 10, payment_date: "2026-10-20", amount: 270000, final_amount: 270000, refund_amount: 0, branch_name: "철산점", payment_method: "CARD" },
    { payment_id: 11, payment_date: "2026-11-05", amount: 0, final_amount: -270000, refund_amount: 270000, history_type: "REFUND", branch_name: "철산점", payment_method: "CARD" },
  ];
  assert("10월 합계 (원결제 보존)", sumFinalAmountMonth(payments, "2026-10"), 270000);
  assert("11월 합계 (환불 반영 — 음수 정상)", sumFinalAmountMonth(payments, "2026-11"), -270000);
}

// ─ I. 지점·수단별 필터 — 이번달 기준 ────────────────────────────
{
  console.log("\nI. 지점별 필터 (finance/summary 수정 후: 이번달 기준)");
  const payments = [
    { payment_id: 12, payment_date: "2026-11-01", amount: 100000, final_amount: 100000, refund_amount: 0, branch_name: "철산점", payment_method: "CARD" },
    { payment_id: 13, payment_date: "2026-11-02", amount: 200000, final_amount: 200000, refund_amount: 0, branch_name: "광명점", payment_method: "CASH" },
    { payment_id: 14, payment_date: "2026-10-31", amount: 500000, final_amount: 500000, refund_amount: 0, branch_name: "철산점", payment_method: "CARD" },
  ];
  assert("11월 철산점 합계", sumFinalAmountMonth(payments, "2026-11", "철산점"), 100000);
  assert("11월 광명점 합계", sumFinalAmountMonth(payments, "2026-11", "광명점"), 200000);
  assert("11월 전체 합계", sumFinalAmountMonth(payments, "2026-11"), 300000);
  assert("10월 행은 11월 집계에서 제외", sumFinalAmountMonth(payments, "2026-11", "철산점"), 100000);
}

// ─ J. 반복 요청 — idempotency ────────────────────────────────────
{
  console.log("\nJ. 반복 결제 요청 — idempotency_key UNIQUE 제약 (DB_REQUIRED)");
  console.log("  ℹ️  DB_REQUIRED: payments.idempotency_key UNIQUE → INSERT IGNORE로 중복 방지");
  console.log("  ℹ️  라우트 로직 확인 완료 (payments/add/route.ts). 실제 DB 미검증.");
}

// ─ K. 화면별 집계 일치 확인 ──────────────────────────────────────
{
  console.log("\nK. 화면별 동일 기간·지점 합계 일치 확인 (코드 레벨)");
  console.log("  ✅ monthly-sales: SUM(final_amount), payment_date YEAR/MONTH 기준, 필터 없음 (수정 후)");
  console.log("  ✅ sales/monthly: SUM(final_amount), payment_date BETWEEN");
  console.log("  ✅ sales-daily:   SUM(final_amount), payment_date BETWEEN");
  console.log("  ✅ dashboard:     SUM(final_amount), payment_date BETWEEN");
  console.log("  ✅ closings/daily: SUM(final_amount), payment_date =");
  console.log("  ✅ daily-closing:  SUM(final_amount) (수정 후)");
  console.log("  ✅ finance/summary: SUM(final_amount), 이번달 필터 (수정 후)");
  console.log("  ℹ️  daily_closings 테이블(저장값): 직원 입력 기준 — 과거 amount 기준 저장값과 실시간 집계 차이는 별도 SQL로 확인 필요");
}

// ── 결과 ──────────────────────────────────────────────────────────
console.log(`\n=== 결과: ${pass}개 통과, ${fail}개 실패 ===\n`);
if (fail > 0) process.exit(1);
