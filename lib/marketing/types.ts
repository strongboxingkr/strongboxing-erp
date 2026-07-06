export type MarketingChannel = "NAVER" | "DAANGN" | "META";
export type MarketingBranch = "MOKDONG" | "CHEOLSAN" | "GAEBONG" | "SINJEONG" | "YEONGDEUNGPO" | "UNKNOWN";
export type PerformanceJudgement = "좋음" | "보통" | "주의" | "데이터 부족";
export type JudgementCode = "GOOD" | "NORMAL" | "WARNING" | "LOW_DATA";

export const JUDGEMENT_TO_CODE: Record<PerformanceJudgement, JudgementCode> = {
  "좋음": "GOOD",
  "보통": "NORMAL",
  "주의": "WARNING",
  "데이터 부족": "LOW_DATA",
};

export const CODE_TO_JUDGEMENT: Record<JudgementCode, PerformanceJudgement> = {
  GOOD: "좋음",
  NORMAL: "보통",
  WARNING: "주의",
  LOW_DATA: "데이터 부족",
};

export const BRANCH_LABELS: Record<MarketingBranch, string> = {
  MOKDONG: "목동",
  CHEOLSAN: "철산",
  GAEBONG: "개봉",
  SINJEONG: "신정",
  YEONGDEUNGPO: "영등포",
  UNKNOWN: "기타",
};

export const CHANNEL_LABELS: Record<MarketingChannel, string> = {
  NAVER: "네이버",
  DAANGN: "당근",
  META: "메타",
};

export interface NormalizedMarketingRow {
  channel: MarketingChannel;
  branch: MarketingBranch;
  campaignName: string;
  adsetName: string;
  adName: string;
  creativeName: string;
  status: string;
  impressions: number;
  reach: number;
  clicks: number;
  linkClicks: number;
  effectiveClicks: number;
  results: number;
  spend: number;
  ctr: number | null;
  cpc: number | null;
  costPerResult: number | null;
  startDate: string;
  endDate: string;
  sourceFileName: string;
}

export interface MarketingAggregate {
  branch: MarketingBranch | "ALL";
  channel: MarketingChannel | "ALL";
  impressions: number;
  clicks: number;
  results: number;
  spend: number;
  ctr: number | null;
  cpc: number | null;
  costPerResult: number | null;
}
