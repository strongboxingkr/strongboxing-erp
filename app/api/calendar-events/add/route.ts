import { NextResponse } from "next/server";
import pool from "@/lib/db";

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
      memo,
      status,
    } = body;

    if (!branch_name || !start_datetime) {
      return NextResponse.json({
        success: false,
        message: "지점과 예약일시는 필수입니다.",
      });
    }

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
      VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)
      `,
      [
        branch_name,
        event_type || "PHONE",
        title || "전화문의 예약",
        customer_name || "",
        phone || "",
        start_datetime,
        memo || "",
        status || "예약",
        "MANUAL",
        "",
      ]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);

    return NextResponse.json({
      success: false,
      message: "예약 등록 실패",
      error,
    });
  }
}