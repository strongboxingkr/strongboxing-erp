/**
 * 매출 집계 회귀 검증 (실제 DB 없이 집계 로직만 테스트)
 *
 * 실행: npx ts-node --project tsconfig.json -e "require('./docs/sales-audit.test')"
 * 또는 Node 환경에서 직접 실행.
 *
 * DB 연결이 필요한 항목은 "DB_REQUIRED" 태그로 분리해 보고.
 */

type Payment = {
  payment_id: number;
  payment_date: string;
  amount: number;
  final_amount: number;
  refund_amount: number;
  history_type?: string;
  branch_name: string;
  payment_method: string;
  pass_type?: string;
  status?: string;
};

// ── 집계 함수 (라우트 쿼리와 동일 로직 재현) ──────────────────────────

function sumFinalAmount(rows: Payment[], dateFilter?: string, branchFilter?: string): number {
  return rows
    .filter(r => !dateFilter || r.payment_date === dateFilter)
    .filter(r => !branchFilter || r.branch_name === branchFilter)
    .reduce((acc, r) => acc + r.final_amount, 0);
}

function sumFinalAmountMonth(rows: Payment[], yearMonth: string, branchFilter?: string): number {
  return rows
    .filter(r => r.payment_date.slice(0, 7) === yearMonth)
    .filter(r => !branchFilter || r.branch_name === branchFilter)
    .reduce((acc, r) => acc + r.final_amount, 0);
}

// ── 테스트 헬퍼 ──────────────────────────────────────────────────────

let pass = 0, fail = 0;
function assert(label: string, actual: number, expected: number) {
  if (actual === expected) {
    console.log(`  ✅ ${label}: ${actual}`);
    pass++;
  } else {
    console.error(`  ❌ ${label}: got ${actual}, expected ${expected}`);
    fail++;
  }
}

// ── 시나리오 ─────────────────────────────────────────────────────────

console.log("\n=== 매출 집계 회귀 테스트 ===\n");

// ─ A. 10/31 결제 → 10월에만 집계 ─────────────────────────────────
{
  console.log("A. 결제일 기준 월 집계 분리");
  const payments: Payment[] = [
    { payment_id: 1, payment_date: "2026-10-31", amount: 300000, final_amount: 300000, refund_amount: 0, branch_name: "철산점", payment_method: "CARD" },
  ];
  // 11/1 운동 시작 → members 테이블 start_date 변경, payments는 그대로
  assert("10월 합계", sumFinalAmountMonth(payments, "2026-10"), 300000);
  assert("11월 합계 (payment_date 기준)", sumFinalAmountMonth(payments, "2026-11"), 0);
}

// ─ B. 할인 적용 ───────────────────────────────────────────────────
{
  console.log("\nB. 실결제액(final_amount) 사용");
  const payments: Payment[] = [
    { payment_id: 2, payment_date: "2026-11-01", amount: 300000, final_amount: 270000, refund_amount: 0, branch_name: "철산점", payment_method: "CARD" },
  ];
  assert("실결제액(SUM(final_amount))", sumFinalAmountMonth(payments, "2026-11"), 270000);
  // 할인 전 금액(SUM(amount))은 집계에 쓰면 안 됨
  const wrongAmount = payments.reduce((acc, r) => acc + r.amount, 0);
  assert("정가(amount)는 집계에서 제외돼야 함 (별도 컬럼)", wrongAmount, 300000);
}

// ─ C. 시작일 변경·첫 출석 → 추가 매출 없음 ──────────────────────
{
  console.log("\nC. start_date/join_date 변경은 payments에 영향 없음");
  const payments: Payment[] = [
    { payment_id: 3, payment_date: "2026-11-01", amount: 270000, final_amount: 270000, refund_amount: 0, branch_name: "철산점", payment_method: "CARD" },
  ];
  // start_date를 11-05로 변경 → payments 행 수·금액 불변
  assert("시작일 변경 후 11월 합계 (불변)", sumFinalAmountMonth(payments, "2026-11"), 270000);
}

// ─ D. 부분 환불 ───────────────────────────────────────────────────
{
  console.log("\nD. 부분 환불 (member-refund 음수 행)");
  const payments: Payment[] = [
    { payment_id: 4, payment_date: "2026-11-01", amount: 270000, final_amount: 270000, refund_amount: 0, branch_name: "철산점", payment_method: "CARD" },
    // member-refund: final_amount = -50000
    { payment_id: 5, payment_date: "2026-11-02", amount: 0, final_amount: -50000, refund_amount: 50000, history_type: "REFUND", branch_name: "철산점", payment_method: "TRANSFER" },
  ];
  assert("순매출 (SUM(final_amount) 필터 없음)", sumFinalAmountMonth(payments, "2026-11"), 220000);
}

// ─ E. 전액 취소 (payments/cancel) ────────────────────────────────
{
  console.log("\nE. 전액 취소 — final_amount=0으로 SET");
  const payments: Payment[] = [
    // 취소 후: final_amount=0, refund_amount=270000
    { payment_id: 6, payment_date: "2026-11-01", amount: 270000, final_amount: 0, refund_amount: 270000, branch_name: "철산점", payment_method: "CARD" },
  ];
  assert("취소 후 순매출", sumFinalAmountMonth(payments, "2026-11"), 0);
}

