import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { phone_last4, checkin_code } = body;

    const code = checkin_code || phone_last4;

    if (!code || !/^\d{4}$/.test(code)) {
      return NextResponse.json({
        success: false,
        message: "출석번호 4자리를 입력해주세요.",
      });
    }

    const [rows]: any = await pool.query(
      `
      SELECT *
      FROM members
      WHERE checkin_code = ?
      LIMIT 1
      `,
      [code]
    );

    // 회원 없음
    if (rows.length === 0) {
      await pool.query(
        `
        INSERT INTO attendance
        (member_id, result)
        VALUES (NULL, 'NOT_FOUND')
        `
      );

      return NextResponse.json({
        success: false,
        message: "회원 없음",
      });
    }

    const member = rows[0];

    // 휴회중
    if (member.status === "REST") {
      await pool.query(
        `
        INSERT INTO attendance
        (member_id, result)
        VALUES (?, 'REST')
        `,
        [member.member_id]
      );

      return NextResponse.json({
        success: false,
        message: "휴회중 회원",
      });
    }

    const today = new Date();
    const endDate = new Date(member.end_date);

    // 만료
    if (member.status === "EXPIRED" || endDate < today) {
      await pool.query(
        `
        INSERT INTO attendance
        (member_id, result)
        VALUES (?, 'EXPIRED')
        `,
        [member.member_id]
      );

      return NextResponse.json({
        success: false,
        message: "만료된 회원",
      });
    }

    let remainingCount = member.remaining_count;

    // 횟수 부족
    if (member.pass_type === "COUNT") {
      if (member.remaining_count <= 0) {
        await pool.query(
          `
          INSERT INTO attendance
          (member_id, result)
          VALUES (?, 'NO_COUNT')
          `,
          [member.member_id]
        );

        return NextResponse.json({
          success: false,
          message: "남은 횟수 없음",
        });
      }

      await pool.query(
        `
        UPDATE members
        SET remaining_count = remaining_count - 1
        WHERE member_id = ?
        `,
        [member.member_id]
      );

      remainingCount = member.remaining_count - 1;
    }

    // 출석 성공
    await pool.query(
      `
      INSERT INTO attendance
      (member_id, result)
      VALUES (?, 'SUCCESS')
      `,
      [member.member_id]
    );

    return NextResponse.json({
      success: true,
      message: "출석 완료",
      member: {
        member_id: member.member_id,
        name: member.name,
        branch_name: member.branch_name,
        phone: member.phone,
        checkin_code: member.checkin_code,
        product_name: member.product_name,
        pass_type: member.pass_type,
        remaining_count:
          member.pass_type === "COUNT"
            ? remainingCount
            : "기간권",
        end_date: member.end_date,
      },
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json({
      success: false,
      message: "출석 처리 중 오류가 발생했습니다.",
      error,
    });
  }
}