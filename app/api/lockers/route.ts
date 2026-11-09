import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest, isAdminOrOwner } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const user = await getUserFromRequest(req);

    if (!user) return NextResponse.json({ success: false, message: "로그인이 필요합니다." }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const branch_name = searchParams.get("branch_name") || user.branch_name || "";

    const [rows]: any = await pool.query(
      `SELECT * FROM lockers WHERE branch_name = ? ORDER BY locker_zone, locker_no`,
      [branch_name]
    );

    return NextResponse.json({ success: true, rows });
  } catch (error) {
    return NextResponse.json({ success: false, error });
  }
}
