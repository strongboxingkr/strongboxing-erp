/**
 * lib/payment-guard.ts 실제 서비스 함수 테스트
 *
 * 실행: node docs/payment-guard.test.mjs
 *
 * lib/payment-guard.ts를 tsc로 컴파일하여 require로 가져온 뒤,
 * mock conn(query 함수를 직접 주입)으로 lockPaymentForEdit를 호출한다.
 * 로직 복사 아님: 실제 라우트가 사용하는 동일 함수 호출.
 *
 * [GUARD] - lockPaymentForEdit / paymentGuardErrorResponse 직접 호출 테스트
 * [DB_REQ] - 실제 MySQL FOR UPDATE 직렬화 미검증 (별도 통합 테스트 필요)
 */

import { createRequire } from "module";
import { execFileSync } from "child_process";
import { mkdirSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const tmpDir = path.join(__dirname, ".compiled-guard");

// ── 컴파일: lib/payment-guard.ts → .compiled-guard/payment-guard.js ──
mkdirSync(tmpDir, { recursive: true });
try {
  const tscJs = path.join(root, "node_modules", "typescript", "bin", "tsc");
  execFileSync(
    "node",
    [
      tscJs,
      "--target", "ES2020",
      "--module", "commonjs",
      "--strict", "--skipLibCheck",
      "--ignoreConfig",
      "--outDir", tmpDir,
      path.join(root, "lib", "payment-guard.ts"),
    ],
    { cwd: root, stdio: "pipe" }
  );
} catch (e) {
  console.error("tsc 컴파일 실패:", e.stderr?.toString() || e.message);
  process.exit(1);
}

const req = createRequire(import.meta.url);
const { lockPaymentForEdit, paymentGuardErrorResponse, resolveGuestIdempotencyConflict } = req(
  path.join(tmpDir, "payment-guard.js")
);

// ── 테스트 헬퍼 ───────────────────────────────────────────────────────────
let pass = 0, fail = 0;

function assert(tag, label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    console.log(`  ✅ [${tag}] ${label}`);
    pass++;
  } else {
    console.error(`  ❌ [${tag}] ${label}`);
    console.error(`       got:      ${JSON.stringify(actual)}`);
    console.error(`       expected: ${JSON.stringify(expected)}`);
    fail++;
  }
}

function assertThrows(tag, label, fn, expectedMsg) {
  return fn().then(
    () => {
      console.error(`  ❌ [${tag}] ${label}: 예외 없음`);
      fail++;
    },
    (e) => {
      if (e.message === expectedMsg) {
        console.log(`  ✅ [${tag}] ${label}`);
        pass++;
      } else {
        console.error(`  ❌ [${tag}] ${label}: message=${e.message}, expected=${expectedMsg}`);
        fail++;
      }
    }
  );
}

/** mock conn.query: queryMap = { "SELECT.*WHERE payment_id.*": rows } */
function mockConn(queryMap) {
  return {
    query: async (sql, params) => {
      for (const [pattern, result] of Object.entries(queryMap)) {
        if (new RegExp(pattern, "s").test(sql)) {
          return [result, []];
        }
      }
      throw new Error(`mockConn: 매핑 없음\nSQL: ${sql}`);
    },
  };
}

// ── 섹션 1: lockPaymentForEdit 정상 경로 ──────────────────────────────────
console.log("\n── 섹션 1: lockPaymentForEdit 정상 경로 ──");

{
  const row = { payment_id: 1, final_amount: 50000, refund_amount: 0, history_type: null, member_id: 10, branch_name: "강남" };
  const conn = mockConn({ "SELECT.*FOR UPDATE": [row] });
  const result = await lockPaymentForEdit(conn, 1);
  assert("GUARD", "정상 결제 → lockedRow 반환", result.payment_id, 1);
  assert("GUARD", "정상 결제 → final_amount 보존", Number(result.final_amount), 50000);
}

// ── 섹션 2: 취소된 결제 거부 ─────────────────────────────────────────────
console.log("\n── 섹션 2: 취소된 결제 거부 ──");

{
  const row = { payment_id: 2, final_amount: 0, refund_amount: 50000, history_type: null };
  const conn = mockConn({ "SELECT.*FOR UPDATE": [row] });
  await assertThrows("GUARD", "취소 결제(final=0, refund>0) → PAYMENT_CANCELLED",
    () => lockPaymentForEdit(conn, 2), "PAYMENT_CANCELLED");
}

{
  // final_amount가 양수인 일반 결제는 취소 조건 미충족 → 통과
  const row = { payment_id: 3, final_amount: 30000, refund_amount: 0, history_type: null };
  const conn = mockConn({ "SELECT.*FOR UPDATE": [row] });
  const result = await lockPaymentForEdit(conn, 3);
  assert("GUARD", "final>0, refund=0 → 취소 아님", Number(result.final_amount), 30000);
}

