import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest, isAdminOrOwner } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const [rules]: any = await pool.query(
      `SELECT *,
        CASE
          WHEN rule_type LIKE 'EXPIRING_%' AND rule_type != 'EXPIRING_TODAY' THEN 1
          WHEN rule_type = 'EXPIRING_TODAY' THEN 2
          WHEN rule_type = 'LOW_COUNT' THEN 3
          ELSE 4
        END AS sort_order
       FROM sms_auto_rules ORDER BY sort_order ASC, rule_id ASC`
    );
    return NextResponse.json({ success: true, rows: rules });
  } catch (error) {
    return NextResponse.json({ success: false, error });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { rule_id, message, use_yn, days, count } = body;

    if (!rule_id) return NextResponse.json({ success: false, message: "rule_id 필요" });

    // message / use_yn 업데이트 (항상 존재하는 컬럼)
    const baseFields: string[] = [];
    const baseValues: any[] = [];
    if (message !== undefined) { baseFields.push("message = ?"); baseValues.push(message); }
    if (use_yn !== undefined) { baseFields.push("use_yn = ?"); baseValues.push(use_yn); }

    if (baseFields.length > 0) {
      baseValues.push(rule_id);
      await pool.query(`UPDATE sms_auto_rules SET ${baseFields.join(", ")} WHERE rule_id = ?`, baseValues);
    }

    // days / count_threshold 업데이트 (컬럼 없으면 무시)
    if (days !== undefined) {
      try { await pool.query(`UPDATE sms_auto_rules SET days = ? WHERE rule_id = ?`, [days, rule_id]); } catch {}
    }
    if (count !== undefined) {
      try { await pool.query(`UPDATE sms_auto_rules SET count_threshold = ? WHERE rule_id = ?`, [count, rule_id]); } catch {}
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error });
  }
}
