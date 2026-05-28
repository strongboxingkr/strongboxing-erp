import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const member_id = searchParams.get("member_id");

    if (!member_id) {
      return NextResponse.json({
        success: false,
        message: "member_id가 필요합니다.",
      });
    }

    const [rows]: any = await pool.query(
      `
      SELECT *
      FROM member_notes
      WHERE member_id = ?
      ORDER BY note_id DESC
      `,
      [member_id]
    );

    return NextResponse.json({
      success: true,
      rows,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: "상담기록 조회 실패",
      error,
    });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { member_id, note_type, content, created_by } = body;

    if (!member_id || !content) {
      return NextResponse.json({
        success: false,
        message: "회원ID와 메모 내용은 필수입니다.",
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
    const finalCreatedBy = created_by || "관리자";

    const [result]: any = await pool.query(
      `
      INSERT INTO member_notes (
        member_id,
        note_type,
        content,
        created_by
      )
      VALUES (?, ?, ?, ?)
      `,
      [member_id, note_type || "GENERAL", content, finalCreatedBy]
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
        "회원 메모 추가",
        null,
        JSON.stringify({
          note_id: result.insertId,
          note_type: note_type || "GENERAL",
          content,
        }),
        finalCreatedBy,
      ]
    );

    return NextResponse.json({
      success: true,
      message: "메모가 추가되었습니다.",
      note_id: result.insertId,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: "메모 추가 중 오류가 발생했습니다.",
        error,
      },
      { status: 500 }
    );
  }
}