import pool from "@/lib/db";
import { NextRequest } from "next/server";
import { generateMarketingDocx } from "@/lib/marketing/generateMarketingDocx";
import { generateSummaryText, generateNextActionText } from "@/lib/marketing/generateMarketingSummary";
import { generateMarketingReportText } from "@/lib/marketing/generateMarketingReportText";

const agg = (items: any[], key: string) => {
  const groups = new Map<string, any[]>();
  for (const item of items) {
    const k = item[key];
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(item);
  }
  return [...groups.entries()].map(([k, rows]) => {
    const spend = rows.reduce((s: number, r: any) => s + r.spend, 0);
    const impressions = rows.reduce((s: number, r: any) => s + r.impressions, 0);
    const clicks = rows.reduce((s: number, r: any) => s + r.effective_clicks, 0);
    const results = rows.reduce((s: number, r: any) => s + r.results, 0);
    return {
      [key]: k, spend, impressions, clicks, results,
      ctr: impressions > 0 ? (clicks / impressions) * 100 : null,
      cpc: clicks > 0 ? spend / clicks : null,
      cost_per_result: results > 0 ? spend / results : null,
    };
  });
};

const aggBranchChannel = (items: any[]) => {
  const map = new Map<string, any[]>();
  for (const item of items) {
    const k = `${item.branch}__${item.channel}`;
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(item);
  }
  return [...map.entries()].map(([k, rows]) => {
    const [branch, channel] = k.split("__");
    const spend = rows.reduce((s: number, r: any) => s + r.spend, 0);
    const impressions = rows.reduce((s: number, r: any) => s + r.impressions, 0);
    const clicks = rows.reduce((s: number, r: any) => s + r.effective_clicks, 0);
    const results = rows.reduce((s: number, r: any) => s + r.results, 0);
    return {
      branch, channel, spend, impressions, clicks, results,
      ctr: impressions > 0 ? (clicks / impressions) * 100 : null,
      cpc: clicks > 0 ? spend / clicks : null,
      cost_per_result: results > 0 ? spend / results : null,
    };
  });
};

const safeFileName = (s: string) =>
  s.replace(/[\/\\:*?"<>|]/g, "").replace(/\s+/g, "_").slice(0, 100);

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const [[report]]: any = await pool.query(
      "SELECT * FROM marketing_reports WHERE id = ?",
      [id]
    );
    if (!report) {
      return Response.json({ success: false, message: "리포트를 찾을 수 없습니다." }, { status: 404 });
    }

    const [items]: any = await pool.query(
      "SELECT * FROM marketing_report_items WHERE report_id = ? ORDER BY id ASC",
      [id]
    );

    const byChannel = agg(items, "channel");
    const byBranch = agg(items, "branch");
    const byBranchChannel = aggBranchChannel(items);

    const top5 = items
      .filter((r: any) => r.effective_clicks >= 10 && r.cpc > 0)
      .sort((a: any, b: any) => a.cpc - b.cpc || b.ctr - a.ctr)
      .slice(0, 5);

    const warnings = items
      .filter((r: any) => r.judgement === "WARNING")
      .sort((a: any, b: any) => b.spend - a.spend);

    const overall = {
      spend: report.total_spend,
      impressions: report.total_impressions,
      clicks: report.total_clicks,
      results: report.total_results,
      ctr: Number(report.avg_ctr),
      cpc: Number(report.avg_cpc),
      costPerResult: Number(report.avg_cost_per_result),
    };

    const summaryText = report.summary_text || generateSummaryText(
      report.report_month, overall as any, byChannel as any, byBranch as any, warnings.length
    );
    const nextActionText = report.next_action_text || generateNextActionText(
      byChannel as any, byBranch as any, warnings.length
    );

    const buffer = await generateMarketingDocx({
      month: report.report_month,
      title: report.title,
      createdAt: report.created_at,
      overall: overall as any,
      byChannel,
      byBranch,
      byBranchChannel,
      top5,
      warnings,
      summaryText,
      nextActionText,
    });

    const [y, mo] = (report.report_month || "").split("-");
    const monthStr = y && mo ? `${y}년${parseInt(mo)}월` : report.report_month;
    const fileName = safeFileName(`스트롱복싱_${monthStr}_광고성과보고서`) + ".docx";
    const encodedName = encodeURIComponent(fileName);

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${encodedName}"; filename*=UTF-8''${encodedName}`,
        "Content-Length": String(buffer.length),
      },
    });
  } catch (e: any) {
    console.error("[DOCX error]", e);
    return Response.json(
      { success: false, message: "DOCX 보고서 생성 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
