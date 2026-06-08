import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function POST(req: Request) {
  try {

    const body = await req.json();

    const { reservation_id, status, memo } = body;

    const [beforeRows]: any = await pool.query(
      `
      SELECT *
      FROM naver_reservations
      WHERE reservation_id = ?
      `,
      [reservation_id]
    );

    const before = beforeRows[0];

    await pool.query(
      `
      UPDATE naver_reservations
      SET
        status = ?,
        memo = ?
      WHERE reservation_id = ?
      `,
      [status, memo || "", reservation_id]
    );

    const [rows]: any = await pool.query(
          `
          SELECT *
          FROM naver_reservations
          WHERE reservation_id = ?
          `,
          [reservation_id]
        );

        const reservation = rows[0];

        if (
        before.status !== "예약확정" &&
        status === "예약확정" &&
        String(reservation.memo || "").includes("출처: 홈페이지 예약")
      ){
      const message = `[스트롱복싱 ${reservation.branch_name}]

    ${reservation.customer_name}님 예약이 확정되었습니다.

    방문일시 : ${String(reservation.reservation_date).slice(0, 10)}
    ${reservation.reservation_time}

    예약내용 : ${reservation.reservation_product || "방문 상담"}

    편한 복장과 실내 운동화를 지참 후 방문 부탁드립니다.
    처음 방문이신 경우 예약시간 5~10분 전 도착 부탁드립니다.

    감사합니다.
    스트롱복싱 ${reservation.branch_name}`;

      await fetch(
        `${process.env.NEXT_PUBLIC_SITE_URL}/api/sms/send-reservation`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            phone: reservation.phone,
            branch_name: reservation.branch_name,
            receiver_name: reservation.customer_name,
            message,
          }),
        }
      );
    }

    return NextResponse.json({
      success: true,
      message: "예약 상태 수정 완료",
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: "예약 상태 수정 실패",
      error,
    });
  }
}