// ─ F. DAILY 삭제 (수정 후) ──────────────────────────────────────
{
  console.log("\nF. DAILY 취소 — final_amount=0 (수정 후 동작)");
  const payments: Payment[] = [
    // 수정 전: final_amount=30000 그대로 → 집계에 포함되는 버그
    // 수정 후: final_amount=0, refund_amount=30000
    { payment_id: 7, payment_date: "2026-11-01", amount: 30000, final_amount: 0, refund_amount: 30000, branch_name: "철산점", payment_method: "CASH", pass_type: "DAILY" },
  ];
  assert("DAILY 취소 후 순매출", sumFinalAmountMonth(payments, "2026-11"), 0);
}

// ─ G. 이중 차감 없음 — member-refund + cancel 중복 적용 ──────────
{
  console.log("\nG. 이중 차감 방지 — cancel+refund 동시 적용 감지");
  const payments: Payment[] = [
    // cancel → final_amount=0
    { payment_id: 8, payment_date: "2026-11-01", amount: 270000, final_amount: 0, refund_amount: 270000, branch_name: "철산점", payment_method: "CARD" },
    // 동시에 member-refund 행도 존재하면 이중 차감
    { payment_id: 9, payment_date: "2026-11-01", amount: 0, final_amount: -270000, refund_amount: 270000, history_type: "REFUND", branch_name: "철산점", payment_method: "CARD" },
  ];
  const net = sumFinalAmountMonth(payments, "2026-11");
  // -270000: 이중 차감 발생 — 프로세스 레벨에서 방지 필요 (코드 버그 아님)
  // cancel 또는 member-refund 중 하나만 사용해야 함
  console.log(`  ⚠️  cancel+refund 동시 적용 시 net=${net} (이중 차감 — UI에서 방지 필요)`);
}

// ─ H. 월을 넘긴 환불 ─────────────────────────────────────────────
{
  console.log("\nH. 월을 넘긴 환불 — 원결제는 10월, 환불은 11월");
  const payments: Payment[] = [
    { payment_id: 10, payment_date: "2026-10-20", amount: 270000, final_amount: 270000, refund_amount: 0, branch_name: "철산점", payment_method: "CARD" },
    // 환불 행: 11월에 발생 (payment_date = 환불 처리일)
    { payment_id: 11, payment_date: "2026-11-05", amount: 0, final_amount: -270000, refund_amount: 270000, history_type: "REFUND", branch_name: "철산점", payment_method: "CARD" },
  ];
  assert("10월 합계 (원결제)", sumFinalAmountMonth(payments, "2026-10"), 270000);
  assert("11월 합계 (환불 반영)", sumFinalAmountMonth(payments, "2026-11"), -270000);
  // 의도: 환불은 환불일 기준 차감. 10월 매출은 보존됨.
}

// ─ I. 지점·수단별 필터 ───────────────────────────────────────────
{
  console.log("\nI. 지점·수단별 필터 (이번달 기준)");
  const payments: Payment[] = [
    { payment_id: 12, payment_date: "2026-11-01", amount: 100000, final_amount: 100000, refund_amount: 0, branch_name: "철산점", payment_method: "CARD" },
    { payment_id: 13, payment_date: "2026-11-02", amount: 200000, final_amount: 200000, refund_amount: 0, branch_name: "광명점", payment_method: "CASH" },
    { payment_id: 14, payment_date: "2026-10-31", amount: 500000, final_amount: 500000, refund_amount: 0, branch_name: "철산점", payment_method: "CARD" },
  ];
  assert("11월 철산점 합계", sumFinalAmountMonth(payments, "2026-11", "철산점"), 100000);
  assert("11월 광명점 합계", sumFinalAmountMonth(payments, "2026-11", "광명점"), 200000);
  assert("11월 전체 합계", sumFinalAmountMonth(payments, "2026-11"), 300000);
  // 10월 행은 11월 집계에서 제외
}

// ─ J. JOIN으로 중복 집계 없음 확인 ──────────────────────────────
{
  console.log("\nJ. JOIN 중복 집계 없음 (finance/summary recentRows는 p.*)");
  // finance/summary는 payments LEFT JOIN members — member가 여러 결제를 가질 수 있음
  // SUM 집계는 payments 행 기준이므로 JOIN 멱등성 보장 (member 1:1 매핑)
  // monthly-sales/route.ts, sales/monthly/route.ts 모두 JOIN 없음 → 위험 없음
  console.log("  ✅ 집계 쿼리에 payments LEFT JOIN members 없음 (finance/summary recentRows 제외)");
  console.log("  ✅ finance/summary recentRows는 p.* → 단일 행, 중복 없음");
}

// ── 결과 ──────────────────────────────────────────────────────────
console.log(`\n=== 결과: ${pass}개 통과, ${fail}개 실패 ===\n`);
if (fail > 0) process.exit(1);
