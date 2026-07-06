import type { RawCsvFile } from "./parseMarketingCsv";
import type { MarketingBranch, NormalizedMarketingRow } from "./types";

const FIELD_CANDIDATES: Record<string, string[]> = {
  spend: ["지출", "지출 금액", "광고비", "비용", "총비용", "Spend", "Amount spent", "Amount Spent"],
  impressions: ["노출", "노출수", "Impressions"],
  reach: ["도달", "도달수", "Reach"],
  clicks: ["클릭", "클릭수", "전체 클릭", "Clicks", "All clicks"],
  link_clicks: ["링크 클릭", "링크 클릭수", "Link clicks", "Link Clicks"],
  results: ["결과", "결과 수", "Results"],
  ctr: ["CTR", "클릭률", "링크 클릭률", "CTR (링크 클릭률)", "Link CTR"],
  cpc: ["CPC", "평균 CPC", "클릭당 비용", "Cost per click", "Cost per link click"],
  cost_per_result: ["결과당 비용", "결과당 비용(원)", "Cost per result", "Cost per Result"],
  campaign_name: ["캠페인", "캠페인 이름", "Campaign name", "Campaign Name"],
  adset_name: ["광고 세트", "광고 세트 이름", "Ad set name", "Ad Set Name"],
  ad_name: ["광고", "광고 이름", "Ad name", "Ad Name"],
  creative_name: ["소재", "소재 이름", "광고 소재", "Creative", "Creative name"],
  status: ["상태", "게재 상태", "Status", "Delivery"],
  start_date: ["시작일", "시작", "Start date", "Starts"],
  end_date: ["종료일", "종료", "End date", "Ends"],
};

const buildColumnMap = (headers: string[]): Record<string, string> => {
  const map: Record<string, string> = {};
  for (const [field, candidates] of Object.entries(FIELD_CANDIDATES)) {
    for (const candidate of candidates) {
      const found = headers.find((h) => h.trim().toLowerCase() === candidate.trim().toLowerCase());
      if (found) { map[field] = found; break; }
    }
  }
  return map;
};

const parseNum = (val: string | undefined | null): number => {
  if (!val || val === "-") return 0;
  const cleaned = String(val).replace(/[,%원₩\s]/g, "").replace(/%$/, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
};

const parseNullableNum = (val: string | undefined | null): number | null => {
  if (!val || val === "-") return null;
  const cleaned = String(val).replace(/[,%원₩\s]/g, "").replace(/%$/, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
};

const detectBranchFromFileName = (fileName: string): MarketingBranch | null => {
  if (fileName.includes("목동")) return "MOKDONG";
  if (fileName.includes("철산")) return "CHEOLSAN";
  if (fileName.includes("개봉")) return "GAEBONG";
  if (fileName.includes("신정")) return "SINJEONG";
  if (fileName.includes("영등포")) return "YEONGDEUNGPO";
  return null;
};

export const normalizeRows = (
  rawFiles: RawCsvFile[],
  defaultBranch: MarketingBranch | "ALL"
): { rows: NormalizedMarketingRow[]; errors: string[] } => {
  const rows: NormalizedMarketingRow[] = [];
  const errors: string[] = [];

  for (const file of rawFiles) {
    if (file.rows.length === 0) {
      errors.push(`${file.fileName}: 데이터가 없습니다.`);
      continue;
    }

    const headers = Object.keys(file.rows[0]);
    const colMap = buildColumnMap(headers);

    const hasMetric = ["spend", "impressions", "clicks", "link_clicks", "results"].some((f) => colMap[f]);
    if (!hasMetric) {
      errors.push(`${file.fileName}: 광고 성과 열을 찾지 못했습니다. CSV 열 이름을 확인해주세요.`);
      continue;
    }

    const fileBranch = detectBranchFromFileName(file.fileName);
    const resolvedBranch: MarketingBranch =
      fileBranch ?? (defaultBranch !== "ALL" ? (defaultBranch as MarketingBranch) : "UNKNOWN");

    for (const row of file.rows) {
      const get = (field: string) => (colMap[field] ? row[colMap[field]] : undefined);

      const impressions = parseNum(get("impressions"));
      const reach = parseNum(get("reach"));
      const clicks = parseNum(get("clicks"));
      const linkClicks = parseNum(get("link_clicks"));
      const results = parseNum(get("results"));
      const spend = parseNum(get("spend"));

      const effectiveClicks =
        file.channel === "META" && linkClicks > 0 ? linkClicks : clicks > 0 ? clicks : linkClicks;

      let ctr = parseNullableNum(get("ctr"));
      if (ctr === null && impressions > 0) ctr = (effectiveClicks / impressions) * 100;

      let cpc = parseNullableNum(get("cpc"));
      if (cpc === null && effectiveClicks > 0) cpc = spend / effectiveClicks;

      let costPerResult = parseNullableNum(get("cost_per_result"));
      if (costPerResult === null && results > 0) costPerResult = spend / results;

      rows.push({
        channel: file.channel,
        branch: resolvedBranch,
        campaignName: get("campaign_name") || "",
        adsetName: get("adset_name") || "",
        adName: get("ad_name") || "",
        creativeName: get("creative_name") || "",
        status: get("status") || "",
        impressions, reach, clicks, linkClicks, effectiveClicks, results, spend,
        ctr, cpc, costPerResult,
        startDate: get("start_date") || "",
        endDate: get("end_date") || "",
        sourceFileName: file.fileName,
      });
    }
  }

  return { rows, errors };
};
