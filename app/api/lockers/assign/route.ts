import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getErpUser, canManageBranch, requireRole } from "@/lib/erp-session";

export async function POST(req: Request) {
  try {
    const user = await getErpUser(req);
    if (!user) return NextResponse.json({ success: false, message: "로그인이 필요합니다." }, { status: 401 });

    const { branch_name, locker_zone, locker_no, member_id, member_name, gender, start_date, end_date, memo, has_luggage } = await req.json();

    if (!branch_name || !locker_no) {
      return NextResponse.json({ success: false, message: "지점, 락커번호 필수" });
    }

    if (!requireRole(user, ["ADMIN", "OWNER", "DIRECTOR"])) {
      return NextResponse.json({ success: false, message: "권한이 없습니다." }, { status: 403 });
    }
    if (!canManageBranch(user, branch_name)) {
      return NextResponse.json({ success: false, message: "권한이 없습니다." }, { status: 403 });
    }

    const zone = locker_zone || "A";
    const conn = await (pool as any).getConnection();
    try {
      await conn.beginTransaction();

      // 중복 배정 방지: 대상 라커가 다른 회원에게 배정돼 있으면 거부
      const [occupied]: any = await conn.query(
        `SELECT member_id FROM lockers WHERE branch_name=? AND locker_zone=? AND locker_no=? AND member_id IS NOT NULL AND member_id != ? FOR UPDATE`,
        [branch_name, zone, locker_no, member_id || 0]
      );
      if (occupied.length > 0) {
        await conn.rollback();
        return NextResponse.json({ success: false, message: "해당 락커는 이미 다른 회원에게 배정되어 있습니다." });
      }

      await conn.query(
        `INSERT INTO lockers (branch_name, locker_zone, locker_no, member_id, member_name, gender, start_date, end_date, memo, has_luggage)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           member_id = VALUES(member_id),
           member_name = VALUES(member_name),
           gender = VALUES(gender),
           start_date = VALUES(start_date),
           end_date = VALUES(end_date),
           memo = VALUES(memo),
           has_luggage = VALUES(has_luggage)`,
        [branch_name, zone, locker_no, member_id || null, member_name || null, gender || null, start_date || null, end_date || null, memo || null, has_luggage ?? 0]
      );

      if (member_id) {
        await conn.query(`UPDATE members SET locker_no = ? WHERE member_id = ?`, [locker_no, member_id]);

        await conn.query(
          `INSERT INTO member_histories (member_id, member_name, action_type, action_memo, old_value, new_value, created_by)
           VALUES (?, ?, 'LOCKER_ASSIGN', ?, ?, ?, ?)`,
          [
            member_id, member_name || null, "락커 배정",
            JSON.stringify({ locker_no: null }),
            JSON.stringify({ branch_name, locker_zone: zone, locker_no, start_date, end_date }),
            user.login_id || "관리자",
          ]
        );
      }

      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error });
  }
}
