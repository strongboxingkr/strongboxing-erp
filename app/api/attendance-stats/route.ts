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
    const period = searchParams.get("period") || "month"; // today | week | month | 3month

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    let startDate: string;

    if (period === "today") {
      startDate = todayStr;
    } else if (period === "week") {
      const d = new Date(now); d.setDate(d.getDate() - 7);
      startDate = d.toISOString().slice(0, 10);
    } else if (period === "3month") {
      const d = new Date(now); d.setMonth(d.getMonth() - 3);
      startDate = d.toISOString().slice(0, 10);
    } else {
      // 당월: 이번 달 1일부터 오늘까지
      startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    }

    const params: any[] = [startDate];
    let branchFilter = "";
    if (branch_name && branch_name !== "전체") {
      branchFilter = " AND branch_name = ?";
      params.push(branch_name);
    }

    // 멤버별 날짜별 체크인/체크아웃 pair 조회
    // 체크인 없이 체크아웃만 → 1시간 전 입장 가정
    // 체크아웃 없이 체크인만 → 60분 후 퇴장 가정
    const [pairRows]: any = await pool.query(
      `SELECT
         member_id,
         DATE(checkin_time) AS visit_date,
         MAX(CASE WHEN result = 'SUCCESS' THEN checkin_time END) AS checkin_t,
         MAX(CASE WHEN result = 'CHECK_OUT' THEN checkin_time END) AS checkout_t
       FROM attendance
       WHERE result IN ('SUCCESS', 'CHECK_OUT')
         AND DATE(checkin_time) >= ?
         ${branchFilter}
       GROUP BY member_id, DATE(checkin_time)`,
      params
    );

    // 시간대별 카운트 (체류 기반)
    // 실제 데이터가 있는 날짜 수로 평균 계산
    const distinctDays = new Set(pairRows.map((r: any) => String(r.visit_date))).size;
    const totalDays = period === "today" ? 1 : Math.max(distinctDays, 1);

    const hourCounts = Array(24).fill(0);
    const dowCounts = Array(7).fill(0);
    // 히트맵: dowHourCounts[dow][hour]
    const dowHourCounts: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));

    pairRows.forEach((row: any) => {
      let checkin = row.checkin_t ? new Date(row.checkin_t) : null;
      let checkout = row.checkout_t ? new Date(row.checkout_t) : null;
      if (!checkin && !checkout) return;

      // 보정 (최소 10시 이전으로 내려가지 않게 클램프)
      if (!checkin) {
        checkin = new Date(checkout!.getTime() - 60 * 60 * 1000);
        if (checkin.getHours() < 10) checkin.setHours(10, 0, 0, 0);
      }
      if (!checkout) checkout = new Date(checkin!.getTime() + 60 * 60 * 1000);

      // 요일 카운트 (체크인 날짜 기준)
      const dow = checkin.getDay(); // 0=일~6=토
      dowCounts[dow]++;

      // 체류 시간대 카운트
      const startH = checkin.getHours();
      const endH = checkout.getHours();
      if (endH >= startH) {
        for (let h = startH; h <= endH; h++) {
          hourCounts[h]++;
          dowHourCounts[dow][h]++;
        }
      } else {
        for (let h = startH; h < 24; h++) { hourCounts[h]++; dowHourCounts[dow][h]++; }
        for (let h = 0; h <= endH; h++) { hourCounts[h]++; dowHourCounts[dow][h]++; }
      }
    });

    // 시간대 배열 (0~23) + 하루 평균
    const hours = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      cnt: hourCounts[i],
      avg: Math.round((hourCounts[i] / totalDays) * 10) / 10,
    }));

    // 요일 배열
    const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
    const days = dayNames.map((name, i) => ({ dow: i, name, cnt: dowCounts[i] }));

    // 히트맵: 요일×시간대
    const heatmap = dayNames.map((name, dow) => ({
      dow,
      name,
      hours: Array.from({ length: 24 }, (_, h) => ({ hour: h, cnt: dowHourCounts[dow][h] })),
    }));

    // 지점별 시간대 (전체 조회 시, 체류 기반)
    const by_branch = searchParams.get("by_branch");
    let branchHours: any[] = [];
    if (by_branch === "Y") {
      const [bPairRows]: any = await pool.query(
        `SELECT
           COALESCE(branch_name, '미지정') AS branch_name,
           member_id,
           DATE(checkin_time) AS visit_date,
           MAX(CASE WHEN result = 'SUCCESS' THEN checkin_time END) AS checkin_t,
           MAX(CASE WHEN result = 'CHECK_OUT' THEN checkin_time END) AS checkout_t
         FROM attendance
         WHERE result IN ('SUCCESS', 'CHECK_OUT') AND DATE(checkin_time) >= ?
         GROUP BY branch_name, member_id, DATE(checkin_time)`,
        [startDate]
      );
      const branchMap: Record<string, number[]> = {};
      bPairRows.forEach((row: any) => {
        const bn = row.branch_name;
        if (!branchMap[bn]) branchMap[bn] = Array(24).fill(0);
        let checkin = row.checkin_t ? new Date(row.checkin_t) : null;
        let checkout = row.checkout_t ? new Date(row.checkout_t) : null;
        if (!checkin && !checkout) return;
        if (!checkin) {
          checkin = new Date(checkout!.getTime() - 60 * 60 * 1000);
          if (checkin.getHours() < 10) checkin.setHours(10, 0, 0, 0);
        }
        if (!checkout) checkout = new Date(checkin!.getTime() + 60 * 60 * 1000);
        const startH = checkin.getHours();
        const endH = checkout.getHours();
        if (endH >= startH) {
          for (let h = startH; h <= endH; h++) branchMap[bn][h]++;
        } else {
          for (let h = startH; h < 24; h++) branchMap[bn][h]++;
          for (let h = 0; h <= endH; h++) branchMap[bn][h]++;
        }
      });
      branchHours = Object.entries(branchMap).map(([name, counts]) => ({
        branch_name: name,
        hours: counts.map((cnt, hour) => ({ hour, cnt })),
      }));
    }

    return NextResponse.json({ success: true, hours, days, heatmap, period, startDate, totalDays, branchHours });
  } catch (error) {
    return NextResponse.json({ success: false, error });
  }
}
