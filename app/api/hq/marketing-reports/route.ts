import pool from "@/lib/db";
import { NextRequest } from "next/server";

const ok = (data: unknown) => Response.json({ success: true, data });
const err = (msg: string, status = 500) => Response.json({ success: false, message: msg }, { status });

const n = (v: unknown): number => {
  const num = Number(v);
  return isNaN(num) ? 0 : num;
};

const judgeRow = (item: {
  impressions: number; spend: number; effective_clicks: number; ctr: number | null; cpc: number | null;
}): string => {
  if (item.impressions < 500 || item.spend < 5000) return "LOW_DATA";
  const warn =
    (item.spend >= 30000 && item.effective_clicks < 10) ||
    (item.cpc !== null && item.cpc >= 700) ||
    (item.ctr !== null && item.ctr < 0.7);
  if (warn) return "WARNING";
  const good =
    (item.effective_clicks >= 20 && item.cpc !== null && item.cpc <= 300) ||
    (item.ctr !== null && item.ctr >= 1.2 && item.effective_clicks >= 10);
  if (good) return "GOOD";
  return "NORMAL";
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month");
    const branch = searchParams.get("branch");
    const channel = searchParams.get("channel");

    let sql = `SELECT id, report_month, title, total_spend, total_impressions, total_clicks,
                      total_results, avg_ctr, avg_cpc, avg_cost_per_result, created_at
               FROM marketing_reports WHERE 1=1`;
    const params: unknown[] = [];

    if (month) { sql += " AND report_month = ?"; params.push(month); }
    if (branch) { sql += " AND id IN (SELECT DISTINCT report_id FROM marketing_report_items WHERE branch = ?)"; params.push(branch); }
    if (channel) { sql += " AND id IN (SELECT DISTINCT report_id FROM marketing_report_items WHERE channel = ?)"; params.push(channel); }

    sql += " ORDER BY created_at DESC LIMIT 20";

    const [rows]: any = await pool.query(sql, params);
    return ok(rows);
  } catch (e: any) {
    return err(e?.message ?? "DB error");
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { report_month, title, summary_text, next_action_text, totals, items } = body;

    if (!report_month) return err("report_month is required", 400);
    if (!items || !Array.isArray(items) || items.length === 0) return err("items is required", 400);

    const [rr]: any = await pool.query(
      `INSERT INTO marketing_reports
        (report_month, title, total_spend, total_impressions, total_clicks, total_results,
         avg_ctr, avg_cpc, avg_cost_per_result, summary_text, next_action_text)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        report_month,
        (title || `${report_month.replace("-", "년 ").replace(/^(\d+년 )0?(\d+)$/, "$1$2")}월 광고성과 분석`).slice(0, 100),
        n(totals?.spend),
        n(totals?.impressions),
        n(totals?.clicks),
        n(totals?.results),
        n(totals?.ctr),
        n(totals?.cpc),
        n(totals?.costPerResult),
        summary_text || null,
        next_action_text || null,
      ]
    );
    const reportId = rr.insertId;

    const itemValues = items.map((item: any) => {
      const effClicks = n(item.effective_clicks) || n(item.link_clicks) || n(item.clicks);
      const impressions = n(item.impressions);
      const spend = n(item.spend);
      const ctr = n(item.ctr) || (impressions > 0 ? (effClicks / impressions) * 100 : 0);
      const cpc = n(item.cpc) || (effClicks > 0 ? spend / effClicks : 0);
      const costPerResult = n(item.cost_per_result) || (n(item.results) > 0 ? spend / n(item.results) : 0);
      const judgement = item.judgement || judgeRow({ impressions, spend, effective_clicks: effClicks, ctr, cpc });

      return [
        reportId,
        report_month,
        (item.branch || "UNKNOWN").slice(0, 30),
        (item.channel || "NAVER").slice(0, 30),
        (item.campaign_name || "").slice(0, 255),
        (item.adset_name || "").slice(0, 255),
        (item.ad_name || "").slice(0, 255),
        (item.creative_name || "").slice(0, 255),
        (item.status || "").slice(0, 100),
        impressions,
        n(item.reach),
        n(item.clicks),
        n(item.link_clicks),
        effClicks,
        n(item.results),
        spend,
        ctr,
        cpc,
        costPerResult,
        judgement.slice(0, 30),
        (item.source_file_name || "").slice(0, 255),
        (item.start_date || "").slice(0, 30),
        (item.end_date || "").slice(0, 30),
      ];
    });

    await pool.query(
      `INSERT INTO marketing_report_items
        (report_id, report_month, branch, channel, campaign_name, adset_name, ad_name, creative_name,
         status, impressions, reach_count, clicks, link_clicks, effective_clicks, results, spend,
         ctr, cpc, cost_per_result, judgement, source_file_name, start_date, end_date)
       VALUES ?`,
      [itemValues]
    );

    return ok({ id: reportId });
  } catch (e: any) {
    return err(e?.message ?? "DB error");
  }
}
