import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest, isAdminOrOwner } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const user = getUserFromRequest(req);
    const { searchParams } = new URL(req.url);

    const branch_name = searchParams.get("branch_name");

    let branchCondition = "";
    const params: any[] = [];

    if (isAdminOrOwner(user.role)) {
      if (branch_name && branch_name !== "전체") {
        branchCondition = " AND p.branch_name = ? ";
        params.push(branch_name);
      }
    } else {
      branchCondition = " AND p.branch_name = ? ";
      params.push(user.branch_name);
    }

    const [rows]: any = await pool.query(
      `
      SELECT
        p.payment_id,
        p.member_id,
        p.branch_name,
        p.payment_date,
        p.product_name,
        p.final_amount,
        p.unpaid_amount,
        p.payment_method,
        p.history_type,
        p.memo,

        m.name,
        m.phone,
        m.status,
        m.staff_name
      FROM payments p
      JOIN members m ON p.member_id = m.member_id
      WHERE p.unpaid_amount > 0
        ${branchCondition}
      ORDER BY p.payment_date DESC, p.payment_id DESC
      `,
      params
    );

    return NextResponse.json({
      success: true,
      rows,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: "미수금 회원 조회 실패",
      error,
    });
  }
}