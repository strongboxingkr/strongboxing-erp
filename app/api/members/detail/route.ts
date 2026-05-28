import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest, isAdminOrOwner } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const user = getUserFromRequest(req);
    const { searchParams } = new URL(req.url);
    const member_id = searchParams.get("member_id");

    if (!member_id) {
      return NextResponse.json({
        success: false,
        message: "회원 ID가 없습니다.",
      });
    }

    const [memberRows]: any = await pool.query(
      `
      SELECT *
      FROM members
      WHERE member_id = ?
      LIMIT 1
      `,
      [member_id]
    );

    if (memberRows.length === 0) {
      return NextResponse.json({
        success: false,
        message: "회원 정보가 없습니다.",
      });
    }

    const member = memberRows[0];

    if (!isAdminOrOwner(user.role) && user.branch_name !== member.branch_name) {
      return NextResponse.json({
        success: false,
        message: "조회 권한이 없습니다.",
      });
    }

    const [payments]: any = await pool.query(
      `
      SELECT *
      FROM payments
      WHERE member_id = ?
      ORDER BY payment_date DESC, payment_id DESC
      `,
      [member_id]
    );

    const [attendance]: any = await pool.query(
      `
      SELECT *
      FROM attendance
      WHERE member_id = ?
      ORDER BY checkin_time DESC
      LIMIT 100
      `,
      [member_id]
    );

    const [notes]: any = await pool.query(
      `
      SELECT *
      FROM member_notes
      WHERE member_id = ?
      ORDER BY created_at DESC, note_id DESC
      LIMIT 100
      `,
      [member_id]
    );

    const [holds]: any = await pool.query(
      `
      SELECT *
      FROM member_holds
      WHERE member_id = ?
      ORDER BY created_at DESC, hold_id DESC
      LIMIT 50
      `,
      [member_id]
    );

    const [files]: any = await pool.query(
      `
      SELECT *
      FROM member_files
      WHERE member_id = ?
      ORDER BY created_at DESC, file_id DESC
      LIMIT 50
      `,
      [member_id]
    );

    const [histories]: any = await pool.query(
      `
      SELECT *
      FROM member_histories
      WHERE member_id = ?
      ORDER BY created_at DESC, history_id DESC
      LIMIT 100
      `,
      [member_id]
    );

    return NextResponse.json({
      success: true,
      member,
      payments,
      attendance,
      notes,
      holds,
      files,
      histories,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: "회원 상세 조회 실패",
      error,
    });
  }
}