import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { taggedQuery } from "@/lib/membership-ops";
import { getUserFromRequest, isAdminOrOwner } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const user = await getUserFromRequest(req);

    if (!user) return NextResponse.json({ success: false, message: "로그인이 필요합니다." }, { status: 401 });

    const body = await req.json();
    const { branch_name, days, base_date, exclude_hold, exclude_not_started } = body;

    if (!branch_name) return NextResponse.json({ success: false, message: "지점을 선택해주세요" });
    if (!days || days === 0) return NextResponse.json({ success: false, message: "조정일을 입력해주세요" });

    if (!isAdminOrOwner(user.role) && user.branch_name !== branch_name) {
      return NextResponse.json({ success: false, message: "권한이 없습니다" });
    }

    const baseDate = base_date || new Date().toISOString().slice(0, 10);
    const params: any[] = [days, branch_name, baseDate];
    let extraClauses = "";
    if (exclude_hold) extraClauses += " AND status != 'REST'";
    if (exclude_not_started) {
      extraClauses += " AND DATE(start_date) <= ?";
      params.push(baseDate);
    }

    const label = days > 0 ? `${days}일 연장` : `${Math.abs(days)}일 단축`;
    const [result]: any = await taggedQuery(
      { type: "BULK_EXTEND", reason: `지점 기간 일괄 ${label}`, source: "members/bulk-extend", actor: "직원" },
      `UPDATE members
       SET end_date = DATE_ADD(end_date, INTERVAL ? DAY)
       WHERE branch_name = ?
         AND pass_type = 'PERIOD'
         AND DATE(end_date) >= ?${extraClauses}`,
      params
    );

    return NextResponse.json({
      success: true,
      message: `${result.affectedRows}명의 만료일이 ${label}되었습니다.`,
      affected: result.affectedRows,
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: "일괄 연장 실패", error });
  }
}
