import pool from "@/lib/db";
import { NextRequest } from "next/server";

const ok = (data: unknown) => Response.json({ success: true, data });
const err = (msg: string, status = 500) => Response.json({ success: false, message: msg }, { status });

export async function GET() {
  try {
    const [rows]: any = await pool.query(
      `SELECT e.*, b.name AS branch_name FROM hq_calendar_events e
       LEFT JOIN hq_branches b ON b.id = e.branch_id AND b.deleted_at IS NULL
       WHERE e.deleted_at IS NULL AND e.is_active = 1
       ORDER BY e.start_date ASC`
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
      `INSERT INTO hq_calendar_events (branch_id,title,event_type,start_date,end_date,manager,status,memo)
       VALUES (?,?,?,?,?,?,?,?)`,
      [b.branch_id||null, b.title, b.event_type||'촬영', b.start_date,
       b.end_date||null, b.manager||null, b.status||'예정', b.memo||null]
    );
    return ok({ id: r.insertId });
  } catch (e: any) {
    return err(e?.message ?? "DB error");
  }
}
