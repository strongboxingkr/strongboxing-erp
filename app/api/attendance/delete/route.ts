import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { taggedQuery } from "@/lib/membership-ops";

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
      // 출석 삭제에 따른 횟수 복구는 출석 기록 영역 (변경 내역에 넣지 않음)
      await taggedQuery({ type: "ATTENDANCE_UNDO", source: "attendance/delete" },
        "UPDATE members SET remaining_count = remaining_count + 1 WHERE member_id = ?",
        [member_id]
      );
    }

    if (wasSuccess && pass_type === "DAILY") {
      await pool.query(
        `UPDATE day_passes SET status='PENDING', used_at=NULL, attendance_id=NULL WHERE attendance_id=?`,
        [attendance_id]
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error });
  }
}
