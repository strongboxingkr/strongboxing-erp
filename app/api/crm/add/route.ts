import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest, canAccessBranch } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ success: false, message: "로그인이 필요합니다." }, { status: 401 });

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

    if (!canAccessBranch(user.role, user.branch_name, branch_name)) {
      return NextResponse.json({ success: false, message: "권한이 없습니다." }, { status: 403 });
    }

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