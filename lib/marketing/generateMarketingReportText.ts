import { BRANCH_LABELS, CHANNEL_LABELS, CODE_TO_JUDGEMENT, type JudgementCode } from "./types";

const f = (n: number | null | undefined) =>
  n == null || isNaN(n) ? "-" : Math.round(n).toLocaleString("ko-KR");
const fWon = (n: number | null | undefined) => (n == null || isNaN(n) ? "-" : `${Math.round(n).toLocaleString("ko-KR")}원`);
const fCtr = (n: number | null | undefined) => (n == null || isNaN(n) ? "-" : `${Number(n).toFixed(2)}%`);
const branchLabel = (b: string) => BRANCH_LABELS[b as keyof typeof BRANCH_LABELS] ?? b;
const channelLabel = (c: string) => CHANNEL_LABELS[c as keyof typeof CHANNEL_LABELS] ?? c;
const adLabel = (item: any) =>
  item.ad_name || item.adName || item.adset_name || item.adsetName ||
  item.campaign_name || item.campaignName || "이름 없는 광고";

const judgeReason = (code: JudgementCode | string): string => {
  if (code === "WARNING") return "CPC 높음 또는 클릭 저조";
  if (code === "LOW_DATA") return "데이터 부족";
  return "";
};

export interface ReportTextInput {
  month: string;
  title: string;
  overall: {
    spend: number; impressions: number; clicks: number; results: number;
    ctr: number | null; cpc: number | null; costPerResult?: number | null;
    avg_ctr?: number | null; avg_cpc?: number | null; avg_cost_per_result?: number | null;
    total_spend?: number; total_impressions?: number; total_clicks?: number; total_results?: number;
  };
  byChannel: { channel: string; spend: number; impressions: number; clicks: number; results: number; ctr: number | null; cpc: number | null; cost_per_result?: number | null; costPerResult?: number | null }[];
  byBranch: { branch: string; spend: number; impressions: number; clicks: number; results: number; ctr: number | null; cpc: number | null; cost_per_result?: number | null; costPerResult?: number | null }[];
  byBranchChannel?: { branch: string; channel: string; cpc: number | null }[];
  top5: any[];
  warnings: any[];
}

