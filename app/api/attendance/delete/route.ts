import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function POST(req: Request) {
  try {
    const { attendance_id, member_id, pass_type } = await req.json();
    if (!attendance_id) return NextResponse.json({ success: false, message: "attendance_id 없음" });

    // 횟수권이면 삭제 시 remaining_count 복구
    const [rows]: any = await pool.query(
      "SELECT result FROM attendance WHERE attendance_id = ?",
      [attendance_id]
    );
    const wasSuccess = rows[0]?.result === "SUCCESS";

    await pool.query("DELETE FROM attendance WHERE attendance_id = ?", [attendance_id]);

    if (wasSuccess && pass_type === "COUNT" && member_id) {
      await pool.query(
        "UPDATE members SET remaining_count = remaining_count + 1 WHERE member_id = ?",
        [member_id]
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error });
  }
}
