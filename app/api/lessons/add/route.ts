import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest, isAdminOrOwner } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const user = getUserFromRequest(req);
    const body = await req.json();

    const {
      branch_name,
      lesson_date,
      lesson_time,
      lesson_type,
      coach_name,
      member_name,
      phone,
      status,
      memo,
    } = body;

    const targetBranch = isAdminOrOwner(user.role)
      ? branch_name
      : user.branch_name;

    await pool.query(
      `
      INSERT INTO lessons
      (
        branch_name,
        lesson_date,
        lesson_time,
        lesson_type,
        coach_name,
        member_name,
        phone,
        status,
        memo
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        targetBranch,
        lesson_date,
        lesson_time,
        lesson_type,
        coach_name,
        member_name,
        phone,
        status || "예약",
        memo || "",
      ]
    );

    return NextResponse.json({
      success: true,
      message: "수업 등록 완료",
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: "수업 등록 실패",
      error,
    });
  }
}