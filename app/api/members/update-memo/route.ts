import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest, canAccessBranch } from "@/lib/auth";

export async function POST(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { member_id, memo } = await req.json();
    if (!member_id) return NextResponse.json({ success: false, message: "member_id 없음" });

    const [memberRows]: any = await pool.query(
      `SELECT branch_name FROM members WHERE member_id = ? LIMIT 1`,
      [member_id]
    );
    if (memberRows.length === 0) return NextResponse.json({ success: false, message: "회원 없음" }, { status: 404 });
    if (!canAccessBranch(user.role, user.branch_name, memberRows[0].branch_name)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await pool.query("UPDATE members SET memo = ? WHERE member_id = ?", [memo || "", member_id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error });
  }
}
