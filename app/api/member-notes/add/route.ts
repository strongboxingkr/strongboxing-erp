import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const user = getUserFromRequest(req);
    const body = await req.json();

    const { member_id, note_type, content } = body;

    if (!member_id || !content) {
      return NextResponse.json({
        success: false,
        message: "회원ID와 상담내용은 필수입니다.",
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
        {
          success: false,
          message: "회원을 찾을 수 없습니다.",
        },
        { status: 404 }
      );
    }

    const member = memberRows[0];
    const createdBy = user.login_id || "관리자";

    const [result]: any = await pool.query(
      `
      INSERT INTO member_notes
      (member_id, note_type, content, created_by)
      VALUES (?, ?, ?, ?)
      `,
      [
        member_id,
        note_type || "상담",
        content,
        createdBy,
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
        member.name,
        "NOTE",
        "상담기록 추가",
        null,
        JSON.stringify({
          note_id: result.insertId,
          note_type: note_type || "상담",
          content,
        }),
        createdBy,
      ]
    );

    return NextResponse.json({
      success: true,
      message: "상담기록 추가 완료",
      note_id: result.insertId,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: "상담기록 추가 실패",
      error,
    });
  }
}