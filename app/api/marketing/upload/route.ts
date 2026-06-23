import { NextResponse } from "next/server";
import pool from "@/lib/db";
import * as XLSX from "xlsx";

const SOURCE_MAP: Record<string, string> = {
  "네이버 검색광고": "NAVER_AD",
  "NAVER_AD": "NAVER_AD",
  "네이버 플레이스": "NAVER_PLACE",
  "NAVER_PLACE": "NAVER_PLACE",
  "네이버 예약": "NAVER_RESERVATION",
  "NAVER_RESERVATION": "NAVER_RESERVATION",
  "홈페이지": "WEBSITE",
  "WEBSITE": "WEBSITE",
  "인스타그램 광고": "INSTAGRAM_AD",
  "INSTAGRAM_AD": "INSTAGRAM_AD",
  "페이스북 광고": "FACEBOOK_AD",
  "FACEBOOK_AD": "FACEBOOK_AD",
  "당근 광고": "DANGGEUN",
  "DANGGEUN": "DANGGEUN",
  "카카오맵": "KAKAOMAP",
  "KAKAOMAP": "KAKAOMAP",
  "지인소개": "REFERRAL",
  "REFERRAL": "REFERRAL",
  "지나가다 방문": "WALK_IN",
  "WALK_IN": "WALK_IN",
  "기타": "OTHER",
  "OTHER": "OTHER",
};

function toNum(v: any) {
  const n = Number(String(v).replace(/,/g, ""));
  return isNaN(n) ? 0 : n;
}

function toDate(v: any): string | null {
  if (!v) return null;
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    const mm = String(d.m).padStart(2, "0");
    const dd = String(d.d).padStart(2, "0");
    return `${d.y}-${mm}-${dd}`;
  }
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(s)) return s.replace(/\//g, "-");
  return null;
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ success: false, message: "파일이 없습니다." });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buffer, { type: "buffer", cellDates: false });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const json: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

    if (json.length === 0) {
      return NextResponse.json({ success: false, message: "데이터가 없습니다." });
    }

    let inserted = 0;
    let skipped = 0;

    for (const row of json) {
      const report_date = toDate(row["날짜"] ?? row["date"] ?? row["Date"]);
      const branch_name = String(row["지점"] ?? row["branch"] ?? "").trim();
      const sourceRaw = String(row["유입경로"] ?? row["lead_source"] ?? "").trim();
      const lead_source = SOURCE_MAP[sourceRaw] || "OTHER";

      if (!report_date || !branch_name) {
        skipped++;
        continue;
      }

      const ad_cost = toNum(row["광고비"] ?? row["ad_cost"] ?? 0);
      const impressions = toNum(row["노출수"] ?? row["impressions"] ?? 0);
      const clicks = toNum(row["클릭수"] ?? row["clicks"] ?? 0);
      const inquiries = toNum(row["문의수"] ?? row["inquiries"] ?? 0);
      const reservations = toNum(row["예약수"] ?? row["reservations"] ?? 0);
      const registrations = toNum(row["등록수"] ?? row["registrations"] ?? 0);
      const revenue = toNum(row["매출"] ?? row["revenue"] ?? 0);

      await pool.query(
        `INSERT INTO marketing_reports
          (branch_name, report_date, lead_source, ad_cost, impressions, clicks, inquiries, reservations, registrations, revenue)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
          ad_cost = VALUES(ad_cost),
          impressions = VALUES(impressions),
          clicks = VALUES(clicks),
          inquiries = VALUES(inquiries),
          reservations = VALUES(reservations),
          registrations = VALUES(registrations),
          revenue = VALUES(revenue)`,
        [branch_name, report_date, lead_source, ad_cost, impressions, clicks, inquiries, reservations, registrations, revenue]
      );

      inserted++;
    }

    return NextResponse.json({ success: true, inserted, skipped });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, message: "업로드 실패", error });
  }
}
