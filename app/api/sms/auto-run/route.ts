import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET() {
  try {
    // 글로벌 규칙 (branch_name IS NULL, use_yn = Y)
    const [rules]: any = await pool.query(`
      SELECT * FROM sms_auto_rules WHERE use_yn = 'Y' AND branch_name IS NULL
    `);
    // 지점별 오버라이드
    const [branchRules]: any = await pool.query(`
      SELECT * FROM sms_auto_rules WHERE branch_name IS NOT NULL
    `);

    let createdCount = 0;

    for (const rule of rules) {
      let targets: any[] = [];

      if (rule.rule_type === "EXPIRING_3DAYS" || rule.rule_type === "EXPIRING_2DAYS") {
        const days = rule.days ?? (rule.rule_type === "EXPIRING_3DAYS" ? 3 : 2);
        const [rows]: any = await pool.query(`
          SELECT branch_name, name, phone, end_date, remaining_count
          FROM members
          WHERE status = 'ACTIVE'
          AND DATE(end_date) = DATE_ADD(CURDATE(), INTERVAL ? DAY)
        `, [days]);
        targets = rows;
      }

      if (rule.rule_type === "EXPIRING_TODAY") {
        const [rows]: any = await pool.query(`
          SELECT branch_name, name, phone, end_date, remaining_count
          FROM members
          WHERE status != 'REST'
          AND DATE(end_date) = CURDATE()
        `);
        targets = rows;
      }

      if (rule.rule_type === "LOW_COUNT") {
        const count = rule.count_threshold ?? 3;
        const [rows]: any = await pool.query(`
          SELECT branch_name, name, phone, end_date, remaining_count
          FROM members
          WHERE status = 'ACTIVE'
          AND pass_type = 'COUNT'
          AND remaining_count <= ?
        `, [count]);
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
            // 지점별 오버라이드 메시지 우선 사용
          (() => {
            const override = branchRules.find(
              (b: any) => b.rule_type === rule.rule_type && b.branch_name === t.branch_name
            );
            const msg = (override?.message || rule.message || "");
            return msg
              .replace(/{name}/g, t.name || "")
              .replace(/{branch}/g, t.branch_name || "")
              .replace(/{end_date}/g, t.end_date ? String(t.end_date).slice(0, 10) : "")
              .replace(/{remaining_count}/g, t.remaining_count != null ? String(t.remaining_count) : "");
          })(),
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