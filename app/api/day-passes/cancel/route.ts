import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getErpUser, requireRole } from "@/lib/erp-session";
import { kstToday } from "@/lib/membership-ops";

// POST /api/day-passes/cancel  { pass_id }
// 일일권 취소 규칙:
//   - PENDING 상태만 취소 가능
//   - USED 상태: 출석 취소(attendance/delete)를 먼저 처리해야 함
//   - 지정일이 지난 뒤 취소해도 미래에 사용 가능한 이용권으로 되살리지 않음 (CANCELLED로만 전환)
export async function POST(req: Request) {
  const user = await getErpUser(req);
  if (!user) return NextResponse.json({ success: false, message: "로그인이 필요합니다." }, { status: 401 });
  if (!requireRole(user, ["ADMIN", "OWNER", "DIRECTOR"])) {
    return NextResponse.json({ success: false, message: "권한이 없습니다." }, { status: 403 });
  }

  const { pass_id } = await req.json();
  if (!pass_id) return NextResponse.json({ success: false, message: "pass_id 필요" });

  const [rows]: any = await pool.query(
    `SELECT * FROM day_passes WHERE pass_id = ? FOR UPDATE`,
    [pass_id]
  );
  if (rows.length === 0) return NextResponse.json({ success: false, message: "일일권 없음" });

  const dp = rows[0];

  if (dp.status === "CANCELLED") {
    return NextResponse.json({ success: false, message: "이미 취소된 일일권입니다." });
  }
  if (dp.status === "USED") {
    return NextResponse.json({
      success: false,
      message: "사용된 일일권입니다. 출석 기록을 먼저 취소한 후 일일권 취소가 가능합니다.",
      attendance_id: dp.attendance_id,
    });
  }

  await pool.query(
    `UPDATE day_passes SET status = 'CANCELLED' WHERE pass_id = ?`,
    [pass_id]
  );

  return NextResponse.json({ success: true, message: "일일권이 취소됐습니다." });
}
