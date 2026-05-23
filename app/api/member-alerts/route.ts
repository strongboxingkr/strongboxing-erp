import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const branch_name = searchParams.get("branch_name");

    let sql = `
      SELECT
        member_id,
        branch_name,
        name,
        phone,
        pass_type,
        remaining_count,
        end_date,
        status
      FROM members
      WHERE status = 'ACTIVE'
      AND (
        end_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)
        OR (
          pass_type = 'COUNT'
          AND remaining_count <= 3
        )
      )
    `;

    const params: any[] = [];

    if (branch_name) {
      sql += ` AND branch_name = ? `;
      params.push(branch_name);
    }

    sql += `
      ORDER BY end_date ASC, remaining_count ASC
    `;

    const [rows]: any = await pool.query(sql, params);

    return NextResponse.json({
      success: true,
      rows,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json({
      success: false,
      message: "회원 알림 조회 실패",
      error,
    });
  }
}