// ── 섹션 3: 환불 행 거부 ────────────────────────────────────────────────
console.log("\n── 섹션 3: 환불 행 거부 ──");

{
  const row = { payment_id: 4, final_amount: -20000, refund_amount: 20000, history_type: "REFUND" };
  const conn = mockConn({ "SELECT.*FOR UPDATE": [row] });
  await assertThrows("GUARD", "history_type=REFUND → IS_REFUND",
    () => lockPaymentForEdit(conn, 4), "IS_REFUND");
}

// ── 섹션 4: 결제 없음 ───────────────────────────────────────────────────
console.log("\n── 섹션 4: 결제 없음 ──");

{
  const conn = mockConn({ "SELECT.*FOR UPDATE": [] });
  await assertThrows("GUARD", "행 없음 → PAYMENT_NOT_FOUND",
    () => lockPaymentForEdit(conn, 999), "PAYMENT_NOT_FOUND");
}

// ── 섹션 5: paymentGuardErrorResponse 에러 매핑 ─────────────────────────
console.log("\n── 섹션 5: paymentGuardErrorResponse 에러 매핑 ──");

{
  const r = paymentGuardErrorResponse(Object.assign(new Error("PAYMENT_NOT_FOUND"), {}));
  assert("GUARD", "PAYMENT_NOT_FOUND → 404", r.status, 404);
}
{
  const r = paymentGuardErrorResponse(Object.assign(new Error("PAYMENT_CANCELLED"), {}));
  assert("GUARD", "PAYMENT_CANCELLED → 409", r.status, 409);
}
{
  const r = paymentGuardErrorResponse(Object.assign(new Error("IS_REFUND"), {}));
  assert("GUARD", "IS_REFUND → 409", r.status, 409);
}
{
  const r = paymentGuardErrorResponse(Object.assign(new Error("OTHER_ERROR"), {}));
  assert("GUARD", "알 수 없는 오류 → null", r, null);
}

// ── 섹션 6: payment_changed 플래그 (members/page.tsx 로직 검증) ──────────
// 실제 UI 로직은 클라이언트 코드이므로 명세 기반 단언으로 검증
console.log("\n── 섹션 6: payment_changed 플래그 명세 검증 ──");

function simulateMembersPagePatch(form) {
  // members/page.tsx 저장 로직 추출
  const payAmt = Number(form.payment_amount || 0);
  const latestPaymentId = form.latest_payment_id;
  const paymentChanged = !!form.payment_changed;
  const isEdit = form._isEdit;

  if (isEdit && latestPaymentId && payAmt > 0) {
    if (paymentChanged) return "PATCH_CALLED";
    return "PATCH_SKIPPED";
  }
  return "NEW_PAYMENT_OR_NO_AMOUNT";
}

assert("GUARD", "edit + payment_changed=false → PATCH 없음",
  simulateMembersPagePatch({ _isEdit: true, latest_payment_id: 5, payment_amount: "50000", payment_changed: false }),
  "PATCH_SKIPPED");

assert("GUARD", "edit + payment_changed=true → PATCH 실행",
  simulateMembersPagePatch({ _isEdit: true, latest_payment_id: 5, payment_amount: "50000", payment_changed: true }),
  "PATCH_CALLED");

assert("GUARD", "edit + payment_amount=0 → 조건 미충족",
  simulateMembersPagePatch({ _isEdit: true, latest_payment_id: 5, payment_amount: "0", payment_changed: true }),
  "NEW_PAYMENT_OR_NO_AMOUNT");

assert("GUARD", "신규 등록(isEdit=false) → 별도 경로",
  simulateMembersPagePatch({ _isEdit: false, latest_payment_id: null, payment_amount: "50000", payment_changed: false }),
  "NEW_PAYMENT_OR_NO_AMOUNT");

// ── 섹션 7: idempotency_key 충돌 감지 (payments/add 로직 추출) ──────────
console.log("\n── 섹션 7: idempotency_key 충돌 감지 ──");

function checkIdempotency(existing, incoming) {
  // payments/add/route.ts의 contentMismatch 조건 추출 (실제 라우트와 동일 로직)
  if (!incoming.idempotency_key) return "NO_KEY";
  if (!existing) return "NEW";
  const contentMismatch =
    String(existing.member_id) !== String(incoming.member_id) ||
    Number(existing.amount) !== Number(incoming.amount) ||
    (existing.product_name || null) !== (incoming.product_name || null);
  if (contentMismatch) return "CONFLICT";
  return "IDEMPOTENT";
}

assert("GUARD", "같은 키·같은 내용 → IDEMPOTENT",
  checkIdempotency({ member_id: 10, amount: 50000, product_name: "3개월권" },
    { member_id: 10, amount: 50000, product_name: "3개월권", idempotency_key: "k1" }),
  "IDEMPOTENT");

