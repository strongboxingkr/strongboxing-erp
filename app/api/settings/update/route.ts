import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function POST(req: Request) {
  try {
    const { option_id, option_value } = await req.json();
    if (!option_id) return NextResponse.json({ success: false, message: "option_id 없음" });

    await pool.query(
      `UPDATE settings_options SET option_value = ? WHERE option_id = ?`,
      [option_value, option_id]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error });
  }
}
