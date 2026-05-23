import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      name,
      phone,
      checkin_code,
      branch_name,
      product_name,
      pass_type,
      remaining_count,
      start_date,
      end_date,
      memo,
    } = body;

    if (!name || !phone || !checkin_code || !branch_name) {
      return NextResponse.json({
        success: false,
        message: "이름, 전화번호, 출석번호, 지점은 필수입니다.",
      });
    }

    if (!/^\d{4}$/.test(checkin_code)) {
      return NextResponse.json({
        success: false,
        message: "출석번호는 숫자 4자리로 입력해주세요.",
      });
    }

    const phone_last4 = phone.slice(-4);

    const [dupRows]: any = await pool.query(
      `
      SELECT member_id, name
      FROM members
      WHERE branch_name = ?
      AND checkin_code = ?
      LIMIT 1
      `,
      [branch_name, checkin_code]
    );

    if (dupRows.length > 0) {
      return NextResponse.json({
        success: false,
        message: `이미 사용 중인 출석번호입니다. (${dupRows[0].name} 회원)`,
      });
    }

    await pool.query(
      `
      INSERT INTO members
      (
        branch_name,
        name,
        phone,
        phone_last4,
        checkin_code,
        product_name,
        pass_type,
        remaining_count,
        start_date,
        end_date,
        status,
        memo
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?)
      `,
      [
        branch_name,
        name,
        phone,
        phone_last4,
        checkin_code,
        product_name,
        pass_type,
        remaining_count,
        start_date,
        end_date,
        memo || "",
      ]
    );

    return NextResponse.json({
      success: true,
      message: "회원 등록 완료",
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json({
      success: false,
      message: "회원 등록 중 오류가 발생했습니다.",
      error,
    });
  }
}