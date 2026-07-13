import pool from "@/lib/db";
import { NextRequest } from "next/server";

const ok = (data: unknown) => Response.json({ success: true, data });
const err = (msg: string, status = 500) => Response.json({ success: false, message: msg }, { status });

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const b = await req.json();
    await pool.query(
      "UPDATE hq_assets SET branch_id=?,title=?,category=?,file_url=?,file_name=?,file_type=?,memo=? WHERE id=? AND deleted_at IS NULL",
      [b.branch_id||null, b.title, b.category, b.file_url||null, b.file_name||null, b.file_type||'doc', b.memo||null, id]
    );
    return ok(null);
  } catch (e: any) {
    return err(e?.message ?? "DB error");
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    await pool.query("UPDATE hq_assets SET deleted_at=NOW(),is_active=0 WHERE id=?", [id]);
    return ok(null);
  } catch (e: any) {
    return err(e?.message ?? "DB error");
  }
}
