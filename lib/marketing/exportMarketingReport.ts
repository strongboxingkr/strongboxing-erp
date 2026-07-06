import { BRANCH_LABELS, CHANNEL_LABELS, CODE_TO_JUDGEMENT, type JudgementCode } from "./types";

/* ─── 파일명 유틸 ─── */
const safeFileName = (s: string) =>
  s.replace(/[\/\\:*?"<>|]/g, "").replace(/\s+/g, "_").slice(0, 100);

export const generateReportTxtFileName = (title: string, month: string): string => {
  const [y, m] = (month || "").split("-");
  const monthStr = y && m ? `${y}년${parseInt(m)}월` : month;
  return safeFileName(`스트롱복싱_${monthStr}_광고성과보고서`) + ".txt";
};

export const generateDetailCsvFileName = (month: string): string => {
  const [y, m] = (month || "").split("-");
  const monthStr = y && m ? `${y}년${parseInt(m)}월` : month;
  return safeFileName(`스트롱복싱_${monthStr}_광고상세데이터`) + ".csv";
};

export const generateSummaryCsvFileName = (month: string): string => {
  const [y, m] = (month || "").split("-");
  const monthStr = y && m ? `${y}년${parseInt(m)}월` : month;
  return safeFileName(`스트롱복싱_${monthStr}_광고요약`) + ".csv";
};

/* ─── CSV 셀 이스케이프 ─── */
const csvCell = (v: string | number | null | undefined): string => {
  if (v == null) return "";
  const s = String(v);
  if (s.includes(",") || s.includes("\n") || s.includes('"')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
};

const csvRow = (cells: (string | number | null | undefined)[]) =>
  cells.map(csvCell).join(",");

/* UTF-8 BOM: 한글 엑셀 호환 */
const BOM = "﻿";

const n = (v: unknown): number => {
  const num = Number(v);
  return isNaN(num) ? 0 : num;
};

const fCtr = (v: unknown) => n(v).toFixed(2);

/* ─── 상세 CSV ─── */
export const convertItemsToCsv = (items: any[]): string => {
  const header = [
    "지점","채널","캠페인명","광고세트명","광고명","소재명","상태",
    "노출","도달","클릭","링크클릭","유효클릭","결과","지출",
    "CTR","CPC","결과당비용","판단","원본파일명","시작일","종료일",
  ];

  const dataRows = items.map((r) => {
    const branchLabel = BRANCH_LABELS[r.branch as keyof typeof BRANCH_LABELS] ?? r.branch ?? "";
    const channelLabel = CHANNEL_LABELS[r.channel as keyof typeof CHANNEL_LABELS] ?? r.channel ?? "";
    const judgeLabel = CODE_TO_JUDGEMENT[r.judgement as JudgementCode] ?? (r.judgement ?? "");

    return csvRow([
      branchLabel,
      channelLabel,
      r.campaign_name ?? r.campaignName ?? "",
      r.adset_name ?? r.adsetName ?? "",
      r.ad_name ?? r.adName ?? "",
      r.creative_name ?? r.creativeName ?? "",
      r.status ?? "",
      n(r.impressions),
      n(r.reach_count ?? r.reach),
      n(r.clicks),
      n(r.link_clicks ?? r.linkClicks),
      n(r.effective_clicks ?? r.effectiveClicks),
      n(r.results),
      n(r.spend),
      fCtr(r.ctr),
      n(r.cpc),
      n(r.cost_per_result ?? r.costPerResult),
      judgeLabel,
      r.source_file_name ?? r.sourceFileName ?? "",
      r.start_date ?? r.startDate ?? "",
      r.end_date ?? r.endDate ?? "",
    ]);
  });

  return BOM + [csvRow(header), ...dataRows].join("\n");
};

/* ─── 요약 CSV ─── */
export const convertSummaryToCsv = (
  overall: { spend: number; impressions: number; clicks: number; results: number; ctr: number | null; cpc: number | null; cost_per_result?: number | null; costPerResult?: number | null; avg_cpc?: number | null; avg_ctr?: number | null; avg_cost_per_result?: number | null; total_spend?: number; total_impressions?: number; total_clicks?: number; total_results?: number },
  byChannel: any[],
  byBranch: any[]
): string => {
  const aggHeader = ["지출","노출","클릭","CTR","CPC","결과","결과당비용"];

  const overallSpend = overall.spend ?? overall.total_spend ?? 0;
  const overallImpressions = overall.impressions ?? overall.total_impressions ?? 0;
  const overallClicks = overall.clicks ?? overall.total_clicks ?? 0;
  const overallResults = overall.results ?? overall.total_results ?? 0;
  const overallCtr = overall.ctr ?? overall.avg_ctr ?? null;
  const overallCpc = overall.cpc ?? overall.avg_cpc ?? null;
  const overallCpr = overall.costPerResult ?? overall.cost_per_result ?? overall.avg_cost_per_result ?? null;

  const aggRow = (row: any) => {
    const cpr = row.cost_per_result ?? row.costPerResult ?? null;
    return csvRow([
      n(row.spend), n(row.impressions), n(row.clicks),
      fCtr(row.ctr), n(row.cpc), n(row.results), n(cpr),
    ]);
  };

  const lines: string[] = [];

  lines.push("[전체 요약]");
  lines.push(csvRow(["구분", ...aggHeader]));
  lines.push(csvRow([
    "전체",
    n(overallSpend), n(overallImpressions), n(overallClicks),
    fCtr(overallCtr), n(overallCpc), n(overallResults), n(overallCpr),
  ]));
  lines.push("");

  lines.push("[채널별 요약]");
  lines.push(csvRow(["채널", ...aggHeader]));
  for (const c of byChannel) {
    const label = CHANNEL_LABELS[c.channel as keyof typeof CHANNEL_LABELS] ?? c.channel ?? "";
    lines.push(`${csvCell(label)},${aggRow(c)}`);
  }
  lines.push("");

  lines.push("[지점별 요약]");
  lines.push(csvRow(["지점", ...aggHeader]));
  for (const b of byBranch) {
    const label = BRANCH_LABELS[b.branch as keyof typeof BRANCH_LABELS] ?? b.branch ?? "";
    lines.push(`${csvCell(label)},${aggRow(b)}`);
  }

  return BOM + lines.join("\n");
};

/* ─── 다운로드 트리거 ─── */
export const downloadTextFile = (filename: string, content: string): void => {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  triggerDownload(blob, filename);
};

export const downloadCsvFile = (filename: string, content: string): void => {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  triggerDownload(blob, filename);
};

const triggerDownload = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
