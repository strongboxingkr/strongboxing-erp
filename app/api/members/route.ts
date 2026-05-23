import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest, isAdminOrOwner } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const user = getUserFromRequest(req);

    const { searchParams } = new URL(req.url);
    const branch_name = searchParams.get("branch_name");
    const search = searchParams.get("search");

    let sql = `
      SELECT *
      FROM members
      WHERE 1=1
    `;

    const params: any[] = [];

    if (isAdminOrOwner(user.role)) {
      if (branch_name) {
        sql += ` AND branch_name = ? `;
        params.push(branch_name);
      }
    } else {
      if (!user.branch_name) {
        return NextResponse.json({
          success: false,
          message: "지점 정보가 없습니다.",
        });
      }

      sql += ` AND branch_name = ? `;
      params.push(user.branch_name);
    }

    if (search) {
      sql += `
        AND (
          name LIKE ?
          OR phone LIKE ?
          OR checkin_code LIKE ?
          OR product_name LIKE ?
          OR memo LIKE ?
        )
      `;

      const keyword = `%${search}%`;

      params.push(keyword, keyword, keyword, keyword, keyword);
    }

    sql += ` ORDER BY member_id DESC `;

    const [rows]: any = await pool.query(sql, params);

    return NextResponse.json({
      success: true,
      rows,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: "회원 목록 조회 실패",
      error,
    });
  }
}