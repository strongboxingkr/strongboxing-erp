import pool from "@/lib/db";
import { NextRequest } from "next/server";

const ok = (data: unknown) => Response.json({ success: true, data });
const err = (msg: string, status = 500) => Response.json({ success: false, message: msg }, { status });

export async function GET() {
  try {
    const [rows]: any = await pool.query(
      `SELECT s.*, b.name AS branch_name
       FROM hq_marketing_stats s
       LEFT JOIN hq_branches b ON b.id = s.branch_id AND b.deleted_at IS NULL
       WHERE s.deleted_at IS NULL
       ORDER BY s.stat_date DESC, s.id DESC`
    );
    return ok(rows);
  } catch (e: any) {
    return err(e?.message ?? "DB error");
  }
}

export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    const [r]: any = await pool.query(
      `INSERT INTO hq_marketing_stats (branch_id, stat_date, channel, inquiries, registrations, ad_cost, impressions, clicks, memo)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [b.branch_id||null, b.stat_date||new Date().toISOString().slice(0,10),
       b.channel||"기타", b.inquiries||0, b.registrations||0,
       b.ad_cost||0, b.impressions||0, b.clicks||0, b.memo||null]
    );
    return ok({ id: r.insertId });
  } catch (e: any) {
    return err(e?.message ?? "DB error");
  }
}
