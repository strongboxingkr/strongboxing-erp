import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ success: false, message: "로그인이 필요합니다." }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const member_id = searchParams.get("member_id");
    if (!member_id) return NextResponse.json({ success: false });

    const [rows]: any = await pool.query(
      `SELECT * FROM payments WHERE member_id = ? ORDER BY payment_id DESC LIMIT 1`,
      [member_id]
    );

    return NextResponse.json({
      success: true,
      payment: rows[0] || null,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error });
  }
}
