import pool from "@/lib/db";
import { NextRequest } from "next/server";

const ok = (data: unknown) => Response.json({ success: true, data });
const err = (msg: string, status = 500) => Response.json({ success: false, message: msg }, { status });

export async function GET() {
  try {
    const [rows]: any = await pool.query(
      `SELECT a.*, b.name AS branch_name FROM hq_assets a
       LEFT JOIN hq_branches b ON b.id = a.branch_id AND b.deleted_at IS NULL
       WHERE a.deleted_at IS NULL AND a.is_active = 1
       ORDER BY a.id DESC`
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
      `INSERT INTO hq_assets (branch_id,title,category,file_url,file_name,file_type,memo)
       VALUES (?,?,?,?,?,?,?)`,
      [b.branch_id||null, b.title, b.category, b.file_url||null, b.file_name||null, b.file_type||'doc', b.memo||null]
    );
    return ok({ id: r.insertId });
  } catch (e: any) {
    return err(e?.message ?? "DB error");
  }
}
