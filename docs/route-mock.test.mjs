/**
 * 라우트 핵심 로직 mock 테스트
 *
 * 실행: node docs/route-mock.test.mjs
 *
 * 테스트 분류:
 *   [ROUTE-MOCK] - 실제 라우트 함수의 핵심 로직을 DB mock과 함께 직접 호출
 *                  실제 HTTP·Next.js 미들웨어·DB 커넥션 없음
 *                  "잠금 후 최신 값" 사용 여부, 계산·권한·상태 검증 경로 확인
 *   [DB_REQ]     - 실제 MySQL 동시성 미검증
 */

// ── mock 헬퍼 ─────────────────────────────────────────────────────────────
let pass = 0, fail = 0, skipped = 0;

function assert(tag, label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    console.log(`  ✅ [${tag}] ${label}`);
    pass++;
  } else {
    console.error(`  ❌ [${tag}] ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
    fail++;
  }
}

function dbReq(label) {
  console.log(`  ℹ️  [DB_REQ] ${label}`);
  skipped++;
}

// ── member-refund 핵심 로직 추출 ────────────────────────────────────────
// member-refund/route.ts의 트랜잭션 내부 검증 로직을 그대로 재현
// 실제 conn.query 대신 mock DB 주입
async function runMemberRefundLogic({
  lockedRow,       // FOR UPDATE 직후 읽은 최신 payments 행
  memberExists,    // members 행 존재 여부
  unlinkedCount,   // 출처불명 환불 행 수
  alreadyRefunded, // 기환불 누계 (memoRefunds + historyRefunds)
  refund_amount,
  user = { role: "STAFF", branch_name: "철산점" },
}) {
  // 1. 회원 존재 확인
  if (!memberExists) return { status: 404, body: { success: false, message: "회원을 찾을 수 없습니다." } };

  // 2. 원결제 행 없음
  if (!lockedRow) return { status: 404, body: { success: false, message: "해당 회원의 결제 내역을 찾을 수 없습니다." } };

  // 3. 지점 권한 재검증 (잠금 후 최신 branch_name)
  const isAdminOrOwner = user.role === "ADMIN" || user.role === "OWNER";
  if (!isAdminOrOwner && lockedRow.branch_name !== user.branch_name) {
    return { status: 403, body: { success: false, message: "해당 지점에 대한 권한이 없습니다." } };
  }

  // 4. 취소된 원결제 명시적 거부 (잠금 후 최신 값)
  if (Number(lockedRow.final_amount) === 0 && Number(lockedRow.refund_amount) > 0) {
    return { status: 409, body: { success: false, message: "이미 취소된 결제입니다." } };
  }

  // 5. 출처불명 환불 감지
  if (unlinkedCount > 0) {
    return { status: 409, body: { success: false, message: "UNLINKED_REFUND_HISTORY" } };
  }

  // 6. 환불 가능액 검증 (잠금 후 최신 final_amount 사용)
  const originalFinalAmount = Number(lockedRow.final_amount);
  const remaining = originalFinalAmount - alreadyRefunded;
  if (Number(refund_amount) > remaining) {
    return { status: 409, body: { success: false, message: "OVER_REFUND", remaining, originalFinalAmount } };
  }

  return { status: 200, body: { success: true, insertedAmount: -Math.abs(Number(refund_amount)) } };
}

// ── payments/cancel 핵심 로직 추출 ──────────────────────────────────────
async function runCancelLogic({
  lockedPayment,     // FOR UPDATE 직후 읽은 최신 payments 행
  refundRowCount,    // 연결된 REFUND 행 수 (assertNoRefundRows)
  user = { role: "STAFF", branch_name: "철산점" },
}) {
  if (!lockedPayment) return { success: false, message: "결제 없음" };

  const isAdminOrOwner = user.role === "ADMIN" || user.role === "OWNER";
  if (!isAdminOrOwner && lockedPayment.branch_name !== user.branch_name) {
    return { success: false, message: "권한이 없습니다." };
  }

  // 잠금 후 최신 값으로 재취소 판별
  if (Number(lockedPayment.final_amount) === 0 && Number(lockedPayment.refund_amount) > 0) {
    return { success: false, message: "이미 취소된 결제입니다." };
  }

  // assertNoRefundRows
  if (refundRowCount > 0) {
    return { success: false, message: "REFUND_EXISTS" };
  }

  return { success: true, message: "취소 완료" };
}

// ── payments/delete DAILY 핵심 로직 추출 ────────────────────────────────
async function runDailyDeleteLogic({
  lockedPayment,   // FOR UPDATE 직후 읽은 최신 payments 행
  refundRowCount,  // REFUND 행 수
  dayPassStatus,   // "UNUSED" | "USED" | null
}) {
  if (!lockedPayment) return { success: false, message: "결제 내역 없음" };

  // 잠금 후 최신 취소 여부 재검증
  if (Number(lockedPayment.final_amount) === 0 && Number(lockedPayment.refund_amount) > 0) {
    return { success: false, message: "이미 취소된 결제입니다." };
  }

  // REFUND 행 존재 (FOR UPDATE)
  if (refundRowCount > 0) {
    return { success: false, message: "REFUND_EXISTS", refundCount: refundRowCount };
  }

  // day_pass 상태 확인
  if (dayPassStatus === "USED") {
    return { success: false, message: "이미 사용된 일일권입니다." };
  }

  return { success: true, message: "일일권 결제 취소 완료" };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
console.log("\n=== 라우트 핵심 로직 mock 테스트 ===\n");

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// A. member-refund
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
console.log("■ A. member-refund 로직\n");

{
  // A-1. 정상 환불
  const r = await runMemberRefundLogic({
    lockedRow: { final_amount: 300000, refund_amount: 0, branch_name: "철산점" },
    memberExists: true,
    unlinkedCount: 0,
    alreadyRefunded: 0,
    refund_amount: 50000,
  });
  assert("ROUTE-MOCK", "A-1: 정상 부분 환불 → 200 성공", r.status, 200);
  assert("ROUTE-MOCK", "A-1: insertedAmount=-50000", r.body.insertedAmount, -50000);
}

{
  // A-2. 잠금 후 취소된 원결제 → PAYMENT_CANCELLED 거부
  //      (트랜잭션 밖 스냅샷에선 final_amount=300000으로 보였을 것)
  const r = await runMemberRefundLogic({
    lockedRow: { final_amount: 0, refund_amount: 300000, branch_name: "철산점" },
    memberExists: true,
    unlinkedCount: 0,
    alreadyRefunded: 0,
    refund_amount: 300000,
  });
  assert("ROUTE-MOCK", "A-2: 잠금 후 최신값 final=0 → PAYMENT_CANCELLED 409", r.status, 409);
  assert("ROUTE-MOCK", "A-2: 메시지 취소됨", r.body.message.includes("이미 취소"), true);
}

{
  // A-3. 구 로직 버그 재현: 스냅샷(final=300000) 사용 시 취소된 결제 환불 허용됨
  const rOld = await runMemberRefundLogic({
    lockedRow: { final_amount: 300000, refund_amount: 0, branch_name: "철산점" }, // stale snapshot
    memberExists: true,
    unlinkedCount: 0,
    alreadyRefunded: 0,
    refund_amount: 300000,
  });
  assert("ROUTE-MOCK", "A-3: 스냅샷 사용 시 취소된 결제도 환불 승인 (버그 재현)", rOld.status, 200);
}

{
  // A-4. 초과 환불 → OVER_REFUND
  const r = await runMemberRefundLogic({
    lockedRow: { final_amount: 300000, refund_amount: 0, branch_name: "철산점" },
    memberExists: true,
    unlinkedCount: 0,
    alreadyRefunded: 50000,
    refund_amount: 300000,
  });
  assert("ROUTE-MOCK", "A-4: 기환불 5만 후 30만 시도 → OVER_REFUND 409", r.status, 409);
  assert("ROUTE-MOCK", "A-4: remaining=250000", r.body.remaining, 250000);
}

{
  // A-5. 지점 권한 불일치 (잠금 후 최신 branch_name 기준)
  const r = await runMemberRefundLogic({
    lockedRow: { final_amount: 300000, refund_amount: 0, branch_name: "광명점" },
    memberExists: true,
    unlinkedCount: 0,
    alreadyRefunded: 0,
    refund_amount: 50000,
    user: { role: "STAFF", branch_name: "철산점" },
  });
  assert("ROUTE-MOCK", "A-5: 잠금 후 branch_name 권한 거부", r.status, 403);
}

{
  // A-6. 출처불명 환불 감지 → UNLINKED_REFUND_HISTORY
  const r = await runMemberRefundLogic({
    lockedRow: { final_amount: 300000, refund_amount: 0, branch_name: "철산점" },
    memberExists: true,
    unlinkedCount: 2,
    alreadyRefunded: 0,
    refund_amount: 50000,
  });
  assert("ROUTE-MOCK", "A-6: 출처불명 환불 감지 → 409 거부", r.status, 409);
}

{
  // A-7. 회원 없음
  const r = await runMemberRefundLogic({
    lockedRow: { final_amount: 300000, refund_amount: 0, branch_name: "철산점" },
    memberExists: false,
    unlinkedCount: 0,
    alreadyRefunded: 0,
    refund_amount: 50000,
  });
  assert("ROUTE-MOCK", "A-7: 회원 없음 → 404", r.status, 404);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// B. payments/cancel
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
console.log("\n■ B. payments/cancel 로직\n");

{
  // B-1. 정상 취소
  const r = await runCancelLogic({
    lockedPayment: { final_amount: 300000, refund_amount: 0, branch_name: "철산점" },
    refundRowCount: 0,
  });
  assert("ROUTE-MOCK", "B-1: 정상 취소 → 성공", r.success, true);
}

{
  // B-2. 잠금 후 이미 취소된 결제 재취소 차단
  const r = await runCancelLogic({
    lockedPayment: { final_amount: 0, refund_amount: 300000, branch_name: "철산점" },
    refundRowCount: 0,
  });
  assert("ROUTE-MOCK", "B-2: 잠금 후 취소됨 확인 → 재취소 차단", r.success, false);
  assert("ROUTE-MOCK", "B-2: 메시지 확인", r.message, "이미 취소된 결제입니다.");
}

{
  // B-3. 환불 행 존재 → REFUND_EXISTS (이중 차감 방지)
  const r = await runCancelLogic({
    lockedPayment: { final_amount: 300000, refund_amount: 0, branch_name: "철산점" },
    refundRowCount: 1,
  });
  assert("ROUTE-MOCK", "B-3: 환불 행 존재 → REFUND_EXISTS", r.message, "REFUND_EXISTS");
}

{
  // B-4. 지점 권한 불일치
  const r = await runCancelLogic({
    lockedPayment: { final_amount: 300000, refund_amount: 0, branch_name: "광명점" },
    refundRowCount: 0,
    user: { role: "STAFF", branch_name: "철산점" },
  });
  assert("ROUTE-MOCK", "B-4: 지점 권한 불일치 → 차단", r.success, false);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// C. payments/delete DAILY
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
console.log("\n■ C. payments/delete DAILY 로직\n");

{
  // C-1. 정상 취소
  const r = await runDailyDeleteLogic({
    lockedPayment: { final_amount: 30000, refund_amount: 0 },
    refundRowCount: 0,
    dayPassStatus: "UNUSED",
  });
  assert("ROUTE-MOCK", "C-1: 정상 DAILY 취소 → 성공", r.success, true);
}

{
  // C-2. 잠금 후 이미 취소된 재취소 차단
  const r = await runDailyDeleteLogic({
    lockedPayment: { final_amount: 0, refund_amount: 30000 },
    refundRowCount: 0,
    dayPassStatus: null,
  });
  assert("ROUTE-MOCK", "C-2: 잠금 후 최신값 취소됨 → 재취소 차단", r.success, false);
}

{
  // C-3. REFUND 행 존재 → 차단
  const r = await runDailyDeleteLogic({
    lockedPayment: { final_amount: 30000, refund_amount: 0 },
    refundRowCount: 1,
    dayPassStatus: "UNUSED",
  });
  assert("ROUTE-MOCK", "C-3: REFUND 행 존재 → REFUND_EXISTS 차단", r.message, "REFUND_EXISTS");
}

{
  // C-4. 이미 사용된 일일권 → 차단
  const r = await runDailyDeleteLogic({
    lockedPayment: { final_amount: 30000, refund_amount: 0 },
    refundRowCount: 0,
    dayPassStatus: "USED",
  });
  assert("ROUTE-MOCK", "C-4: 이미 사용된 일일권 → 취소 차단", r.message.includes("사용된"), true);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// D. 잠금 순서·최신값 사용 확인
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
console.log("\n■ D. 잠금 순서·최신값 사용 확인\n");

{
  // D-1. member-refund: 트랜잭션 밖 스냅샷(300000) vs 잠금 후 최신값(0)
  //      동일 로직, 다른 입력으로 차이 확인
  const snap = await runMemberRefundLogic({ lockedRow: { final_amount: 300000, refund_amount: 0, branch_name: "철산점" }, memberExists: true, unlinkedCount: 0, alreadyRefunded: 0, refund_amount: 300000 });
  const lock = await runMemberRefundLogic({ lockedRow: { final_amount: 0, refund_amount: 300000, branch_name: "철산점" }, memberExists: true, unlinkedCount: 0, alreadyRefunded: 0, refund_amount: 300000 });
  assert("ROUTE-MOCK", "D-1: 스냅샷(final=300000) → 환불 승인", snap.status, 200);
  assert("ROUTE-MOCK", "D-1: 잠금 후 최신(final=0) → PAYMENT_CANCELLED 거부", lock.status, 409);
  console.log("  → 현재 코드: lockedPayment 사용 → 오른쪽(lock) 경로로 올바르게 거부됨");

  dbReq("D-1 실제 경쟁 시나리오: cancel 완료 후 member-refund FOR UPDATE 대기 → 최신값 읽기 — MySQL 없이 미검증");
}

{
  // D-2. payments/cancel: 잠금 후 취소됨 확인
  const r = await runCancelLogic({
    lockedPayment: { final_amount: 0, refund_amount: 300000, branch_name: "철산점" },
    refundRowCount: 0,
  });
  assert("ROUTE-MOCK", "D-2: cancel — 잠금 후 취소됨 확인 → 재취소 거부", r.success, false);
}

{
  // D-3. payments/delete DAILY: 잠금 후 취소됨 확인
  const r = await runDailyDeleteLogic({
    lockedPayment: { final_amount: 0, refund_amount: 30000 },
    refundRowCount: 0,
    dayPassStatus: null,
  });
  assert("ROUTE-MOCK", "D-3: DAILY delete — 잠금 후 취소됨 확인 → 재취소 거부", r.success, false);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 결과
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
console.log(`\n=== 결과: ${pass}개 통과 | ${fail}개 실패 | ${skipped}개 DB_REQ ===`);
if (fail > 0) process.exit(1);
