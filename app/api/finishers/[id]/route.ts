import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { canManageBranch, getErpUser, requireRole } from "@/lib/erp-session";
import { isDate, normalizeItems, publishProblem } from "@/lib/finishers";

const unauth = () => NextResponse.json({ success: false, message: "다시 로그인해 주세요. (서버 세션 필요)" }, { status: 401 });
const num = (v: any, min: number, max: number) => {
  const n = Number(v);
  return v === "" || v == null || !Number.isFinite(n) ? null : Math.max(min, Math.min(max, Math.round(n)));
};
const str = (v: any) => String(v || "").trim().slice(0, 500) || null;

async function load(id: number) {
  const [rows]: any = await pool.query(`SELECT * FROM daily_finishers WHERE finisher_id = ?`, [id]);
  return rows[0];
}

/**
 * 수정 / 상태 변경: PUT { items, rounds, rest_seconds, note, finisher_date?, status? }
 *  status: DRAFT(임시 저장) / PUBLISHED(게시, 운동 3개 필수) / UNPUBLISHED(게시 취소)
 *  게시 후 수정하면 회원 앱에 바로 반영 (앱은 매번 조회)
 */
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getErpUser(req);
  if (!requireRole(user)) return unauth();
  const id = Number((await ctx.params).id);
  const cur = await load(id);
  if (!cur) return NextResponse.json({ success: false, message: "없는 마무리 운동입니다." }, { status: 404 });
  if (!canManageBranch(user!, cur.branch_name)) return NextResponse.json({ success: false, message: "담당 지점만 수정할 수 있습니다." }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const items = b.items ? normalizeItems(b.items) : normalizeItems(typeof cur.items === "string" ? JSON.parse(cur.items) : cur.items);
  const status = ["DRAFT", "PUBLISHED", "UNPUBLISHED"].includes(b.status) ? b.status : cur.status;
  if (status === "PUBLISHED") {
    const p = publishProblem(items);
    if (p) return NextResponse.json({ success: false, message: p });
  }
  const date = isDate(b.finisher_date) ? b.finisher_date : String(cur.finisher_date).slice(0, 10);
  try {
    await pool.query(
      `UPDATE daily_finishers SET finisher_date = ?, status = ?, items = ?, rounds = ?, rest_seconds = ?, note = ?, updated_by = ?,
         published_at = IF(? = 'PUBLISHED', COALESCE(published_at, NOW()), published_at)
       WHERE finisher_id = ?`,
      [
        date,
        status,
        JSON.stringify(items),
        "rounds" in b ? num(b.rounds, 1, 20) : cur.rounds,
        "rest_seconds" in b ? num(b.rest_seconds, 0, 600) : cur.rest_seconds,
        "note" in b ? str(b.note) : cur.note,
        user!.login_id,
        status,
        id,
      ]
    );
  } catch (e: any) {
    if (e?.code === "ER_DUP_ENTRY") return NextResponse.json({ success: false, message: "그 날짜에는 이미 마무리 운동이 있습니다." }, { status: 409 });
    throw e;
  }
  return NextResponse.json({ success: true, status });
}

/** 복사: POST { finisher_date } → 새 날짜의 임시 저장으로 생성 (원본은 그대로, 자동 게시 안 함) */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getErpUser(req);
  if (!requireRole(user)) return unauth();
  const id = Number((await ctx.params).id);
  const src = await load(id);
  if (!src) return NextResponse.json({ success: false, message: "없는 마무리 운동입니다." }, { status: 404 });
  const b = await req.json().catch(() => ({}));
  const branch = String(b.branch_name || src.branch_name);
  if (!canManageBranch(user!, branch)) return NextResponse.json({ success: false, message: "담당 지점만 등록할 수 있습니다." }, { status: 403 });
  if (!isDate(b.finisher_date)) return NextResponse.json({ success: false, message: "복사할 날짜를 선택해 주세요." });
  try {
    const [r]: any = await pool.query(
      `INSERT INTO daily_finishers (branch_name, finisher_date, status, items, rounds, rest_seconds, note, copied_from, created_by, updated_by)
       VALUES (?, ?, 'DRAFT', ?, ?, ?, ?, ?, ?, ?)`,
      [branch, b.finisher_date, typeof src.items === "string" ? src.items : JSON.stringify(src.items), src.rounds, src.rest_seconds, src.note, id, user!.login_id, user!.login_id]
    );
    return NextResponse.json({ success: true, finisher_id: r.insertId, status: "DRAFT" });
  } catch (e: any) {
    if (e?.code === "ER_DUP_ENTRY") return NextResponse.json({ success: false, code: "DUPLICATE", message: "그 날짜에는 이미 마무리 운동이 있습니다." }, { status: 409 });
    throw e;
  }
}
