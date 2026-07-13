import pool from "@/lib/db";
import { NextRequest } from "next/server";

const ok = (data: unknown) => Response.json({ success: true, data });
const err = (msg: string, status = 500) => Response.json({ success: false, message: msg }, { status });

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const b = await req.json();
    await pool.query(
      `UPDATE hq_branches SET name=?,slug=?,phone=?,address=?,instagram=?,
       kakao_map_url=?,naver_reservation_url=?,business_hours=?,memo=?
       WHERE id=? AND deleted_at IS NULL`,
      [b.name, b.slug, b.phone||null, b.address||null, b.instagram||null,
       b.kakao_map_url||null, b.naver_reservation_url||null,
       b.business_hours ? JSON.stringify(b.business_hours) : null, b.memo||null, id]
    );
    return ok(null);
  } catch (e: any) {
    return err(e?.message ?? "DB error");
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    await pool.query("UPDATE hq_branches SET deleted_at=NOW(),is_active=0 WHERE id=?", [id]);
    return ok(null);
  } catch (e: any) {
    return err(e?.message ?? "DB error");
  }
}
