import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function POST(req: Request) {
  try {
    const { locker_id } = await req.json();
    await pool.query(
      `UPDATE lockers SET member_id=NULL, member_name=NULL, start_date=NULL, end_date=NULL, memo=NULL WHERE locker_id=?`,
      [locker_id]
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error });
  }
}
