import pool from "@/lib/db";
import { NextRequest } from "next/server";

const ok = (data: unknown) => Response.json({ success: true, data });
const err = (msg: string, status = 500) => Response.json({ success: false, message: msg }, { status });

export async function PUT(req: NextRequest) {
  try {
    const { id, is_uploaded, post_url } = await req.json();
    await pool.query(
      `UPDATE hq_content_channels SET is_uploaded=?, uploaded_at=?, post_url=? WHERE id=?`,
      [is_uploaded ? 1 : 0, is_uploaded ? new Date() : null, post_url||null, id]
    );
    return ok(null);
  } catch (e: any) {
    return err(e?.message ?? "DB error");
  }
}
