"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lockPaymentForEdit = lockPaymentForEdit;
exports.resolveGuestIdempotencyConflict = resolveGuestIdempotencyConflict;
exports.paymentGuardErrorResponse = paymentGuardErrorResponse;
/**
 * 결제 수정 가능 여부를 트랜잭션 안에서 FOR UPDATE로 검증.
 * cancel·delete·member-refund와 동일한 잠금 순서(payment_id 오름차순 단일 행 잠금)를 따른다.
 *
 * conn: 이미 beginTransaction()된 커넥션
 * paymentId: 수정 대상 결제 ID
 *
 * 반환: 잠긴 행 (최신 값)
 * 예외: PAYMENT_NOT_FOUND | PAYMENT_CANCELLED | IS_REFUND
 */
async function lockPaymentForEdit(conn, paymentId) {
    const [rows] = await conn.query(`SELECT payment_id, final_amount, refund_amount, history_type, member_id, branch_name
     FROM payments WHERE payment_id = ? FOR UPDATE`, [paymentId]);
    if (!rows.length) {
        throw Object.assign(new Error("PAYMENT_NOT_FOUND"), {});
    }
    const p = rows[0];
    if (Number(p.final_amount) === 0 && Number(p.refund_amount) > 0) {
        throw Object.assign(new Error("PAYMENT_CANCELLED"), {});
    }
    if (p.history_type === "REFUND") {
        throw Object.assign(new Error("IS_REFUND"), {});
    }
    return p;
}
/**
 * add-guest INSERT UNIQUE 충돌(ER_DUP_ENTRY) 발생 시 기존 행과 현재 요청 비교.
 * 반환: "IDEMPOTENT" | "CONFLICT" | "BRANCH_MISMATCH"
 */
function resolveGuestIdempotencyConflict(existing, incoming) {
    if (existing.branch_name !== incoming.branch_name)
        return "BRANCH_MISMATCH";
    const contentMismatch = Number(existing.final_amount) !== Number(incoming.final_amount) ||
        (existing.product_name || null) !== (incoming.product_name || null);
    return contentMismatch ? "CONFLICT" : "IDEMPOTENT";
}
function paymentGuardErrorResponse(error) {
    if (error?.message === "PAYMENT_NOT_FOUND") {
        return { status: 404, body: { success: false, message: "결제 없음" } };
    }
    if (error?.message === "PAYMENT_CANCELLED") {
        return { status: 409, body: { success: false, message: "이미 취소된 결제는 수정할 수 없습니다." } };
    }
    if (error?.message === "IS_REFUND") {
        return { status: 409, body: { success: false, message: "환불 기록은 수정할 수 없습니다." } };
    }
    return null;
}
