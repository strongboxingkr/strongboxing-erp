import { NextResponse } from "next/server";
import pool from "@/lib/db";

function addDays(dateString: string, days: number) {
  const date = new Date(dateString);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function diffDays(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const diff = e.getTime() - s.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { member_id, hold_start, hold_end, reason } = body;

    const [rows]: any = await pool.query(
      "SELECT * FROM members WHERE member_id = ?",
      [member_id]
    );

    if (rows.length === 0) {
      return NextResponse.json({
        success: false,
        message: "회원 없음",
      });
    }

    const member = rows[0];

    const hold_days = diffDays(hold_start, hold_end);
    const old_end_date = member.end_date?.toISOString
      ? member.end_date.toISOString().slice(0, 10)
      : String(member.end_date).slice(0, 10);

    const new_end_date = addDays(old_end_date, hold_days);

    await pool.query(
      `
      INSERT INTO member_holds
      (
        member_id,
        hold_start,
        hold_end,
        hold_days,
        reason,
        old_end_date,
        new_end_date
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        member_id,
        hold_start,
        hold_end,
        hold_days,
        reason || "",
        old_end_date,
        new_end_date,
      ]
    );

    await pool.query(
      `
      UPDATE members
      SET 
        end_date = ?,
        status = 'REST',
        memo = CONCAT(IFNULL(memo, ''), '\n[휴회] ', ?, ' ~ ', ?, ' / ', ?, '일 / ', ?)
      WHERE member_id = ?
      `,
      [
        new_end_date,
        hold_start,
        hold_end,
        hold_days,
        reason || "",
        member_id,
      ]
    );

    return NextResponse.json({
      success: true,
      message: "휴회 처리 완료",
      hold_days,
      old_end_date,
      new_end_date,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error,
    });
  }
}