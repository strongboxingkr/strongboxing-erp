import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function POST(req: Request) {
  try {
    const { branch_name, locker_zone, locker_no, member_id, member_name, start_date, end_date, memo } = await req.json();

    if (!branch_name || !locker_no) {
      return NextResponse.json({ success: false, message: "지점, 락커번호 필수" });
    }

    await pool.query(
      `INSERT INTO lockers (branch_name, locker_zone, locker_no, member_id, member_name, start_date, end_date, memo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         member_id = VALUES(member_id),
         member_name = VALUES(member_name),
         start_date = VALUES(start_date),
         end_date = VALUES(end_date),
         memo = VALUES(memo)`,
      [branch_name, locker_zone || "A", locker_no, member_id || null, member_name || null, start_date || null, end_date || null, memo || null]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error });
  }
}
