import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function POST(req: Request) {
  try {
    const { member_id, memo } = await req.json();
    if (!member_id) return NextResponse.json({ success: false, message: "member_id 없음" });
    await pool.query("UPDATE members SET memo = ? WHERE member_id = ?", [memo || "", member_id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error });
  }
}