export const generateMarketingReportText = (input: ReportTextInput): string => {
  const { month, title, overall, byChannel, byBranch, top5, warnings } = input;
  const [y, m] = (month || "").split("-");
  const monthLabel = y && m ? `${y}년 ${parseInt(m)}월` : month;

  const spend = overall.spend ?? overall.total_spend ?? 0;
  const impressions = overall.impressions ?? overall.total_impressions ?? 0;
  const clicks = overall.clicks ?? overall.total_clicks ?? 0;
  const results = overall.results ?? overall.total_results ?? 0;
  const ctr = overall.ctr ?? overall.avg_ctr ?? null;
  const cpc = overall.cpc ?? overall.avg_cpc ?? null;
  const cpr = overall.costPerResult ?? overall.avg_cost_per_result ?? null;

  const lines: string[] = [];

  /* ── 제목 ── */
  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`  ${title || `${monthLabel} 광고성과 분석`}`);
  lines.push(`  분석 기간: ${monthLabel}`);
  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  lines.push("");

  /* ── 1. 전체 요약 ── */
  lines.push("1. 전체 요약");
  lines.push("─────────────────────────────");
  lines.push(
    `${monthLabel} 광고 성과를 살펴보면, 총 광고비는 ${fWon(spend)}, ` +
    `총 노출 ${f(impressions)}회, 총 클릭 ${f(clicks)}회가 발생했습니다.`
  );
  if (cpc !== null) lines.push(`평균 클릭당 비용(CPC)은 ${fWon(cpc)}이며, 클릭률(CTR)은 ${fCtr(ctr)}입니다.`);
  if (results > 0) lines.push(`총 결과는 ${f(results)}건, 결과당 비용은 ${fWon(cpr)}입니다.`);
  lines.push("");

  /* ── 2. 채널별 ── */
  if (byChannel.length > 0) {
    lines.push("2. 채널별 성과");
    lines.push("─────────────────────────────");

    const sorted = [...byChannel].sort((a, b) => (a.cpc ?? Infinity) - (b.cpc ?? Infinity));
    const bestCh = sorted[0];
    const worstCh = sorted[sorted.length - 1];

    for (const c of byChannel) {
      const label = channelLabel(c.channel);
      const cprVal = c.cost_per_result ?? c.costPerResult ?? null;
      lines.push(
        `▪ ${label}: 지출 ${fWon(c.spend)} / 클릭 ${f(c.clicks)}회 / CTR ${fCtr(c.ctr)} / CPC ${fWon(c.cpc)}` +
        (c.results > 0 ? ` / 결과당 비용 ${fWon(cprVal)}` : "")
      );
    }
    lines.push("");

    if (bestCh) {
      lines.push(`→ ${channelLabel(bestCh.channel)}의 클릭 효율이 가장 안정적이었습니다. 현재 예산 기조를 유지하는 것이 적절합니다.`);
    }
    if (worstCh && worstCh !== bestCh) {
      lines.push(`→ ${channelLabel(worstCh.channel)}은 CPC가 ${fWon(worstCh.cpc)}으로 상대적으로 높은 편이므로 소재 점검이 필요합니다.`);
    }
    lines.push("");
  }

  /* ── 3. 지점별 ── */
  if (byBranch.length > 0) {
    lines.push("3. 지점별 성과");
    lines.push("─────────────────────────────");

    const sortedBranch = [...byBranch].sort((a, b) => (a.cpc ?? Infinity) - (b.cpc ?? Infinity));
    const bestBranch = sortedBranch[0];

    for (const b of byBranch) {
      const label = branchLabel(b.branch);
      lines.push(
        `▪ ${label}점: 지출 ${fWon(b.spend)} / 클릭 ${f(b.clicks)}회 / CTR ${fCtr(b.ctr)} / CPC ${fWon(b.cpc)}`
      );
    }
    lines.push("");

    if (bestBranch) {
      lines.push(`→ ${branchLabel(bestBranch.branch)}점의 광고 효율이 가장 양호했습니다.`);
    }
    lines.push("");
  }

  /* ── 4. 효율 좋은 광고 ── */
  if (top5.length > 0) {
    lines.push("4. 효율 좋은 광고 TOP 5");
    lines.push("─────────────────────────────");
    top5.forEach((r: any, i: number) => {
      const name = adLabel(r);
      const branch = branchLabel(r.branch ?? "");
      const channel = channelLabel(r.channel ?? "");
      const clicks = r.effectiveClicks ?? r.effective_clicks ?? 0;
      lines.push(`  ${i + 1}. ${name} (${branch} / ${channel})`);
      lines.push(`     클릭 ${f(clicks)}회 · CTR ${fCtr(r.ctr)} · CPC ${fWon(r.cpc)}`);
    });
    lines.push("");
    lines.push("→ 위 광고는 클릭 효율이 우수하므로 소재를 유지하거나 예산을 소폭 증액하는 것을 검토해주세요.");
    lines.push("");
  }

  /* ── 5. 주의 광고 ── */
  if (warnings.length > 0) {
    lines.push("5. 정리가 필요한 광고");
    lines.push("─────────────────────────────");
    for (const r of warnings) {
      const name = adLabel(r);
      const branch = branchLabel(r.branch ?? "");
      const channel = channelLabel(r.channel ?? "");
      const clicks = r.effectiveClicks ?? r.effective_clicks ?? 0;
      const code = r.judgement as JudgementCode;
      const reason = judgeReason(code);
      lines.push(`  ▲ ${name} (${branch} / ${channel})`);
      lines.push(`     지출 ${fWon(r.spend)} · 클릭 ${f(clicks)}회 · CPC ${fWon(r.cpc)}${reason ? ` → ${reason}` : ""}`);
    }
    lines.push("");
    lines.push("→ 위 광고는 지출 대비 효율이 낮습니다. 소재 교체 또는 예산 축소를 권장합니다.");
    lines.push("");
  }

  /* ── 6. 다음 액션 ── */
  lines.push("6. 다음 달 액션 제안");
  lines.push("─────────────────────────────");

  const chSorted = [...byChannel].sort((a, b) => (a.cpc ?? Infinity) - (b.cpc ?? Infinity));
  if (chSorted[0]) {
    lines.push(`  ✅ ${channelLabel(chSorted[0].channel)}: 효율 우수 → 예산 유지 또는 소폭 증액`);
  }
  if (chSorted.length > 1 && chSorted[chSorted.length - 1] !== chSorted[0]) {
    lines.push(`  ⚠️ ${channelLabel(chSorted[chSorted.length - 1].channel)}: CPC 높음 → 소재 개선 또는 예산 검토`);
  }
  if (warnings.length > 0) {
    lines.push(`  🔴 주의 광고 ${warnings.length}건: 예산 축소 또는 소재 교체 우선 진행`);
  }
  for (const b of byBranch) {
    if (chSorted[0]) {
      lines.push(`  📍 ${branchLabel(b.branch)}점: ${channelLabel(chSorted[0].channel)} 채널 중심 운영 추천`);
    }
  }
  lines.push("");
  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`  스트롱복싱 광고성과 분석 리포트`);
  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  return lines.join("\n");
};
