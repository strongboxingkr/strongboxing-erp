import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      member_id,
      branch_name,
      name,
      phone,
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
      emergency_contact,
      address,
      join_date,
      staff_name,
    } = body;

    if (!member_id) {
      return NextResponse.json({
        success: false,
        message: "member_id가 필요합니다.",
      });
    }

    const [oldRows]: any = await pool.query(
      `
      SELECT *
      FROM members
      WHERE member_id = ?
      LIMIT 1
      `,
      [member_id]
    );

    if (oldRows.length === 0) {
      return NextResponse.json({
        success: false,
        message: "회원을 찾을 수 없습니다.",
      });
    }

    const oldMember = oldRows[0];
    const phoneLast4 = String(phone || oldMember.phone || "").slice(-4);
    const finalCheckinCode = checkin_code || oldMember.checkin_code || phoneLast4;

    await pool.query(
      `
      UPDATE members
      SET
        branch_name = ?,
        name = ?,
        phone = ?,
        phone_last4 = ?,
        checkin_code = ?,
        product_name = ?,
        pass_type = ?,
        remaining_count = ?,
        start_date = ?,
        end_date = ?,
        status = ?,
        memo = ?,
        locker_no = ?,
        member_no = ?,
        gender = ?,
        birth_date = ?,
        emergency_contact = ?,
        address = ?,
        join_date = ?,
        staff_name = ?
      WHERE member_id = ?
      `,
      [
        branch_name || oldMember.branch_name,
        name || oldMember.name,
        phone || oldMember.phone,
        phoneLast4,
        finalCheckinCode,
        product_name || oldMember.product_name,
        pass_type || oldMember.pass_type,
        remaining_count ?? oldMember.remaining_count,
        start_date || oldMember.start_date,
        end_date || oldMember.end_date,
        status || oldMember.status,
        memo ?? oldMember.memo,
        locker_no ?? oldMember.locker_no,
        member_no ?? oldMember.member_no,
        gender ?? oldMember.gender,
        birth_date || oldMember.birth_date,
        emergency_contact ?? oldMember.emergency_contact,
        address ?? oldMember.address,
        join_date || oldMember.join_date,
        staff_name ?? oldMember.staff_name,
        member_id,
      ]
    );

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
        member_id,
        name || oldMember.name,
        "UPDATE",
        "회원정보 수정",
        JSON.stringify(oldMember),
        JSON.stringify(body),
        staff_name || "관리자",
      ]
    );

    return NextResponse.json({
      success: true,
      message: "회원 수정 완료",
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json({
      success: false,
      message: "회원 수정 실패",
      error,
    });
  }
}