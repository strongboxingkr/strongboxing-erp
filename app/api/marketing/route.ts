import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest, isAdminOrOwner } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const user = getUserFromRequest(req);
    const { searchParams } = new URL(req.url);

    const branch_name = searchParams.get("branch_name");
    const start_date = searchParams.get("start_date");
    const end_date = searchParams.get("end_date");
    const lead_source = searchParams.get("lead_source");

    let sql = `SELECT * FROM marketing_reports WHERE 1=1`;
    const params: any[] = [];

    if (isAdminOrOwner(user.role)) {
      if (branch_name && branch_name !== "전체") {
        sql += ` AND branch_name = ?`;
        params.push(branch_name);
      }
    } else {
      sql += ` AND branch_name = ?`;
      params.push(user.branch_name);
    }

    if (start_date) {
      sql += ` AND report_date >= ?`;
      params.push(start_date);
    }

    if (end_date) {
      sql += ` AND report_date <= ?`;
      params.push(end_date);
    }

    if (lead_source && lead_source !== "전체") {
      sql += ` AND lead_source = ?`;
      params.push(lead_source);
    }

    sql += ` ORDER BY report_date DESC`;

    const [rows]: any = await pool.query(sql, params);

    return NextResponse.json({ success: true, rows });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, message: "조회 실패", error });
  }
}
