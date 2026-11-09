import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { computeReleaseEnd, kstToday, withMemberChange } from "@/lib/membership-ops";

export async function POST(req: Request) {
  try {
    const user = await getUserFromRequest(req);

    if (!user) return NextResponse.json({ success: false, message: "로그인이 필요합니다." }, { status: 401 });

    const body = await req.json();

    const { member_id, hold_id } = body;

    if (!member_id) {
      return NextResponse.json({
        success: false,
        message: "member_id가 필요합니다.",
      });
    }

    const [memberRows]: any = await pool.query(
      `SELECT * FROM members WHERE member_id = ? LIMIT 1`,
      [member_id]
    );

    if (memberRows.length === 0) {
      return NextResponse.json(
        { success: false, message: "회원을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const member = memberRows[0];
    const createdBy = user.login_id || "관리자";

    // 해제할 휴회 기록 조회 (hold_id 지정 or 최신 미해제)
    const holdQuery = hold_id
      ? `SELECT * FROM member_holds WHERE hold_id = ? AND member_id = ? AND released_at IS NULL LIMIT 1`
      : `SELECT * FROM member_holds WHERE member_id = ? AND released_at IS NULL ORDER BY hold_id DESC LIMIT 1`;
    const holdParams: any[] = hold_id ? [hold_id, member_id] : [member_id];
    const [holdRows]: any = await pool.query(holdQuery, holdParams);

    // end_date 재계산 (조기 복귀 시 잔여 휴회 기간 반영) — 체크인 자동 해제와 동일 로직
    const today = kstToday();
    const holdRecord = holdRows[0] || null;
    const { newEnd } = holdRecord
      ? computeReleaseEnd(holdRecord, member.end_date, today)
      : { newEnd: member.end_date ? String(member.end_date).slice(0, 10) : null };

    await withMemberChange(
      { type: "HOLD_RELEASE", reason: "수동 휴회 해제", source: "member-holds/release", actor: createdBy },
      async (conn) => {
        if (holdRecord) {
          await conn.query(
            `UPDATE member_holds SET released_at = NOW(), released_by = ? WHERE hold_id = ? AND released_at IS NULL`,
            [createdBy, holdRecord.hold_id]
          );
        }

        await conn.query(
          `UPDATE members SET status = 'ACTIVE'${newEnd ? ", end_date = ?" : ""} WHERE member_id = ?`,
          newEnd ? [newEnd, member_id] : [member_id]
        );

        await conn.query(
          `INSERT INTO member_histories (member_id, member_name, action_type, action_memo, old_value, new_value, created_by)
           VALUES (?, ?, 'HOLD_RELEASE', ?, ?, ?, ?)`,
          [
            member_id,
            member.name,
            "수동 휴회 해제",
            JSON.stringify({ hold_id: holdRecord?.hold_id || null, old_end_date: member.end_date }),
            JSON.stringify({ status: "ACTIVE", new_end_date: newEnd }),
            createdBy,
          ]
        );
      }
    );

    return NextResponse.json({
      success: true,
      message: "휴회가 해제되었습니다.",
      new_end_date: newEnd,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: "휴회 해제 실패",
      error,
    });
  }
}