import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      lead_id,
      branch_name,
      customer_name,
      phone,
      inquiry_type,
      inquiry_channel,
      status,
      memo,
      next_contact_date,

      auto_create_member,
    } = body;

    await pool.query(
      `
      UPDATE crm_leads
      SET
        branch_name = ?,
        customer_name = ?,
        phone = ?,
        inquiry_type = ?,
        inquiry_channel = ?,
        status = ?,
        memo = ?,
        next_contact_date = ?
      WHERE lead_id = ?
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
        lead_id,
      ]
    );

    // 회원 자동 생성
    if (status === "등록완료" && auto_create_member) {
      const [exists]: any = await pool.query(
        `
        SELECT member_id
        FROM members
        WHERE phone = ?
        LIMIT 1
        `,
        [phone]
      );

      // 중복 없을 때만 생성
      if (exists.length === 0) {
        await pool.query(
          `
          INSERT INTO members
          (
            branch_name,
            name,
            phone,
            pass_type,
            product_name,
            start_date,
            end_date,
            remaining_count,
            status,
            memo
          )
          VALUES
          (
            ?,
            ?,
            ?,
            'PERIOD',
            '미등록',
            CURDATE(),
            DATE_ADD(CURDATE(), INTERVAL 30 DAY),
            NULL,
            'ACTIVE',
            ?
          )
          `,
          [
            branch_name,
            customer_name,
            phone,
            memo || "CRM 자동 등록",
          ]
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: "상담 수정 완료",
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json({
      success: false,
      message: "상담 수정 실패",
      error,
    });
  }
}