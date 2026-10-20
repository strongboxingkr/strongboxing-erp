import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const member_id = searchParams.get("member_id");
    if (!member_id) return NextResponse.json({ success: false, message: "member_id 없음" });

    const [rows]: any = await pool.query(
      `SELECT member_id, name, phone, branch_name, product_name, pass_type,
              start_date, end_date, remaining_count, checkin_code,
              has_uniform, has_locker, locker_no, status
       FROM members WHERE member_id = ? LIMIT 1`,
      [member_id]
    );

    if (rows.length === 0) return NextResponse.json({ success: false, message: "회원 없음" });

    return NextResponse.json({ success: true, member: rows[0] });
  } catch (error) {
    return NextResponse.json({ success: false, error });
  }
}
