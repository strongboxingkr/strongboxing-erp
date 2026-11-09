import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function POST(req: Request) {
  try {
    const { pass_id } = await req.json();
    if (!pass_id) return NextResponse.json({ success: false, message: "pass_id 없음" });

    const [rows]: any = await pool.query(
      "SELECT status FROM day_passes WHERE pass_id = ?",
      [pass_id]
    );
    if (rows.length === 0) return NextResponse.json({ success: false, message: "일일권 없음" });
    if (rows[0].status === "USED") {
      return NextResponse.json({ success: false, message: "이미 사용된 일일권은 취소할 수 없습니다" });
    }
    if (rows[0].status === "CANCELLED") {
      return NextResponse.json({ success: false, message: "이미 취소된 일일권입니다" });
    }

    await pool.query("UPDATE day_passes SET status='CANCELLED' WHERE pass_id=?", [pass_id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error });
  }
}
