import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const user = getUserFromRequest(req);
    const body = await req.json();

    const { member_id, hold_start, hold_end, reason } = body;

    if (!member_id || !hold_start || !hold_end) {
      return NextResponse.json({
        success: false,
        message: "회원ID, 휴회 시작일, 종료일은 필수입니다.",
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
      return NextResponse.json(
        { success: false, message: "회원을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const member = memberRows[0];
    const createdBy = user.login_id || "관리자";

    const [result]: any = await pool.query(
      `
      INSERT INTO member_holds
      (member_id, hold_start, hold_end, reason, created_by)
      VALUES (?, ?, ?, ?, ?)
      `,
      [member_id, hold_start, hold_end, reason || null, createdBy]
    );

    await pool.query(
      `
      UPDATE members
      SET status = 'REST'
      WHERE member_id = ?
      `,
      [member_id]
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
        member.name,
        "HOLD",
        "회원 휴회 등록",
        JSON.stringify(member),
        JSON.stringify({
          hold_id: result.insertId,
          hold_start,
          hold_end,
          reason,
        }),
        createdBy,
      ]
    );

    return NextResponse.json({
      success: true,
      message: "휴회 등록 완료",
      hold_id: result.insertId,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: "휴회 등록 실패",
      error,
    });
  }
}