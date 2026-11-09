import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { withMemberChange } from "@/lib/membership-ops";

export async function POST(req: Request) {
  try {
    const { attendance_id } = await req.json();
    if (!attendance_id) return NextResponse.json({ success: false, message: "attendance_id 없음" });

    // DB에서 직접 확인 (클라이언트 body의 pass_type 신뢰하지 않음)
    const [rows]: any = await pool.query(
      `SELECT a.result, a.member_id, m.pass_type
       FROM attendance a
       LEFT JOIN members m ON a.member_id = m.member_id
       WHERE a.attendance_id = ?`,
      [attendance_id]
    );

    if (rows.length === 0) {
      return NextResponse.json({ success: false, message: "출석 기록 없음" });
    }

    const { result, member_id, pass_type } = rows[0];
    const wasSuccess = result === "SUCCESS";
    const isCountPass = pass_type === "COUNT";

    if (wasSuccess && isCountPass && member_id) {
      // DELETE + remaining_count+1 을 한 트랜잭션으로 (원자성 보장)
      await withMemberChange({ type: "ATTENDANCE_UNDO", source: "attendance/delete" }, async (conn) => {
        await conn.query("DELETE FROM attendance WHERE attendance_id = ?", [attendance_id]);
        await conn.query(
          "UPDATE members SET remaining_count = remaining_count + 1 WHERE member_id = ?",
          [member_id]
        );
      });
    } else {
      await pool.query("DELETE FROM attendance WHERE attendance_id = ?", [attendance_id]);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error });
  }
}
