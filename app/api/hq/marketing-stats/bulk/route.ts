import pool from "@/lib/db";
import { NextRequest } from "next/server";

const ok = (data: unknown) => Response.json({ success: true, data });
const err = (msg: string, status = 500) => Response.json({ success: false, message: msg }, { status });

export async function POST(req: NextRequest) {
  try {
    const { rows } = await req.json();
    if (!Array.isArray(rows) || rows.length === 0) return err("rows 없음", 400);

    let inserted = 0;
    for (const b of rows) {
      await pool.query(
        `INSERT INTO hq_marketing_stats (branch_id, stat_date, channel, impressions, clicks, inquiries, registrations, ad_cost, memo)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [b.branch_id || null, b.stat_date || new Date().toISOString().slice(0, 10),
         b.channel || "기타", b.impressions || 0, b.clicks || 0,
         b.inquiries || 0, b.registrations || 0, b.ad_cost || 0, b.memo || null]
      );
      inserted++;
    }
    return ok({ inserted });
  } catch (e: any) {
    return err(e?.message ?? "DB error");
  }
}
