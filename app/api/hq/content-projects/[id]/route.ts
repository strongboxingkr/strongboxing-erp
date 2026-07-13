import pool from "@/lib/db";
import { NextRequest } from "next/server";

const ok = (data: unknown) => Response.json({ success: true, data });
const err = (msg: string, status = 500) => Response.json({ success: false, message: msg }, { status });

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const b = await req.json();
    await pool.query(
      `UPDATE hq_content_projects SET branch_id=?,title=?,content_type=?,status=?,target=?,
       shoot_date=?,manager=?,caption=?,hashtags=?,clip_title=?,blog_draft=?,memo=?
       WHERE id=? AND deleted_at IS NULL`,
      [b.branch_id||null, b.title, b.content_type, b.status, b.target||null,
       b.shoot_date||null, b.manager||null, b.caption||null, b.hashtags||null,
       b.clip_title||null, b.blog_draft||null, b.memo||null, id]
    );
    return ok(null);
  } catch (e: any) {
    return err(e?.message ?? "DB error");
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    await pool.query("UPDATE hq_content_projects SET deleted_at=NOW(),is_active=0 WHERE id=?", [id]);
    return ok(null);
  } catch (e: any) {
    return err(e?.message ?? "DB error");
  }
}
