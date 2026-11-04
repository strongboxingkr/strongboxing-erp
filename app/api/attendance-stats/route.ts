import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const user = getUserFromRequest(req);
    if (!["ADMIN", "OWNER"].includes(user.role)) {
      return NextResponse.json({ success: false, message: "권한 없음" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const branch_name = searchParams.get("branch_name");
    const period = searchParams.get("period") || "month"; // week | month | 3month

    const now = new Date();
    let startDate: string;
    if (period === "week") {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      startDate = d.toISOString().slice(0, 10);
    } else if (period === "3month") {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 3);
      startDate = d.toISOString().slice(0, 10);
    } else {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 1);
      startDate = d.toISOString().slice(0, 10);
    }

    const params: any[] = [startDate];
    let branchFilter = "";
    if (branch_name && branch_name !== "전체") {
      branchFilter = " AND branch_name = ?";
      params.push(branch_name);
    }

    // 시간대별 입장 수
    const [hourRows]: any = await pool.query(
      `SELECT HOUR(checkin_time) AS hour, COUNT(*) AS cnt
       FROM attendance
       WHERE result = 'SUCCESS'
         AND DATE(checkin_time) >= ?
         ${branchFilter}
       GROUP BY HOUR(checkin_time)
       ORDER BY hour`,
      params
    );

    // 요일별 입장 수 (0=일, 1=월 ... 6=토)
    const [dayRows]: any = await pool.query(
      `SELECT DAYOFWEEK(checkin_time) - 1 AS dow, COUNT(*) AS cnt
       FROM attendance
       WHERE result = 'SUCCESS'
         AND DATE(checkin_time) >= ?
         ${branchFilter}
       GROUP BY DAYOFWEEK(checkin_time)
       ORDER BY dow`,
      params
    );

    // 시간대 배열 (0~23)
    const hours = Array.from({ length: 24 }, (_, i) => ({ hour: i, cnt: 0 }));
    hourRows.forEach((r: any) => { hours[r.hour].cnt = Number(r.cnt); });

    // 요일 배열
    const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
    const days = dayNames.map((name, i) => ({ dow: i, name, cnt: 0 }));
    dayRows.forEach((r: any) => { days[r.dow].cnt = Number(r.cnt); });

    // 지점별 시간대 (전체 조회 시)
    const by_branch = searchParams.get("by_branch");
    let branchHours: any[] = [];
    if (by_branch === "Y") {
      const [bRows]: any = await pool.query(
        `SELECT COALESCE(branch_name, '미지정') AS branch_name, HOUR(checkin_time) AS hour, COUNT(*) AS cnt
         FROM attendance
         WHERE result = 'SUCCESS' AND DATE(checkin_time) >= ?
         GROUP BY branch_name, HOUR(checkin_time)
         ORDER BY branch_name, hour`,
        [startDate]
      );
      const branchMap: Record<string, number[]> = {};
      bRows.forEach((r: any) => {
        if (!branchMap[r.branch_name]) branchMap[r.branch_name] = Array(24).fill(0);
        branchMap[r.branch_name][r.hour] = Number(r.cnt);
      });
      branchHours = Object.entries(branchMap).map(([name, counts]) => ({
        branch_name: name,
        hours: counts.map((cnt, hour) => ({ hour, cnt })),
      }));
    }

    return NextResponse.json({ success: true, hours, days, period, startDate, branchHours });
  } catch (error) {
    return NextResponse.json({ success: false, error });
  }
}
