import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const branch_name = searchParams.get("branch_name");

    let sql = `SELECT event_id, branch_name, customer_name, phone, title, memo,
                      start_datetime, status, event_type, created_at
               FROM calendar_events
               WHERE status != '취소'
               AND start_datetime >= '2026-07-01'`;
    const params: any[] = [];

    if (branch_name) {
      sql += ` AND branch_name = ?`;
      params.push(branch_name);
    }

    sql += ` ORDER BY start_datetime ASC`;

    const [rows]: any = await pool.query(sql, params);
    return NextResponse.json({ success: true, rows });
  } catch (error) {
    return NextResponse.json({ success: false, error });
  }
}
