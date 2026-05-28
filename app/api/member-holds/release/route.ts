import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const user = getUserFromRequest(req);
    const body = await req.json();

    const { member_id, hold_id } = body;

    if (!member_id) {
      return NextResponse.json({
        success: false,
        message: "member_id가 필요합니다.",
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

    if (hold_id) {
      await pool.query(
        `
        UPDATE member_holds
        SET released_at = NOW(),
            released_by = ?
        WHERE hold_id = ?
          AND member_id = ?
        `,
        [createdBy, hold_id, member_id]
      );
    }

    await pool.query(
      `
      UPDATE members
      SET status = 'ACTIVE'
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
        "HOLD_RELEASE",
        "회원 휴회 해제",
        JSON.stringify(member),
        JSON.stringify({
          hold_id: hold_id || null,
          status: "ACTIVE",
        }),
        createdBy,
      ]
    );

    return NextResponse.json({
      success: true,
      message: "휴회가 해제되었습니다.",
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: "휴회 해제 실패",
      error,
    });
  }
}