import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest, isAdminOrOwner } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const user = getUserFromRequest(req);

    const { searchParams } = new URL(req.url);
    const branch_name = searchParams.get("branch_name");

    let sql = `
      SELECT
        p.*,
        m.name
      FROM payments p
      JOIN members m
        ON p.member_id = m.member_id
      WHERE 1=1
    `;

    const params: any[] = [];

    if (isAdminOrOwner(user.role)) {
      if (branch_name) {
        sql += ` AND p.branch_name = ? `;
        params.push(branch_name);
      }
    } else {
      if (!user.branch_name) {
        return NextResponse.json({
          success: false,
          message: "지점 정보가 없습니다.",
        });
      }

      sql += ` AND p.branch_name = ? `;
      params.push(user.branch_name);
    }

    sql += ` ORDER BY p.payment_id DESC `;

    const [rows]: any = await pool.query(sql, params);

    return NextResponse.json({
      success: true,
      rows,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: "결제 목록 조회 실패",
      error,
    });
  }
}