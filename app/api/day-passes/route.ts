import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const member_id = searchParams.get("member_id");
    const branch_name = searchParams.get("branch_name");

    if (!member_id && !branch_name) {
      return NextResponse.json({ success: false, message: "member_id 또는 branch_name이 필요합니다" });
    }

    let sql = `
      SELECT dp.*, p.product_name, p.payment_method, p.amount, p.final_amount
      FROM day_passes dp
      LEFT JOIN payments p ON dp.payment_id = p.payment_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (member_id) { sql += " AND dp.member_id = ?"; params.push(member_id); }
    if (branch_name) { sql += " AND dp.branch_name = ?"; params.push(branch_name); }

    sql += " ORDER BY dp.use_date DESC, dp.pass_id DESC LIMIT 100";

    const [rows]: any = await pool.query(sql, params);
    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    return NextResponse.json({ success: false, error });
  }
}