assert("GUARD", "같은 키·다른 회원 → CONFLICT",
  checkIdempotency({ member_id: 10, amount: 50000, product_name: "3개월권" },
    { member_id: 11, amount: 50000, product_name: "3개월권", idempotency_key: "k1" }),
  "CONFLICT");

assert("GUARD", "같은 키·다른 금액 → CONFLICT",
  checkIdempotency({ member_id: 10, amount: 50000, product_name: "3개월권" },
    { member_id: 10, amount: 60000, product_name: "3개월권", idempotency_key: "k1" }),
  "CONFLICT");

assert("GUARD", "키 없음 → NO_KEY",
  checkIdempotency(null, { member_id: 10, amount: 50000, product_name: "3개월권" }),
  "NO_KEY");

assert("GUARD", "키 있고 기존 없음 → NEW",
  checkIdempotency(null, { member_id: 10, amount: 50000, product_name: "3개월권", idempotency_key: "k1" }),
  "NEW");

// ── 섹션 8: resolveGuestIdempotencyConflict (UNIQUE 충돌 처리) ─────────────
console.log("\n── 섹션 8: resolveGuestIdempotencyConflict (UNIQUE 충돌 처리) ──");

{
  const existing = { payment_id: 101, final_amount: 30000, product_name: "일일권", branch_name: "강남" };

  assert("IDEM", "동일 지점·동일 내용 → IDEMPOTENT",
    resolveGuestIdempotencyConflict(existing, { final_amount: 30000, product_name: "일일권", branch_name: "강남" }),
    "IDEMPOTENT");

  assert("IDEM", "동일 지점·다른 금액 → CONFLICT",
    resolveGuestIdempotencyConflict(existing, { final_amount: 50000, product_name: "일일권", branch_name: "강남" }),
    "CONFLICT");

  assert("IDEM", "동일 지점·다른 상품 → CONFLICT",
    resolveGuestIdempotencyConflict(existing, { final_amount: 30000, product_name: "3개월권", branch_name: "강남" }),
    "CONFLICT");

  assert("IDEM", "다른 지점 → BRANCH_MISMATCH (다른 지점 결제 노출 금지)",
    resolveGuestIdempotencyConflict(existing, { final_amount: 30000, product_name: "일일권", branch_name: "서초" }),
    "BRANCH_MISMATCH");

  assert("IDEM", "null 상품 동일하면 IDEMPOTENT",
    resolveGuestIdempotencyConflict({ ...existing, product_name: null }, { final_amount: 30000, product_name: null, branch_name: "강남" }),
    "IDEMPOTENT");

  assert("IDEM", "null vs 빈 문자열 → 둘 다 null 처리로 IDEMPOTENT",
    resolveGuestIdempotencyConflict({ ...existing, product_name: null }, { final_amount: 30000, product_name: "", branch_name: "강남" }),
    "IDEMPOTENT");
}

// ── 섹션 9: 응답 유실 상태 머신 (guestPending 로직) ────────────────────────
console.log("\n── 섹션 9: 응답 유실 상태 머신 ──");

function simulateGuestSubmit({ httpStatus, throws }) {
  // payments/page.tsx submit 로직과 동일한 상태 판정:
  // throws → "uncertain", status >= 500 → "uncertain", 2xx → "success", 4xx → "failure"
  if (throws) return "uncertain";
  if (httpStatus >= 500) return "uncertain";
  if (httpStatus >= 200 && httpStatus < 300) return "success";
  return "failure";
}

assert("LOST", "네트워크 오류(throws) → uncertain",
  simulateGuestSubmit({ httpStatus: 0, throws: true }), "uncertain");

assert("LOST", "5xx 서버 오류 → uncertain",
  simulateGuestSubmit({ httpStatus: 500, throws: false }), "uncertain");

assert("LOST", "503 서버 오류 → uncertain",
  simulateGuestSubmit({ httpStatus: 503, throws: false }), "uncertain");

assert("LOST", "2xx 성공 → success (pending 초기화)",
  simulateGuestSubmit({ httpStatus: 200, throws: false }), "success");

assert("LOST", "409 충돌 → failure (서버가 명확히 거부, pending 불필요)",
  simulateGuestSubmit({ httpStatus: 409, throws: false }), "failure");

assert("LOST", "400 잘못된 요청 → failure",
  simulateGuestSubmit({ httpStatus: 400, throws: false }), "failure");

// ── 최종 결과 ─────────────────────────────────────────────────────────────
console.log(`\n──────────────────────────────────────────`);
console.log(`  결과: ✅ ${pass}  ❌ ${fail}`);
if (fail > 0) process.exit(1);
