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
        reservation_id,
        branch_name,
        customer_name,
        phone,
        DATE_FORMAT(reservation_date, '%Y-%m-%d') AS reservation_date,
        reservation_time,
        reservation_product,
        status,
        source_email_id,
        memo,
        DATE_FORMAT(created_at, '%Y-%m-%d %H:%i') AS created_at
      FROM naver_reservations
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

    sql += `
      ORDER BY reservation_date ASC, reservation_time ASC, reservation_id DESC
    `;

    const [rows]: any = await pool.query(sql, params);

    return NextResponse.json({
      success: true,
      rows,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: "네이버 예약 조회 실패",
      error,
    });
  }
}