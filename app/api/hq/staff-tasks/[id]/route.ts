import pool from "@/lib/db";
import { NextRequest } from "next/server";

const ok = (data: unknown) => Response.json({ success: true, data });
const err = (msg: string, status = 500) => Response.json({ success: false, message: msg }, { status });

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const b = await req.json();
    if ('is_done' in b) {
      await pool.query(
        "UPDATE hq_staff_tasks SET is_done=?, done_at=? WHERE id=?",
        [b.is_done ? 1 : 0, b.is_done ? new Date() : null, id]
      );
    } else {
      await pool.query(
        "UPDATE hq_staff_tasks SET task_type=?,title=?,description=?,assigned_to=? WHERE id=? AND deleted_at IS NULL",
        [b.task_type, b.title, b.description||null, b.assigned_to||null, id]
      );
    }
    return ok(null);
  } catch (e: any) {
    return err(e?.message ?? "DB error");
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    await pool.query("UPDATE hq_staff_tasks SET deleted_at=NOW(),is_active=0 WHERE id=?", [id]);
    return ok(null);
  } catch (e: any) {
    return err(e?.message ?? "DB error");
  }
}
