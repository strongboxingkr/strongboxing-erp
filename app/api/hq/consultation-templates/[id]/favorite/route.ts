import pool from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";

const ok = (data: unknown) => Response.json({ success: true, data });
const err = (msg: string, status = 500) => Response.json({ success: false, message: msg }, { status });

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest(req);
  if (!user) return err("Unauthorized", 401);
  try {
    const { id } = await ctx.params;
    const [rows]: any = await pool.query(
      "SELECT favorite_count FROM hq_consultation_templates WHERE id=? AND deleted_at IS NULL", [id]
    );
    if (!rows.length) return err("Not found", 404);
    const current = rows[0].favorite_count ?? 0;
    const next = current > 0 ? 0 : 1;
    await pool.query("UPDATE hq_consultation_templates SET favorite_count=? WHERE id=?", [next, id]);
    return ok({ favorite_count: next });
  } catch (e: any) {
    return err(e?.message ?? "DB error");
  }
}
