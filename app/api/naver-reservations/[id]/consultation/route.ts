import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";

export async function POST(req: Request, context: any) {
  try {
    const user = getUserFromRequest(req);

    const reservationId = context.params.id;
    const body = await req.json();

    const {
      consultation_result,
      consultation_memo,
      next_action,
      status,
    } = body;

    const [rows]: any = await pool.query(
      `
      SELECT *
      FROM naver_reservations
      WHERE reservation_id = ?
      LIMIT 1
      `,
      [reservationId]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "예약 정보를 찾을 수 없습니다.",
        },
        { status: 404 }
      );
    }

    const reservation = rows[0];

    const finalMemo = `
[상담결과]
${consultation_result || ""}

[상담메모]
${consultation_memo || ""}

[후속조치]
${next_action || ""}
    `.trim();

    await pool.query(
      `
      UPDATE naver_reservations
      SET
        memo = ?,
        status = ?,
        is_read = 'Y'
      WHERE reservation_id = ?
      `,
      [
        finalMemo,
        status || "상담완료",
        reservationId,
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
        null,
        reservation.customer_name,
        "RESERVATION_CONSULTATION",
        "예약 상담 기록",
        JSON.stringify(reservation),
        JSON.stringify({
          consultation_result,
          consultation_memo,
          next_action,
          status: status || "상담완료",
        }),
        user.login_id || "관리자",
      ]
    );

    return NextResponse.json({
      success: true,
      message: "상담 기록이 저장되었습니다.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: "상담 기록 저장 실패",
        error,
      },
      { status: 500 }
    );
  }
}