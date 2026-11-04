import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET() {
  try {
    const now = new Date();
    const thisYear = now.getFullYear();
    const thisMonth = now.getMonth() + 1;

    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevYear = prevDate.getFullYear();
    const prevMonth = prevDate.getMonth() + 1;

    const thisStart = `${thisYear}-${String(thisMonth).padStart(2, "0")}-01`;
    const thisEnd = `${thisYear}-${String(thisMonth).padStart(2, "0")}-31`;
    const prevStart = `${prevYear}-${String(prevMonth).padStart(2, "0")}-01`;
    const prevEnd = `${prevYear}-${String(prevMonth).padStart(2, "0")}-31`;

    const [thisRows]: any = await pool.query(
      `SELECT branch_name, COUNT(*) AS cnt
       FROM calendar_events
       WHERE DATE(start_datetime) BETWEEN ? AND ?
         AND status NOT IN ('취소', '예약취소')
       GROUP BY branch_name`,
      [thisStart, thisEnd]
    );

    const [prevRows]: any = await pool.query(
      `SELECT branch_name, COUNT(*) AS cnt
       FROM calendar_events
       WHERE DATE(start_datetime) BETWEEN ? AND ?
         AND status NOT IN ('취소', '예약취소')
       GROUP BY branch_name`,
      [prevStart, prevEnd]
    );

    const branches = ["철산점", "목동점", "개봉점", "신정점"];
    const thisMap: Record<string, number> = {};
    const prevMap: Record<string, number> = {};
    thisRows.forEach((r: any) => { thisMap[r.branch_name] = Number(r.cnt); });
    prevRows.forEach((r: any) => { prevMap[r.branch_name] = Number(r.cnt); });

    const result = branches.map((b) => ({
      branch_name: b,
      this_month: thisMap[b] || 0,
      prev_month: prevMap[b] || 0,
    }));

    return NextResponse.json({
      success: true,
      this_month: `${thisYear}.${thisMonth}월`,
      prev_month: `${prevYear}.${prevMonth}월`,
      rows: result,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error });
  }
}
