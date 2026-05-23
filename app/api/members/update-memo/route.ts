import { NextResponse } from "next/server";
import pool from "@/lib/db";
import {
  getUserFromRequest,
  isAdminOrOwner,
} from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const user = getUserFromRequest(req);

    const body = await req.json();

    const { member_id, memo } = body;

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
        message: "회원 없음",
      });
    }

    const member = memberRows[0];

    if (
      !isAdminOrOwner(user.role) &&
      user.branch_name !== member.branch_name
    ) {
      return NextResponse.json({
        success: false,
        message: "권한 없음",
      });
    }

    await pool.query(
      `
      UPDATE members
      SET memo = ?
      WHERE member_id = ?
      `,
      [memo || "", member_id]
    );

    return NextResponse.json({
      success: true,
      message: "메모 저장 완료",
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: "메모 저장 실패",
      error,
    });
  }
}