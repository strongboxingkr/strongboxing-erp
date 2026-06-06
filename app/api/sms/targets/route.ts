import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest, isAdminOrOwner } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const user = getUserFromRequest(req);
    const { searchParams } = new URL(req.url);

    const branch_name = searchParams.get("branch_name") || "";
    const target_type = searchParams.get("target_type") || "BRANCH_MEMBERS";

    if (!isAdminOrOwner(user.role) && user.branch_name !== branch_name) {
      return NextResponse.json({
        success: false,
        message: "조회 권한이 없습니다.",
      });
    }

    let sql = `
      SELECT
        member_id,
        name,
        phone,
        branch_name,
        product_name,
        end_date,
        pass_type,
        remaining_count,
        checkin_code,
        member_no,
        checkin_sms_enabled,
        checkout_sms_enabled
      FROM members
      WHERE 1 = 1
    `;

    const params: any[] = [];

    if (target_type === "BRANCH_MEMBERS") {
      sql += ` AND branch_name = ? `;
      params.push(branch_name);
    }

    if (target_type === "EXPIRING_7DAYS") {
      sql += `
        AND branch_name = ?
        AND DATE(end_date) <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)
      `;
      params.push(branch_name);
    }

    if (target_type === "LOW_COUNT") {
      sql += `
        AND branch_name = ?
        AND pass_type = 'COUNT'
        AND remaining_count <= 3
      `;
      params.push(branch_name);
    }

    sql += ` ORDER BY name ASC `;

    const [rows]: any = await pool.query(sql, params);

    return NextResponse.json({
      success: true,
      rows,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({
      success: false,
      message: "문자 대상 조회 실패",
      error,
    });
  }
}