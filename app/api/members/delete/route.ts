import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { member_id } = body;

    await pool.query(
      "DELETE FROM attendance WHERE member_id = ?",
      [member_id]
    );

    await pool.query(
      "DELETE FROM members WHERE member_id = ?",
      [member_id]
    );

    return NextResponse.json({
      success: true,
      message: "회원 삭제 완료",
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error,
    });
  }
}