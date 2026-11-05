import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest, isAdminOrOwner } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const [rules]: any = await pool.query(
      `SELECT * FROM sms_auto_rules ORDER BY rule_id ASC`
    );
    return NextResponse.json({ success: true, rows: rules });
  } catch (error) {
    return NextResponse.json({ success: false, error });
  }
}

export async function PUT(req: Request) {
  try {
    const user = getUserFromRequest(req);
    const body = await req.json();
    const { rule_id, message, use_yn, days, count } = body;

    if (!rule_id) return NextResponse.json({ success: false, message: "rule_id 필요" });

    // 모든 역할 전체 수정 가능
    const fields: string[] = [];
    const values: any[] = [];

    if (message !== undefined) { fields.push("message = ?"); values.push(message); }
    if (use_yn !== undefined) { fields.push("use_yn = ?"); values.push(use_yn); }
    if (days !== undefined) { fields.push("days = ?"); values.push(days); }
    if (count !== undefined) { fields.push("count_threshold = ?"); values.push(count); }

    if (fields.length === 0) return NextResponse.json({ success: false, message: "수정할 항목 없음" });

    values.push(rule_id);
    await pool.query(`UPDATE sms_auto_rules SET ${fields.join(", ")} WHERE rule_id = ?`, values);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error });
  }
}
