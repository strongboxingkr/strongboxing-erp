import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const branch_name = searchParams.get("branch_name");
    const [rows]: any = await pool.query(
      `SELECT * FROM locker_zones WHERE branch_name = ? ORDER BY sort_order, zone_name`,
      [branch_name]
    );
    return NextResponse.json({ success: true, rows });
  } catch (error) {
    return NextResponse.json({ success: false, error });
  }
}

export async function POST(req: Request) {
  try {
    const { branch_name, zone_name, start_no, end_no, sort_order } = await req.json();
    if (!branch_name || !zone_name || !start_no || !end_no) {
      return NextResponse.json({ success: false, message: "필수값 누락" });
    }
    await pool.query(
      `INSERT INTO locker_zones (branch_name, zone_name, start_no, end_no, sort_order) VALUES (?, ?, ?, ?, ?)`,
      [branch_name, zone_name, start_no, end_no, sort_order || 0]
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error });
  }
}

export async function DELETE(req: Request) {
  try {
    const { zone_id } = await req.json();
    await pool.query(`DELETE FROM locker_zones WHERE zone_id = ?`, [zone_id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error });
  }
}
