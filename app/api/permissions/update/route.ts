import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest, isAdminOrOwner } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isAdminOrOwner(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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