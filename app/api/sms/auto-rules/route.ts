import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest, isAdminOrOwner } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    // 글로벌 규칙만 반환 (branch_name IS NULL)
    const [rules]: any = await pool.query(
      `SELECT *,
        CASE
          WHEN rule_type LIKE 'EXPIRING_%' AND rule_type != 'EXPIRING_TODAY' THEN 1
          WHEN rule_type = 'EXPIRING_TODAY' THEN 2
          WHEN rule_type = 'LOW_COUNT' THEN 3
          ELSE 4
        END AS sort_order
       FROM sms_auto_rules
       WHERE branch_name IS NULL
       ORDER BY sort_order ASC, rule_id ASC`
    );

    // 지점별 오버라이드 규칙
    const [branchRules]: any = await pool.query(
      `SELECT * FROM sms_auto_rules WHERE branch_name IS NOT NULL`
    );

    return NextResponse.json({ success: true, rows: rules, branchRules });
  } catch (error) {
    return NextResponse.json({ success: false, error });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { rule_id, message, use_yn, days, count } = body;

    if (!rule_id) return NextResponse.json({ success: false, message: "rule_id 필요" });

    // 유저 확인 (없으면 글로벌 처리)
    let userRole = "ADMIN";
    let userBranch: string | null = null;
    try {
      const user = getUserFromRequest(req);
      userRole = user.role;
      userBranch = user.branch_name || null;
    } catch {}

    const isAdmin = isAdminOrOwner(userRole);

    if (isAdmin) {
      // ADMIN/OWNER: 글로벌 규칙 수정
      const baseFields: string[] = [];
      const baseValues: any[] = [];
      if (message !== undefined) { baseFields.push("message = ?"); baseValues.push(message); }
      if (use_yn !== undefined) { baseFields.push("use_yn = ?"); baseValues.push(use_yn); }
      if (baseFields.length > 0) {
        baseValues.push(rule_id);
        await pool.query(`UPDATE sms_auto_rules SET ${baseFields.join(", ")} WHERE rule_id = ? AND branch_name IS NULL`, baseValues);
      }
      if (days !== undefined) {
        try { await pool.query(`UPDATE sms_auto_rules SET days = ? WHERE rule_id = ? AND branch_name IS NULL`, [days, rule_id]); } catch {}
      }
      if (count !== undefined) {
        try { await pool.query(`UPDATE sms_auto_rules SET count_threshold = ? WHERE rule_id = ? AND branch_name IS NULL`, [count, rule_id]); } catch {}
      }
    } else {
      // DIRECTOR: 지점별 오버라이드 upsert
      if (!userBranch) return NextResponse.json({ success: false, message: "지점 정보 없음" });

      // 글로벌 규칙 타입 조회
      const [globalRows]: any = await pool.query(
        `SELECT rule_type, days, count_threshold FROM sms_auto_rules WHERE rule_id = ? AND branch_name IS NULL`,
        [rule_id]
      );
      if (!globalRows.length) return NextResponse.json({ success: false, message: "규칙 없음" });
      const { rule_type, days: globalDays, count_threshold: globalCount } = globalRows[0];

      await pool.query(
        `INSERT INTO sms_auto_rules (rule_type, branch_name, message, use_yn, days, count_threshold)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           message = IF(? IS NOT NULL, ?, message),
           use_yn = IF(? IS NOT NULL, ?, use_yn),
           days = IF(? IS NOT NULL, ?, days),
           count_threshold = IF(? IS NOT NULL, ?, count_threshold)`,
        [
          rule_type, userBranch,
          message ?? null, use_yn ?? "Y", days ?? globalDays, count ?? globalCount,
          message, message,
          use_yn, use_yn,
          days, days,
          count, count,
        ]
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error });
  }
}
