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
      locker_no,
      member_no,
      gender,
      birth_date,
      emergency_contact,
      address,
      join_date,
      staff_name,
      checkin_sms_enabled,
      checkout_sms_enabled,
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

    const [noRows]: any = await pool.query(
      `
      SELECT COALESCE(MAX(CAST(member_no AS UNSIGNED)), 0) + 1 AS next_member_no
      FROM members
      WHERE branch_name = ?
        AND member_no REGEXP '^[0-9]+$'
      `,
      [branch_name]
    );

    const finalMemberNo = member_no || String(noRows[0].next_member_no);

    const [result]: any = await pool.query(
      `
      INSERT INTO members (
        branch_name,
        name,
        phone,
        emergency_contact,
        checkin_code,
        product_name,
        pass_type,
        remaining_count,
        start_date,
        end_date,
        status,
        memo,
        locker_no,
        member_no,
        gender,
        birth_date,
        address,
        join_date,
        staff_name,
        checkin_sms_enabled,
        checkout_sms_enabled
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        branch_name,
        name,
        phone,
        emergency_contact || null,
        checkin_code,
        product_name || null,
        pass_type || "PERIOD",
        remaining_count || 0,
        start_date || null,
        end_date || null,
        memo || "",
        locker_no || null,
        finalMemberNo,
        gender || null,
        birth_date || null,
        address || null,
        join_date || start_date || null,
        staff_name || null,
        checkin_sms_enabled || 0,
        checkout_sms_enabled || 0,
      ]
    );

    const memberId = result.insertId;

    await pool.query(
      `
      INSERT INTO member_histories (
        member_id,
        member_name,
        action_type,
        action_memo,
        old_value,
        new_value,
        created_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        memberId,
        name,
        "REGISTER",
        "회원 등록",
        null,
        JSON.stringify({
          member_id: memberId,
          member_no: finalMemberNo,
          ...body,
        }),
        staff_name || "관리자",
      ]
    );

    return NextResponse.json({
      success: true,
      message: "회원 등록 완료",
      member_id: memberId,
      member_no: finalMemberNo,
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