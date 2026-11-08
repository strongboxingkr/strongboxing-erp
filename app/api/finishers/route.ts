import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { canManageBranch, getErpUser, isHq, requireRole } from "@/lib/erp-session";
import { AMOUNT_PRESETS, DEFAULT_EXERCISES, isDate, normalizeItems, publishProblem } from "@/lib/finishers";
import { kstToday } from "@/lib/membership-ops";

const unauth = () => NextResponse.json({ success: false, message: "다시 로그인해 주세요. (서버 세션 필요)" }, { status: 401 });

/** 마무리 운동 목록 + 자주 쓰는 운동. 관장은 자기 지점만 */
export async function GET(req: Request) {
  const user = await getErpUser(req);
  if (!requireRole(user)) return unauth();
  const { searchParams } = new URL(req.url);
  const branch = isHq(user!) ? searchParams.get("branch_name") || "" : user!.branch_name || "";
  const today = kstToday();
  const params: any[] = [];
  let where = "1=1";
  if (branch) {
    where += " AND branch_name = ?";
    params.push(branch);
  }
  const [rows]: any = await pool.query(
    `SELECT finisher_id, branch_name, finisher_date, status, items, rounds, rest_seconds, note, published_at, updated_at, updated_by, copied_from
     FROM daily_finishers WHERE ${where} ORDER BY finisher_date DESC LIMIT 60`,
    params
  );
  // 자주 쓰는 운동: 이 지점에서 쓴 운동명 + 기본 목록
  const used = new Map<string, number>();
  for (const r of rows) {
    const items = typeof r.items === "string" ? JSON.parse(r.items) : r.items;
    for (const i of items || []) if (i?.name) used.set(i.name, (used.get(i.name) || 0) + 1);
  }
  const exercises = [...[...used.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n), ...DEFAULT_EXERCISES.filter((n) => !used.has(n))];
  return NextResponse.json({ success: true, today, rows, exercises, amounts: AMOUNT_PRESETS, user: { role: user!.role, branch_name: user!.branch_name } });
}

/** 새 마무리 운동 (지점·날짜당 1개) */
export async function POST(req: Request) {
  const user = await getErpUser(req);
  if (!requireRole(user)) return unauth();
  const b = await req.json().catch(() => ({}));
  const branch = String(b.branch_name || "");
  if (!branch || !isDate(b.finisher_date)) return NextResponse.json({ success: false, message: "지점과 날짜를 선택해 주세요." });
  if (!canManageBranch(user!, branch)) return NextResponse.json({ success: false, message: "담당 지점만 등록할 수 있습니다." }, { status: 403 });
  const items = normalizeItems(b.items);
  const status = b.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT";
  if (status === "PUBLISHED") {
    const p = publishProblem(items);
    if (p) return NextResponse.json({ success: false, message: p });
  }
  try {
    const [r]: any = await pool.query(
      `INSERT INTO daily_finishers (branch_name, finisher_date, status, items, rounds, rest_seconds, note, created_by, updated_by, published_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ${status === "PUBLISHED" ? "NOW()" : "NULL"})`,
      [branch, b.finisher_date, status, JSON.stringify(items), num(b.rounds, 1, 20), num(b.rest_seconds, 0, 600), str(b.note), user!.login_id, user!.login_id]
    );
    return NextResponse.json({ success: true, finisher_id: r.insertId, status });
  } catch (e: any) {
    if (e?.code === "ER_DUP_ENTRY") {
      const [ex]: any = await pool.query(`SELECT finisher_id FROM daily_finishers WHERE branch_name = ? AND finisher_date = ?`, [branch, b.finisher_date]);
      return NextResponse.json({ success: false, code: "DUPLICATE", finisher_id: ex[0]?.finisher_id, message: "이 지점·날짜에 이미 등록된 마무리 운동이 있습니다. 기존 것을 수정해 주세요." }, { status: 409 });
    }
    throw e;
  }
}

function num(v: any, min: number, max: number) {
  const n = Number(v);
  return v === "" || v == null || !Number.isFinite(n) ? null : Math.max(min, Math.min(max, Math.round(n)));
}
function str(v: any) {
  const s = String(v || "").trim().slice(0, 500);
  return s || null;
}
