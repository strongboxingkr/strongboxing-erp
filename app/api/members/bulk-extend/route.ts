import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest, isAdminOrOwner } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const user = getUserFromRequest(req);
    const body = await req.json();
    const { branch_name, days } = body;

    if (!branch_name) return NextResponse.json({ success: false, message: "지점을 선택해주세요" });
    if (!days || days <= 0) return NextResponse.json({ success: false, message: "연장 일수를 입력해주세요" });

    // 관장은 자기 지점만 가능
    if (!isAdminOrOwner(user.role) && user.branch_name !== branch_name) {
      return NextResponse.json({ success: false, message: "권한이 없습니다" });
    }

    const [result]: any = await pool.query(
      `UPDATE members
       SET end_date = DATE_ADD(end_date, INTERVAL ? DAY)
       WHERE branch_name = ?
         AND pass_type = 'DATE'
         AND DATE(end_date) >= CURDATE()`,
      [days, branch_name]
    );

    return NextResponse.json({
      success: true,
      message: `${result.affectedRows}명의 만료일이 ${days}일 연장되었습니다.`,
      affected: result.affectedRows,
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: "일괄 연장 실패", error });
  }
}
