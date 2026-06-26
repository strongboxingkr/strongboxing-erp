import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function POST(req: Request) {
  try {
    const { user_id, role } = await req.json();
    if (!user_id) return NextResponse.json({ success: false, message: "user_id 없음" });

    await pool.query(
      `UPDATE users SET status = 'APPROVED', role = COALESCE(?, role) WHERE user_id = ?`,
      [role || null, user_id]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, message: "승인 실패", error });
  }
}
