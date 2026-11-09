import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const user = await getUserFromRequest(req);

    if (!user) return NextResponse.json({ success: false, message: "로그인이 필요합니다." }, { status: 401 });

    if (user.role !== "OWNER") {
      return NextResponse.json({ success: false, message: "권한 없음" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const branch_name = searchParams.get("branch_name");
    const customStart = searchParams.get("start");
    const customEnd = searchParams.get("end");

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");

    let thisStart: string, thisEnd: string, prevStart: string, prevEnd: string;
    let thisYear: number, thisMonth: number, prevYear: number, prevMonth: number;

    if (customStart && customEnd) {
      // 사용자 지정 기간 → 비교 기간은 같은 길이만큼 이전
      thisStart = customStart;
      thisEnd = customEnd;
      const ms = new Date(customEnd).getTime() - new Date(customStart).getTime();
      const prevEndDate = new Date(new Date(customStart).getTime() - 86400000);
      const prevStartDate = new Date(prevEndDate.getTime() - ms);
      prevStart = prevStartDate.toISOString().slice(0, 10);
      prevEnd = prevEndDate.toISOString().slice(0, 10);
      thisYear = new Date(thisStart).getFullYear();
      thisMonth = new Date(thisStart).getMonth() + 1;
      prevYear = new Date(prevStart).getFullYear();
      prevMonth = new Date(prevStart).getMonth() + 1;
    } else {
      thisYear = now.getFullYear();
      thisMonth = now.getMonth() + 1;
      const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      prevYear = prevDate.getFullYear();
      prevMonth = prevDate.getMonth() + 1;
      thisStart = `${thisYear}-${pad(thisMonth)}-01`;
      thisEnd = `${thisYear}-${pad(thisMonth)}-31`;
      prevStart = `${prevYear}-${pad(prevMonth)}-01`;
      prevEnd = `${prevYear}-${pad(prevMonth)}-31`;
    }

    let branchFilter = "";
    const params1: any[] = [thisStart, thisEnd];
    const params2: any[] = [prevStart, prevEnd];
    if (branch_name && branch_name !== "전체") {
      branchFilter = " AND branch_name = ?";
      params1.push(branch_name);
      params2.push(branch_name);
    }

    const [thisRows]: any = await pool.query(
      `SELECT DAY(payment_date) AS day, SUM(final_amount) AS total, COUNT(*) AS cnt
       FROM payments
       WHERE payment_date BETWEEN ? AND ?${branchFilter}
       GROUP BY DAY(payment_date)
       ORDER BY day`,
      params1
    );

    const [prevRows]: any = await pool.query(
      `SELECT DAY(payment_date) AS day, SUM(final_amount) AS total, COUNT(*) AS cnt
       FROM payments
       WHERE payment_date BETWEEN ? AND ?${branchFilter}
       GROUP BY DAY(payment_date)
       ORDER BY day`,
      params2
    );

    // 최대 31일 배열로 변환
    const thisMap: Record<number, number> = {};
    const prevMap: Record<number, number> = {};
    thisRows.forEach((r: any) => { thisMap[Number(r.day)] = Number(r.total); });
    prevRows.forEach((r: any) => { prevMap[Number(r.day)] = Number(r.total); });

    const todayDay = now.getDate();
    const daysInPrev = new Date(prevYear, prevMonth, 0).getDate();
    const daysInThis = new Date(thisYear, thisMonth, 0).getDate();

    const days = Array.from({ length: Math.max(daysInThis, daysInPrev) }, (_, i) => ({
      day: i + 1,
      this: thisMap[i + 1] || 0,
      prev: prevMap[i + 1] || 0,
    }));

    const thisTotal = Object.values(thisMap).reduce((a, b) => a + b, 0);
    const prevTotal = Object.values(prevMap).reduce((a, b) => a + b, 0);
    // 저번달 같은 날짜까지 누적 (공정 비교)
    const prevSameDay = Array.from({ length: todayDay }, (_, i) => prevMap[i + 1] || 0)
      .reduce((a, b) => a + b, 0);

    return NextResponse.json({
      success: true,
      thisMonth: `${thisYear}.${thisMonth}월`,
      prevMonth: `${prevYear}.${prevMonth}월`,
      todayDay,
      thisTotal,
      prevTotal,
      prevSameDay,
      days,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error });
  }
}
