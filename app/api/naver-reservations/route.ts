import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest, isAdminOrOwner } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const user = getUserFromRequest(req);

    const { searchParams } = new URL(req.url);

    const branch_name = searchParams.get("branch_name");
    const status = searchParams.get("status");
    const is_read = searchParams.get("is_read");
    const search = searchParams.get("search");

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
        source_type,
        memo,
        is_read,
        DATE_FORMAT(created_at, '%Y-%m-%d %H:%i') AS created_at
      FROM naver_reservations
      WHERE 1=1
    `;

    const params: any[] = [];

    if (isAdminOrOwner(user.role)) {
      if (branch_name && branch_name !== "전체") {
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

    if (status) {
      sql += ` AND status = ? `;
      params.push(status);
    }

    if (is_read) {
      sql += ` AND is_read = ? `;
      params.push(is_read);
    }

    if (search) {
      sql += `
        AND (
          customer_name LIKE ?
          OR phone LIKE ?
          OR reservation_product LIKE ?
        )
      `;

      const keyword = `%${search}%`;

      params.push(keyword, keyword, keyword);
    }

    sql += `
      ORDER BY reservation_date DESC,
               reservation_time DESC,
               reservation_id DESC
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

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      branch_name,
      customer_name,
      phone,
      reservation_date,
      reservation_time,
      reservation_product,
      status,
      memo,
      source_email_id,
      source_type,
    } = body;

    if (!branch_name || !customer_name || !phone) {
      return NextResponse.json({
        success: false,
        message: "지점명, 이름, 연락처는 필수입니다.",
      });
    }

    const [result]: any = await pool.query(
      `
      INSERT INTO naver_reservations (
        branch_name,
        customer_name,
        phone,
        reservation_date,
        reservation_time,
        reservation_product,
        status,
        memo,
        source_email_id,
        source_type,
        is_read
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        branch_name,
        customer_name,
        phone,
        reservation_date || null,
        reservation_time || null,
        reservation_product || null,
        status || "예약접수",
        memo || null,
        source_email_id || null,
        source_type || "전화문의",
        "N",
      ]
    );

    return NextResponse.json({
      success: true,
      message: "예약이 등록되었습니다.",
      reservation_id: result.insertId,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: "예약 등록 실패",
      error,
    });
  }
}