import pool from "@/lib/db";
import { NextRequest } from "next/server";

const ok = (data: unknown) => Response.json({ success: true, data });
const err = (msg: string, status = 500) => Response.json({ success: false, message: msg }, { status });

export async function GET() {
  try {
    const [rows]: any = await pool.query(
      `SELECT t.*, b.name AS branch_name FROM hq_staff_tasks t
       LEFT JOIN hq_branches b ON b.id = t.branch_id AND b.deleted_at IS NULL
       WHERE t.deleted_at IS NULL AND t.is_active = 1
       ORDER BY t.task_type, t.id ASC`
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
      `INSERT INTO hq_staff_tasks (branch_id,task_type,title,description,assigned_to,due_date)
       VALUES (?,?,?,?,?,?)`,
      [b.branch_id||null, b.task_type||'기타', b.title, b.description||null, b.assigned_to||null, b.due_date||null]
    );
    return ok({ id: r.insertId });
  } catch (e: any) {
    return err(e?.message ?? "DB error");
  }
}
