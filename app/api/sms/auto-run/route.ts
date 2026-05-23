import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET() {
  try {
    const [rules]: any = await pool.query(`
      SELECT *
      FROM sms_auto_rules
      WHERE use_yn = 'Y'
    `);

    let createdCount = 0;

    for (const rule of rules) {
      let targets: any[] = [];

      if (rule.rule_type === "EXPIRING_7DAYS") {
        const [rows]: any = await pool.query(`
          SELECT branch_name, name, phone
          FROM members
          WHERE status = 'ACTIVE'
          AND DATE(end_date) = DATE_ADD(CURDATE(), INTERVAL 7 DAY)
        `);
        targets = rows;
      }

      if (rule.rule_type === "EXPIRING_TODAY") {
        const [rows]: any = await pool.query(`
          SELECT branch_name, name, phone
          FROM members
          WHERE status = 'ACTIVE'
          AND DATE(end_date) = CURDATE()
        `);
        targets = rows;
      }

      if (rule.rule_type === "LOW_COUNT") {
        const [rows]: any = await pool.query(`
          SELECT branch_name, name, phone
          FROM members
          WHERE status = 'ACTIVE'
          AND pass_type = 'COUNT'
          AND remaining_count <= 3
        `);
        targets = rows;
      }

      if (rule.rule_type === "CRM_TODAY") {
        const [rows]: any = await pool.query(`
          SELECT branch_name, customer_name AS name, phone
          FROM crm_leads
          WHERE next_contact_date = CURDATE()
          AND status IN ('상담중', '방문예약', '재연락필요', '보류')
        `);
        targets = rows;
      }

      for (const t of targets) {
        if (!t.phone) continue;

        const [exists]: any = await pool.query(
          `
          SELECT COUNT(*) cnt
          FROM sms_logs
          WHERE receiver_phone = ?
          AND target_type = ?
          AND DATE(created_at) = CURDATE()
          `,
          [t.phone, rule.rule_type]
        );

        if (exists[0].cnt > 0) continue;

        await pool.query(
          `
          INSERT INTO sms_logs
          (
            branch_name,
            target_type,
            receiver_name,
            receiver_phone,
            message,
            send_status,
            provider
          )
          VALUES (?, ?, ?, ?, ?, 'READY', 'AUTO')
          `,
          [
            t.branch_name,
            rule.rule_type,
            t.name,
            t.phone,
            rule.message,
          ]
        );

        createdCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: "자동 문자 대상 생성 완료",
      created: createdCount,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json({
      success: false,
      message: "자동 문자 대상 생성 실패",
      error,
    });
  }
}