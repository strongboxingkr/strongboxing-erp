import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest, isAdminOrOwner } from "@/lib/auth";
import * as XLSX from "xlsx";

function safe(n: number, d: number) {
  return d === 0 ? 0 : Math.round((n / d) * 100) / 100;
}

export async function GET(req: Request) {
  try {
    const user = getUserFromRequest(req);
    const { searchParams } = new URL(req.url);

    const branch_name = searchParams.get("branch_name");
    const start_date = searchParams.get("start_date");
    const end_date = searchParams.get("end_date");

    let sql = `SELECT * FROM marketing_reports WHERE 1=1`;
    const params: any[] = [];

    if (isAdminOrOwner(user.role)) {
      if (branch_name && branch_name !== "전체") {
        sql += ` AND branch_name = ?`;
        params.push(branch_name);
      }
    } else {
      sql += ` AND branch_name = ?`;
      params.push(user.branch_name);
    }

    if (start_date) { sql += ` AND report_date >= ?`; params.push(start_date); }
    if (end_date) { sql += ` AND report_date <= ?`; params.push(end_date); }

    sql += ` ORDER BY report_date DESC`;

    const [rows]: any = await pool.query(sql, params);

    const headers = [
      "날짜", "지점", "유입경로", "광고비", "노출수", "클릭수",
      "문의수", "예약수", "등록수", "매출",
      "CTR(%)", "CPC(원)", "CPL(원)", "CAC(원)", "전환율(%)", "ROAS",
    ];

    const data = rows.map((r: any) => [
      r.report_date?.slice(0, 10),
      r.branch_name,
      r.lead_source,
      r.ad_cost,
      r.impressions,
      r.clicks,
      r.inquiries,
      r.reservations,
      r.registrations,
      r.revenue,
      safe(r.clicks, r.impressions) * 100,
      safe(r.ad_cost, r.clicks),
      safe(r.ad_cost, r.inquiries),
      safe(r.ad_cost, r.registrations),
      safe(r.registrations, r.inquiries) * 100,
      safe(r.revenue, r.ad_cost),
    ]);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    ws["!cols"] = headers.map(() => ({ wch: 16 }));
    XLSX.utils.book_append_sheet(wb, ws, "마케팅데이터");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename*=UTF-8''%EB%A7%88%EC%BC%80%ED%8C%85_%EB%B6%84%EC%84%9D.xlsx`,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, message: "다운로드 실패" });
  }
}
