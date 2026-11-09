import pool from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";

const ok = (data: unknown) => Response.json({ success: true, data });
const err = (msg: string, status = 500) => Response.json({ success: false, message: msg }, { status });

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest(req);
  if (!user) return err("Unauthorized", 401);
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
