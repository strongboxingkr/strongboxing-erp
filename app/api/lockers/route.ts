import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest, isAdminOrOwner } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const user = getUserFromRequest(req);
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
