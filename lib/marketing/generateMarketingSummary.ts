import type { MarketingAggregate, NormalizedMarketingRow } from "./types";
import { BRANCH_LABELS, CHANNEL_LABELS } from "./types";

const fmt = (n: number | null, suffix = "") => (n === null ? "-" : `${Math.round(n).toLocaleString()}${suffix}`);
const fmtCtr = (n: number | null) => (n === null ? "-" : `${n.toFixed(2)}%`);

export const generateSummaryText = (
  month: string,
  overall: MarketingAggregate,
  byChannel: MarketingAggregate[],
  byBranch: MarketingAggregate[],
  warningCount: number
): string => {
  const sorted = [...byChannel].sort((a, b) => (a.cpc ?? Infinity) - (b.cpc ?? Infinity));
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  const bestBranch = [...byBranch].sort((a, b) => (a.cpc ?? Infinity) - (b.cpc ?? Infinity))[0];

  const [year, mon] = month.split("-");
  let text = `${year}년 ${parseInt(mon)}월 광고 성과 요약. `;

  if (best) text += `${CHANNEL_LABELS[best.channel as keyof typeof CHANNEL_LABELS] ?? ""} 채널의 클릭 효율이 가장 좋았고, `;
  if (worst && worst !== best) text += `${CHANNEL_LABELS[worst.channel as keyof typeof CHANNEL_LABELS] ?? ""} 채널은 효율 개선 여지가 있습니다. `;
  if (bestBranch) text += `${BRANCH_LABELS[bestBranch.branch as keyof typeof BRANCH_LABELS] ?? ""}점의 광고 효율이 양호했습니다. `;
  if (warningCount > 0) text += `주의 판정 광고 ${warningCount}건은 소재 교체 또는 예산 조정을 검토하세요. `;
  text += `전체 지출 ${fmt(overall.spend, "원")}, 총 클릭 ${fmt(overall.clicks, "회")}, 평균 CPC ${fmt(overall.cpc, "원")}.`;

  return text;
};

export const generateNextActionText = (
  byChannel: MarketingAggregate[],
  byBranch: MarketingAggregate[],
  warningCount: number
): string => {
  const sorted = [...byChannel].sort((a, b) => (a.cpc ?? Infinity) - (b.cpc ?? Infinity));
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];

  const lines: string[] = ["📋 다음 달 액션 제안\n"];

  if (best) {
    const label = CHANNEL_LABELS[best.channel as keyof typeof CHANNEL_LABELS] ?? best.channel;
    lines.push(`✅ ${label}: 효율 우수 채널 → 예산 유지 또는 소폭 증액 추천`);
  }
  if (worst && worst !== best) {
    const label = CHANNEL_LABELS[worst.channel as keyof typeof CHANNEL_LABELS] ?? worst.channel;
    lines.push(`⚠️ ${label}: CPC 가장 높음 → 소재 개선 또는 예산 축소 추천`);
  }
  if (warningCount > 0) {
    lines.push(`🔴 주의 광고 ${warningCount}건: 예산 축소 또는 소재 교체 추천`);
  }

  for (const b of byBranch) {
    const branchLabel = BRANCH_LABELS[b.branch as keyof typeof BRANCH_LABELS] ?? b.branch;
    if (best) {
      const chLabel = CHANNEL_LABELS[best.channel as keyof typeof CHANNEL_LABELS] ?? best.channel;
      lines.push(`📍 ${branchLabel}: ${chLabel} 광고 중심 운영 추천`);
    }
  }

  return lines.join("\n");
};

export const generateFullSummaryText = (
  month: string,
  overall: MarketingAggregate,
  byChannel: MarketingAggregate[],
  byBranch: MarketingAggregate[]
): string => {
  const [year, mon] = month.split("-");
  const lines = [`📊 ${year}년 ${parseInt(mon)}월 광고 성과 요약\n`];

  lines.push(
    `[전체]\n지출: ${fmt(overall.spend, "원")} | 노출: ${fmt(overall.impressions)} | 클릭: ${fmt(overall.clicks)} | CTR: ${fmtCtr(overall.ctr)} | CPC: ${fmt(overall.cpc, "원")} | 결과: ${fmt(overall.results)} | 결과당 비용: ${fmt(overall.costPerResult, "원")}\n`
  );

  lines.push("[채널별]");
  for (const c of byChannel) {
    const label = CHANNEL_LABELS[c.channel as keyof typeof CHANNEL_LABELS] ?? c.channel;
    lines.push(`${label}: 지출 ${fmt(c.spend, "원")} | 클릭 ${fmt(c.clicks)} | CTR ${fmtCtr(c.ctr)} | CPC ${fmt(c.cpc, "원")}`);
  }

  lines.push("\n[지점별]");
  for (const b of byBranch) {
    const label = BRANCH_LABELS[b.branch as keyof typeof BRANCH_LABELS] ?? b.branch;
    lines.push(`${label}: 지출 ${fmt(b.spend, "원")} | 클릭 ${fmt(b.clicks)} | CTR ${fmtCtr(b.ctr)} | CPC ${fmt(b.cpc, "원")}`);
  }

  return lines.join("\n");
};
