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

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { branch_name, customer_name, phone, start_datetime, title, memo, status, event_type } = body;

    if (!branch_name || !customer_name || !start_datetime) {
      return NextResponse.json({ success: false, message: "필수 항목이 없습니다." });
    }

    const cleanDt = String(start_datetime).replace("T", " ").slice(0, 19);

    await pool.query(
      `INSERT INTO calendar_events (branch_name, event_type, title, customer_name, phone, start_datetime, memo, status, source_type, source_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [branch_name, event_type || "PHONE", title || "방문 상담", customer_name, phone || "", cleanDt, memo || "", status || "예약접수", "PHONE", ""]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { event_id, customer_name, phone, start_datetime, title, memo, status } = body;

    if (!event_id) {
      return NextResponse.json({ success: false, message: "event_id가 없습니다." });
    }

    const cleanDt = String(start_datetime).replace("T", " ").slice(0, 19);

    await pool.query(
      `UPDATE calendar_events SET customer_name=?, phone=?, start_datetime=?, title=?, memo=?, status=? WHERE event_id=?`,
      [customer_name, phone || "", cleanDt, title || "", memo || "", status, event_id]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error });
  }
}
