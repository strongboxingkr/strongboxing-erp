import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { SolapiMessageService } from "solapi";
import { getUserFromRequest, isAdminOrOwner } from "@/lib/auth";

const cleanPhone = (phone: string) => String(phone || "").replace(/[^0-9]/g, "");

const getFromNumber = (branchName: string) => {
  if (branchName === "철산점") return process.env.SOLAPI_FROM_CHULSAN;
  if (branchName === "목동점") return process.env.SOLAPI_FROM_MOKDONG;
  if (branchName === "개봉점") return process.env.SOLAPI_FROM_GAEBONG;
  if (branchName === "신정점") return process.env.SOLAPI_FROM_SINJEONG;
  return process.env.SOLAPI_FROM_CHULSAN;
};

export async function GET(req: Request) {
  // cron 호출: Authorization: Bearer <CRON_SECRET> 헤더로 인증
  // 직원 호출: erp_session OWNER/ADMIN 쿠키로 인증
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization") || "";
  const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`;

  if (!isCron) {
    const user = await getUserFromRequest(req);
    if (!user || !isAdminOrOwner(user.role)) {
      return NextResponse.json({ success: false, message: "인증이 필요합니다." }, { status: 401 });
    }
  }

  try {
    const [rules]: any = await pool.query(`
      SELECT * FROM sms_auto_rules WHERE use_yn = 'Y' AND branch_name IS NULL
    `);
    const [branchRules]: any = await pool.query(`
      SELECT * FROM sms_auto_rules WHERE branch_name IS NOT NULL
    `);

    const apiKey = process.env.SOLAPI_API_KEY;
    const apiSecret = process.env.SOLAPI_API_SECRET;
    const messageService = apiKey && apiSecret ? new SolapiMessageService(apiKey, apiSecret) : null;

    let sentCount = 0;

    for (const rule of rules) {
      let targets: any[] = [];

      if (rule.rule_type === "EXPIRING_3DAYS" || rule.rule_type === "EXPIRING_2DAYS") {
        const days = rule.days ?? (rule.rule_type === "EXPIRING_3DAYS" ? 3 : 2);
        const [rows]: any = await pool.query(`
          SELECT branch_name, name, phone, end_date, remaining_count
          FROM members WHERE status = 'ACTIVE'
          AND DATE(end_date) = DATE_ADD(CURDATE(), INTERVAL ? DAY)
        `, [days]);
        targets = rows;
      }

      if (rule.rule_type === "EXPIRING_TODAY") {
        const [rows]: any = await pool.query(`
          SELECT branch_name, name, phone, end_date, remaining_count
          FROM members WHERE status != 'REST' AND DATE(end_date) = CURDATE()
        `);
        targets = rows;
      }

      if (rule.rule_type === "LOW_COUNT") {
        const count = rule.count_threshold ?? 3;
        const [rows]: any = await pool.query(`
          SELECT branch_name, name, phone, end_date, remaining_count
          FROM members WHERE status = 'ACTIVE' AND pass_type = 'COUNT' AND remaining_count <= ?
        `, [count]);
        targets = rows;
      }

      if (rule.rule_type === "CRM_TODAY") {
        const [rows]: any = await pool.query(`
          SELECT branch_name, customer_name AS name, phone
          FROM crm_leads WHERE next_contact_date = CURDATE()
          AND status IN ('상담중', '방문예약', '재연락필요', '보류')
        `);
        targets = rows;
      }

      for (const t of targets) {
        if (!t.phone) continue;

        const [exists]: any = await pool.query(
          `SELECT COUNT(*) cnt FROM sms_logs
           WHERE receiver_phone = ? AND target_type = ? AND DATE(created_at) = CURDATE()`,
          [t.phone, rule.rule_type]
        );
        if (exists[0].cnt > 0) continue;

        const override = branchRules.find(
          (b: any) => b.rule_type === rule.rule_type && b.branch_name === t.branch_name
        );
        const rawMsg = override?.message || rule.message || "";
        const finalMsg = rawMsg
          .replace(/{name}/g, t.name || "")
          .replace(/{branch}/g, t.branch_name || "")
          .replace(/{end_date}/g, t.end_date ? String(t.end_date).slice(0, 10) : "")
          .replace(/{remaining_count}/g, t.remaining_count != null ? String(t.remaining_count) : "");

        const from = getFromNumber(t.branch_name);
        const to = cleanPhone(t.phone);

        let sendStatus = "FAILED";
        try {
          if (messageService && from && to.length >= 10) {
            await messageService.send([{ to, from: cleanPhone(from), text: finalMsg }]);
            sendStatus = "SENT";
            sentCount++;
          }
        } catch (e) {
          console.error("솔라피 발송 실패:", t.phone, e);
        }

        await pool.query(
          `INSERT INTO sms_logs (branch_name, target_type, receiver_name, receiver_phone, message, send_status, provider)
           VALUES (?, ?, ?, ?, ?, ?, 'AUTO')`,
          [t.branch_name, rule.rule_type, t.name, t.phone, finalMsg, sendStatus]
        );
      }
    }

    return NextResponse.json({ success: true, message: "자동 문자 발송 완료", sent: sentCount });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, message: "자동 문자 발송 실패", error });
  }
}
