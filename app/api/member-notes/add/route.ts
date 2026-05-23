import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const user = getUserFromRequest(req);
    const body = await req.json();

    const { member_id, note_type, content } = body;

    await pool.query(
      `
      INSERT INTO member_notes
      (member_id, note_type, content, created_by)
      VALUES (?, ?, ?, ?)
      `,
      [
        member_id,
        note_type || "상담",
        content || "",
        user.login_id || "",
      ]
    );

    return NextResponse.json({
      success: true,
      message: "상담기록 추가 완료",
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: "상담기록 추가 실패",
      error,
    });
  }
}