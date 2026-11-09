import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { applyHold, HoldError, withMemberChange } from "@/lib/membership-ops";

/**
 * 데스크 휴회 등록 (회원관리 화면). 계산 규칙은 기존과 같음: 시작~종료 포함 일수만큼 만료일 연장 + REST.
 * 변경점: 회원 행 잠금 + 트랜잭션, 이미 휴회 중·만료·겹치는 휴회 차단, 회원권 변경 내역 기록
 *         (휴회는 관장이 ERP에서 직접 처리. 회원 앱에는 휴회 신청 기능 없음)
 */
export async function POST(req: Request) {
  try {
    const user = await getUserFromRequest(req);

    if (!user) return NextResponse.json({ success: false, message: "로그인이 필요합니다." }, { status: 401 });

    const { member_id, hold_start, hold_end, reason } = await req.json();
    if (!member_id || !hold_start || !hold_end) {
      return NextResponse.json({ success: false, message: "회원ID, 휴회 시작일, 종료일은 필수입니다." });
    }
    const actor = user.login_id || "관리자";
    const r = await withMemberChange({ type: "HOLD", reason: "휴회 처리", source: "members/hold", actor }, (conn) =>
      applyHold(conn, { memberId: Number(member_id), holdStart: String(hold_start).slice(0, 10), holdEnd: String(hold_end).slice(0, 10), reason, actor })
    );
    return NextResponse.json({
      success: true,
      message: "휴회 처리 완료",
      hold_days: r.holdDays,
      old_end_date: r.oldEnd,
      new_end_date: r.newEnd,
    });
  } catch (error) {
    if (error instanceof HoldError) return NextResponse.json({ success: false, message: error.message, code: error.code });
    console.error(error);
    return NextResponse.json({ success: false, message: "휴회 처리 실패" });
  }
}
