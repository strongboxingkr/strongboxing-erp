import pool from "@/lib/db";
import { NextRequest } from "next/server";

const ok = (data: unknown) => Response.json({ success: true, data });
const err = (msg: string, status = 500) => Response.json({ success: false, message: msg }, { status });

export async function GET() {
  try {
    const [rows]: any = await pool.query(
      "SELECT * FROM hq_settings WHERE deleted_at IS NULL AND is_active=1 ORDER BY id ASC"
    );
    const map: Record<string, string> = {};
    for (const r of rows) map[r.setting_key] = r.setting_value;
    return ok({ list: rows, map });
  } catch (e: any) {
    return err(e?.message ?? "DB error");
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { key, value } = await req.json();
    await pool.query(
      `INSERT INTO hq_settings (setting_key, setting_value) VALUES (?,?)
       ON DUPLICATE KEY UPDATE setting_value=?`,
      [key, value, value]
    );
    return ok(null);
  } catch (e: any) {
    return err(e?.message ?? "DB error");
  }
}
