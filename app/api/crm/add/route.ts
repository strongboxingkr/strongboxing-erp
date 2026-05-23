import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      branch_name,
      customer_name,
      phone,
      inquiry_type,
      inquiry_channel,
      status,
      memo,
      next_contact_date,
    } = body;

    await pool.query(
      `
      INSERT INTO crm_leads
      (
        branch_name,
        customer_name,
        phone,
        inquiry_type,
        inquiry_channel,
        status,
        memo,
        next_contact_date
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        branch_name,
        customer_name,
        phone,
        inquiry_type,
        inquiry_channel,
        status,
        memo,
        next_contact_date || null,
      ]
    );

    return NextResponse.json({
      success: true,
      message: "상담 등록 완료",
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: "상담 등록 실패",
      error,
    });
  }
}