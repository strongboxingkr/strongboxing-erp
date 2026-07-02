import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest, isAdminOrOwner } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const user = getUserFromRequest(req);
    const { searchParams } = new URL(req.url);
    const base_date = searchParams.get("base_date");
    const branch_name = searchParams.get("branch_name");

    if (!base_date) return NextResponse.json({ success: false, message: "기준일 필요" });

    let sql = `SELECT member_id, name, branch_name, product_name, end_date, status
               FROM members
               WHERE end_date >= ? AND status != 'EXPIRED'`;
    const params: any[] = [base_date];

    if (isAdminOrOwner(user.role)) {
      if (branch_name) { sql += ` AND branch_name = ?`; params.push(branch_name); }
    } else {
      sql += ` AND branch_name = ?`; params.push(user.branch_name);
    }

    sql += ` ORDER BY end_date ASC`;
    const [rows]: any = await pool.query(sql, params);
    return NextResponse.json({ success: true, rows });
  } catch (error) {
    return NextResponse.json({ success: false, error });
  }
}

export async function POST(req: Request) {
  try {
    const user = getUserFromRequest(req);
    const { base_date, days, branch_name } = await req.json();

    if (!base_date || days === undefined) return NextResponse.json({ success: false, message: "기준일/조정일 필요" });

    let sql = `UPDATE members SET end_date = DATE_ADD(end_date, INTERVAL ? DAY)
               WHERE end_date >= ? AND status != 'EXPIRED'`;
    const params: any[] = [days, base_date];

    if (isAdminOrOwner(user.role)) {
      if (branch_name) { sql += ` AND branch_name = ?`; params.push(branch_name); }
    } else {
      sql += ` AND branch_name = ?`; params.push(user.branch_name);
    }

    const [result]: any = await pool.query(sql, params);
    return NextResponse.json({ success: true, affected: result.affectedRows });
  } catch (error) {
    return NextResponse.json({ success: false, error });
  }
}
