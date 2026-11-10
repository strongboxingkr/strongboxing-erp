import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest, canAccessBranch } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const member_id = searchParams.get("member_id");
    const branch_name = searchParams.get("branch_name");

    if (!member_id && !branch_name) {
      return NextResponse.json({ success: false, message: "member_id 또는 branch_name이 필요합니다" });
    }

    if (branch_name && !canAccessBranch(user, branch_name)) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
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
