import pool from "@/lib/db";

/**
 * 회원권 변경 공통 처리.
 *  - withMemberChange: 한 트랜잭션 안에서 회원권을 바꾸고, members 트리거가 membership_changes 에
 *    변경 종류·안내 사유를 함께 기록하도록 연결별 컨텍스트(@sbm_*)를 설정. 실패하면 둘 다 취소.
 *  - applyHold / releaseHold: 데스크 휴회 등록, 앱 휴회 신청 승인, 체크인 자동 해제가 같은 계산을 사용
 */

export type ChangeCtx = {
  type: string; // REGISTER / RENEW / HOLD / HOLD_RELEASE / EXTEND / BULK_EXTEND / CORRECTION / CANCEL / AUTO_EXPIRE / IMPORT / ATTENDANCE / ATTENDANCE_UNDO
  reason?: string | null; // 회원에게 보여도 되는 안내 사유
  source?: string;
  refType?: string | null;
  refId?: number | null;
  actor?: string | null;
};

export async function setChangeContext(conn: any, ctx: ChangeCtx) {
  await conn.query(
    `SET @sbm_change_type = ?, @sbm_change_reason = ?, @sbm_change_source = ?, @sbm_change_ref_type = ?, @sbm_change_ref_id = ?, @sbm_change_actor = ?`,
    [ctx.type, ctx.reason ?? null, ctx.source ?? null, ctx.refType ?? null, ctx.refId ?? null, ctx.actor ?? null]
  );
}

export async function clearChangeContext(conn: any) {
  await conn.query(
    `SET @sbm_change_type = NULL, @sbm_change_reason = NULL, @sbm_change_source = NULL, @sbm_change_ref_type = NULL, @sbm_change_ref_id = NULL, @sbm_change_actor = NULL`
  );
}

export async function withMemberChange<T>(ctx: ChangeCtx, fn: (conn: any) => Promise<T>): Promise<T> {
  const conn: any = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await setChangeContext(conn, ctx);
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (e) {
    await conn.rollback().catch(() => {});
    throw e;
  } finally {
    // 풀 연결 재사용 시 다른 요청에 컨텍스트가 남지 않도록 반드시 초기화
    await clearChangeContext(conn).catch(() => {});
    conn.release();
  }
}

/** 회원 행을 바꾸는 단일 쿼리를 변경 종류와 함께 실행 */
export async function taggedQuery(ctx: ChangeCtx, sql: string, params: unknown[] = []) {
  return withMemberChange(ctx, (conn) => conn.query(sql, params)) as Promise<[any, any]>;
}

// ---------------- 날짜 (KST 'YYYY-MM-DD' 문자열) ----------------
export function kstToday() {
  return new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
}
const ms = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
export const addDays = (d: string, n: number) => new Date(ms(d) + n * 86400000).toISOString().slice(0, 10);
export const diffDays = (a: string, b: string) => Math.round((ms(b) - ms(a)) / 86400000);
export const d10 = (v: any) => (v ? String(v).slice(0, 10) : null);

// ---------------- 휴회 ----------------
export class HoldError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

/**
 * 휴회 적용 (데스크 /api/members/hold). 휴회는 지점 규정에 따라 관장이 직접 처리하며 회원 앱 신청은 받지 않음.
 * 반드시 withMemberChange 안에서 호출.
 * 기존 ERP 규칙 유지: 휴회일수 = 시작~종료 포함 일수, 만료일을 그만큼 연장, 상태 REST.
 * 회원 행을 잠그고(FOR UPDATE) 다시 확인해 동시 처리·중복 반영을 막음.
 */
export async function applyHold(
  conn: any,
  opts: { memberId: number; holdStart: string; holdEnd: string; reason?: string | null; actor: string }
) {
  const [rows]: any = await conn.query(`SELECT member_id, name, branch_name, status, start_date, end_date FROM members WHERE member_id = ? FOR UPDATE`, [opts.memberId]);
  const m = rows[0];
  if (!m) throw new HoldError("NOT_FOUND", "회원을 찾을 수 없습니다.");
  const today = kstToday();
  const end = d10(m.end_date);
  if (m.status === "DELETED") throw new HoldError("DELETED", "삭제된 회원입니다.");
  if (m.status === "REST") throw new HoldError("ALREADY_REST", "이미 휴회 중인 회원입니다.");
  if (m.status === "EXPIRED" || !end || end < today) throw new HoldError("EXPIRED", "만료된 회원권입니다.");
  if (opts.holdEnd < opts.holdStart) throw new HoldError("BAD_RANGE", "휴회 종료일이 시작일보다 빠릅니다.");
  if (opts.holdStart > end) throw new HoldError("AFTER_END", "휴회 시작일이 회원권 만료일 이후입니다.");

  const [overlap]: any = await conn.query(
    `SELECT hold_id FROM member_holds WHERE member_id = ? AND released_at IS NULL AND hold_start <= ? AND hold_end >= ? LIMIT 1`,
    [opts.memberId, opts.holdEnd, opts.holdStart]
  );
  if (overlap.length) throw new HoldError("OVERLAP", "겹치는 휴회가 이미 있습니다.");

  const holdDays = diffDays(opts.holdStart, opts.holdEnd) + 1;
  const newEnd = addDays(end, holdDays);
  const [ins]: any = await conn.query(
    `INSERT INTO member_holds (member_id, hold_start, hold_end, hold_days, reason, old_end_date, new_end_date, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [opts.memberId, opts.holdStart, opts.holdEnd, holdDays, opts.reason || "", end, newEnd, opts.actor]
  );
  await conn.query(`SET @sbm_change_ref_type = 'hold', @sbm_change_ref_id = ?`, [ins.insertId]);
  await conn.query(
    `UPDATE members SET end_date = ?, status = 'REST',
       memo = CONCAT(IFNULL(memo, ''), '\n[휴회] ', ?, ' ~ ', ?, ' / ', ?, '일 / ', ?)
     WHERE member_id = ?`,
    [newEnd, opts.holdStart, opts.holdEnd, holdDays, opts.reason || "", opts.memberId]
  );

  return { holdId: ins.insertId as number, holdDays, oldEnd: end, newEnd, memberName: m.name };
}

/**
 * 휴회 해제 후 만료일 계산 (체크인 자동 해제).
 * [수정] 이전 코드는 휴회 등록 때 이미 연장된 end_date 로 잔여일수를 다시 계산해 휴회 기간이 이중으로 더해졌음.
 * 기준 만료일 = 휴회 전 만료일(old_end_date, 없으면 현재 end_date — 연장하지 않는 /api/member-holds 경로)
 * 잔여일수 = 기준 만료일 − 휴회 시작일
 * 복귀 기준일 = 휴회 시작 전이면 시작일(=휴회 취소, 만료일 원래대로), 휴회 중이면 오늘, 종료일 이후면 종료일 다음날
 *   (기존 규칙 "종료일 이후 늦게 온 날은 소멸" 유지, 휴회일수를 시작~종료 포함으로 세는 members/hold 와 일치)
 */
export function computeReleaseEnd(hold: { hold_start: any; hold_end: any; old_end_date?: any }, currentEnd: any, today: string) {
  const start = d10(hold.hold_start)!;
  const holdEnd = d10(hold.hold_end)!;
  const baseEnd = d10(hold.old_end_date) || d10(currentEnd) || holdEnd;
  const remaining = diffDays(start, baseEnd);
  const releaseBase = today < start ? start : today <= holdEnd ? today : addDays(holdEnd, 1);
  return { newEnd: addDays(releaseBase, remaining), remaining, releaseBase };
}
