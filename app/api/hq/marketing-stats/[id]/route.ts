import pool from "@/lib/db";
import { NextRequest } from "next/server";

const ok = (data: unknown) => Response.json({ success: true, data });
const err = (msg: string, status = 500) => Response.json({ success: false, message: msg }, { status });

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const b = await req.json();
    await pool.query(
      `UPDATE hq_marketing_stats SET branch_id=?,stat_date=?,channel=?,inquiries=?,registrations=?,ad_cost=?,impressions=?,clicks=?,memo=? WHERE id=?`,
      [b.branch_id||null, b.stat_date, b.channel, b.inquiries||0, b.registrations||0,
       b.ad_cost||0, b.impressions||0, b.clicks||0, b.memo||null, id]
    );
    return ok(null);
  } catch (e: any) {
    return err(e?.message ?? "DB error");
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    await pool.query("UPDATE hq_marketing_stats SET deleted_at=NOW() WHERE id=?", [id]);
    return ok(null);
  } catch (e: any) {
    return err(e?.message ?? "DB error");
  }
}
