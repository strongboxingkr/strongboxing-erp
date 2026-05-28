import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(req: Request, context: any) {
  const memberId = context.params.id;

  try {
    const [memberRows]: any = await pool.query(
      `
      SELECT *
      FROM members
      WHERE member_id = ?
      LIMIT 1
      `,
      [memberId]
    );

    if (memberRows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "회원을 찾을 수 없습니다.",
        },
        { status: 404 }
      );
    }

    const member = memberRows[0];

    const [payments]: any = await pool.query(
      `
      SELECT *
      FROM payments
      WHERE member_id = ?
      ORDER BY payment_date DESC, payment_id DESC
      `,
      [memberId]
    );

    const [attendance]: any = await pool.query(
      `
      SELECT *
      FROM attendance
      WHERE member_id = ?
      ORDER BY checkin_time DESC
      LIMIT 100
      `,
      [memberId]
    );

    const [histories]: any = await pool.query(
      `
      SELECT *
      FROM member_histories
      WHERE member_id = ?
      ORDER BY created_at DESC
      LIMIT 100
      `,
      [memberId]
    );

    const [notes]: any = await pool.query(
      `
      SELECT *
      FROM member_notes
      WHERE member_id = ?
      ORDER BY created_at DESC
      LIMIT 100
      `,
      [memberId]
    );

    const [holds]: any = await pool.query(
      `
      SELECT *
      FROM member_holds
      WHERE member_id = ?
      ORDER BY created_at DESC
      LIMIT 50
      `,
      [memberId]
    );

    const [files]: any = await pool.query(
      `
      SELECT *
      FROM member_files
      WHERE member_id = ?
      ORDER BY created_at DESC
      LIMIT 50
      `,
      [memberId]
    );

    return NextResponse.json({
      success: true,
      member,
      payments,
      attendance,
      histories,
      notes,
      holds,
      files,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: "회원 상세정보 조회 중 오류가 발생했습니다.",
        error,
      },
      { status: 500 }
    );
  }
}