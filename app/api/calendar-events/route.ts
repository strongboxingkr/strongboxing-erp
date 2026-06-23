import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const branch_name = searchParams.get("branch_name");
    const start_date = searchParams.get("start_date");
    const end_date = searchParams.get("end_date");

    let sql = `
      SELECT *
      FROM calendar_events
      WHERE 1=1
    `;

    const params: any[] = [];

    if (branch_name && branch_name !== "전체") {
      sql += ` AND branch_name = ?`;
      params.push(branch_name);
    }

    if (start_date) {
      sql += ` AND start_datetime >= ?`;
      params.push(start_date + " 00:00:00");
    }

    if (end_date) {
      sql += ` AND start_datetime <= ?`;
      params.push(end_date + " 23:59:59");
    }

    sql += ` AND status != '취소'`;

    sql += `
      ORDER BY start_datetime ASC
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
      message: "캘린더 조회 실패",
      error,
    });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      branch_name,
      event_type,
      title,
      customer_name,
      phone,
      start_datetime,
      end_datetime,
      memo,
      status,
      source_type,
      source_id,
    } = body;

    await pool.query(
      `
      INSERT INTO calendar_events
      (
        branch_name,
        event_type,
        title,
        customer_name,
        phone,
        start_datetime,
        end_datetime,
        memo,
        status,
        source_type,
        source_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        branch_name,
        event_type,
        title,
        customer_name,
        phone,
        start_datetime,
        end_datetime || null,
        memo || "",
        status || "예약",
        source_type || "",
        source_id || "",
      ]
    );

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json({
      success: false,
      message: "캘린더 저장 실패",
      error,
    });
  }
}