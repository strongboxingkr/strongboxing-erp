import type { MarketingAggregate, MarketingBranch, MarketingChannel, NormalizedMarketingRow, PerformanceJudgement } from "./types";

const aggregate = (rows: NormalizedMarketingRow[]) => {
  const spend = rows.reduce((s, r) => s + r.spend, 0);
  const impressions = rows.reduce((s, r) => s + r.impressions, 0);
  const clicks = rows.reduce((s, r) => s + r.effectiveClicks, 0);
  const results = rows.reduce((s, r) => s + r.results, 0);
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : null;
  const cpc = clicks > 0 ? spend / clicks : null;
  const costPerResult = results > 0 ? spend / results : null;
  return { spend, impressions, clicks, results, ctr, cpc, costPerResult };
};

export const calcOverall = (rows: NormalizedMarketingRow[]): MarketingAggregate => ({
  branch: "ALL", channel: "ALL", ...aggregate(rows),
});

export const calcByBranch = (rows: NormalizedMarketingRow[]): MarketingAggregate[] =>
  [...new Set(rows.map((r) => r.branch))].map((branch) => ({
    branch, channel: "ALL" as const,
    ...aggregate(rows.filter((r) => r.branch === branch)),
  }));

export const calcByChannel = (rows: NormalizedMarketingRow[]): MarketingAggregate[] =>
  [...new Set(rows.map((r) => r.channel))].map((channel) => ({
    branch: "ALL" as const, channel,
    ...aggregate(rows.filter((r) => r.channel === channel)),
  }));

export const calcByBranchAndChannel = (rows: NormalizedMarketingRow[]): MarketingAggregate[] =>
  [...new Set(rows.map((r) => `${r.branch}__${r.channel}`))].map((pair) => {
    const [branch, channel] = pair.split("__") as [MarketingBranch, MarketingChannel];
    return { branch, channel, ...aggregate(rows.filter((r) => r.branch === branch && r.channel === channel)) };
  });

export const judgePerformance = (row: NormalizedMarketingRow): PerformanceJudgement => {
  if (row.impressions < 500 || row.spend < 5000) return "데이터 부족";
  const isWarning =
    (row.spend >= 30000 && row.effectiveClicks < 10) ||
    (row.cpc !== null && row.cpc >= 700) ||
    (row.ctr !== null && row.ctr < 0.7);
  if (isWarning) return "주의";
  const isGood =
    (row.effectiveClicks >= 20 && row.cpc !== null && row.cpc <= 300) ||
    (row.ctr !== null && row.ctr >= 1.2 && row.effectiveClicks >= 10);
  if (isGood) return "좋음";
  return "보통";
};

export const getTop5 = (rows: NormalizedMarketingRow[]): NormalizedMarketingRow[] =>
  rows
    .filter((r) => r.effectiveClicks >= 10 && r.cpc !== null)
    .sort((a, b) => (a.cpc ?? Infinity) - (b.cpc ?? Infinity) || (b.ctr ?? 0) - (a.ctr ?? 0))
    .slice(0, 5);

export const getWarningAds = (rows: NormalizedMarketingRow[]): NormalizedMarketingRow[] =>
  rows.filter((r) => judgePerformance(r) === "주의").sort((a, b) => b.spend - a.spend);
