import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ success: false, message: "로그인이 필요합니다." }, { status: 401 });
    const { locker_id } = await req.json();

    // 해제 전 member_id 조회 (members.locker_no 초기화용)
    const [lockerRows]: any = await pool.query(
      `SELECT member_id, locker_no FROM lockers WHERE locker_id = ? LIMIT 1`,
      [locker_id]
    );

    await pool.query(
      `UPDATE lockers SET member_id=NULL, member_name=NULL, start_date=NULL, end_date=NULL, memo=NULL WHERE locker_id=?`,
      [locker_id]
    );

    if (lockerRows.length > 0 && lockerRows[0].member_id) {
      await pool.query(
        `UPDATE members SET locker_no = NULL WHERE member_id = ? AND locker_no = ?`,
        [lockerRows[0].member_id, lockerRows[0].locker_no]
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error });
  }
}
