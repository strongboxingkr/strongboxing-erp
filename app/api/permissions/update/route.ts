import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      permission_id,
      can_view,
      can_create,
      can_update,
      can_delete,
    } = body;

    await pool.query(
      `
      UPDATE role_permissions
      SET
        can_view = ?,
        can_create = ?,
        can_update = ?,
        can_delete = ?
      WHERE permission_id = ?
      `,
      [
        can_view,
        can_create,
        can_update,
        can_delete,
        permission_id,
      ]
    );

    return NextResponse.json({
      success: true,
      message: "권한 수정 완료",
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: "권한 수정 실패",
      error,
    });
  }
}