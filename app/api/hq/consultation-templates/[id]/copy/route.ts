import pool from "@/lib/db";

const ok = (data: unknown) => Response.json({ success: true, data });
const err = (msg: string, status = 500) => Response.json({ success: false, message: msg }, { status });

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    await pool.query(
      "UPDATE hq_consultation_templates SET copy_count = copy_count + 1 WHERE id=? AND deleted_at IS NULL", [id]
    );
    return ok(null);
  } catch (e: any) {
    return err(e?.message ?? "DB error");
  }
}
