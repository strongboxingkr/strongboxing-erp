import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";

export async function POST(req: Request, context: any) {
  try {
    const user = getUserFromRequest(req);
    const reservationId = context.params.id;
    const body = await req.json();

    const {
      product_name,
      pass_type,
      remaining_count,
      start_date,
      end_date,
      locker_no,
      member_no,
      gender,
      birth_date,
      staff_name,
      memo,
    } = body;

    const [reservationRows]: any = await pool.query(
      `
      SELECT *
      FROM naver_reservations
      WHERE reservation_id = ?
      LIMIT 1
      `,
      [reservationId]
    );

    if (reservationRows.length === 0) {
      return NextResponse.json(
        { success: false, message: "예약을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const reservation = reservationRows[0];

    if (!reservation.branch_name || !reservation.customer_name || !reservation.phone) {
      return NextResponse.json({
        success: false,
        message: "예약 정보에 지점명, 이름, 연락처가 필요합니다.",
      });
    }

    if (!pass_type) {
      return NextResponse.json({
        success: false,
        message: "회원권 타입은 필수입니다.",
      });
    }

    const phoneLast4 = String(reservation.phone).slice(-4);
    const finalStaffName = staff_name || user.login_id || "관리자";

    const [memberResult]: any = await pool.query(
      `
      INSERT INTO members (
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
        memo,
        locker_no,
        member_no,
        gender,
        birth_date,
        staff_name
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        reservation.branch_name,
        reservation.customer_name,
        reservation.phone,
        phoneLast4,
        phoneLast4,
        product_name || reservation.reservation_product || null,
        pass_type,
        remaining_count || 0,
        start_date || null,
        end_date || null,
        "ACTIVE",
        memo || reservation.memo || null,
        locker_no || null,
        member_no || null,
        gender || null,
        birth_date || null,
        finalStaffName,
      ]
    );

    const memberId = memberResult.insertId;

    await pool.query(
      `
      UPDATE naver_reservations
      SET status = '회원등록완료',
          is_read = 'Y'
      WHERE reservation_id = ?
      `,
      [reservationId]
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
        memberId,
        reservation.customer_name,
        "REGISTER",
        "네이버 예약에서 회원 등록",
        JSON.stringify(reservation),
        JSON.stringify({
          member_id: memberId,
          reservation_id: reservationId,
          ...body,
        }),
        finalStaffName,
      ]
    );

    return NextResponse.json({
      success: true,
      message: "예약 회원 등록이 완료되었습니다.",
      member_id: memberId,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: "예약 회원 등록 전환 실패",
        error,
      },
      { status: 500 }
    );
  }
}