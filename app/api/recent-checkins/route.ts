import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET() {
  const [rows]: any = await pool.query(`
    SELECT 
      a.attendance_id,
      a.checkin_time,
      a.result,
      m.name,
      m.phone,
      m.branch_name,
      m.product_name,
      m.remaining_count,
      m.end_date,
      m.status
    FROM attendance a
    JOIN members m ON a.member_id = m.member_id
    ORDER BY a.attendance_id DESC
    LIMIT 10
  `);

  return NextResponse.json({
    success: true,
    rows,
  });
}