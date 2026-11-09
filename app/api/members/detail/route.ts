import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest, canAccessBranch } from "@/lib/auth";

export async function GET(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { searchParams } = new URL(req.url);
    const member_id = searchParams.get("member_id");
    if (!member_id) return NextResponse.json({ success: false, message: "member_id 없음" });

    const [rows]: any = await pool.query(
      `SELECT member_id, name, phone, phone_last4, branch_name, product_name, pass_type,
              start_date, end_date, remaining_count, checkin_code,
              has_uniform, has_locker, locker_no, status, memo,
              member_no, gender, birth_date, join_date, emergency_contact, address, staff_name
       FROM members WHERE member_id = ? LIMIT 1`,
      [member_id]
    );

    if (rows.length === 0) return NextResponse.json({ success: false, message: "회원 없음" });

    if (!canAccessBranch(user.role, user.branch_name, rows[0].branch_name)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ success: true, member: rows[0] });
  } catch (error) {
    return NextResponse.json({ success: false, error });
  }
}
