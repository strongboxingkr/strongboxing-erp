import pool from "@/lib/db";
import { NextRequest } from "next/server";

const ok = (data: unknown) => Response.json({ success: true, data });
const err = (msg: string, status = 500) => Response.json({ success: false, message: msg }, { status });

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const b = await req.json();
    await pool.query(
      `UPDATE hq_calendar_events SET branch_id=?,title=?,event_type=?,start_date=?,end_date=?,manager=?,status=?,memo=?
       WHERE id=? AND deleted_at IS NULL`,
      [b.branch_id||null, b.title, b.event_type, b.start_date, b.end_date||null,
       b.manager||null, b.status, b.memo||null, id]
    );
    return ok(null);
  } catch (e: any) {
    return err(e?.message ?? "DB error");
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    await pool.query("UPDATE hq_calendar_events SET deleted_at=NOW(),is_active=0 WHERE id=?", [id]);
    return ok(null);
  } catch (e: any) {
    return err(e?.message ?? "DB error");
  }
}
