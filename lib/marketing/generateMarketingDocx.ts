import {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, HeadingLevel, AlignmentType, WidthType, BorderStyle,
  ShadingType, TableLayoutType,
} from "docx";
import { BRANCH_LABELS, CHANNEL_LABELS, CODE_TO_JUDGEMENT, type JudgementCode } from "./types";

/* ─── 포맷 ─── */
const f = (n: number | null | undefined) =>
  n == null || isNaN(n as number) ? "-" : Math.round(n as number).toLocaleString("ko-KR");
const fWon = (n: number | null | undefined) =>
  n == null || isNaN(n as number) ? "-" : `${Math.round(n as number).toLocaleString("ko-KR")}원`;
const fCtr = (n: number | null | undefined) =>
  n == null || isNaN(n as number) ? "-" : `${Number(n).toFixed(2)}%`;
const fCpc = (n: number | null | undefined) => fWon(n);
const brLabel = (s: string) => BRANCH_LABELS[s as keyof typeof BRANCH_LABELS] ?? s;
const chLabel = (s: string) => CHANNEL_LABELS[s as keyof typeof CHANNEL_LABELS] ?? s;
const jLabel = (s: string) => CODE_TO_JUDGEMENT[s as JudgementCode] ?? s;
const adName = (r: any) =>
  r.ad_name || r.campaign_name || r.adset_name || r.creative_name || "이름 없는 광고";

/* ─── 색상 ─── */
const RED = "D01E2E";
const GRAY = "64748B";
const LIGHT_GRAY = "F8FAFC";
const BLACK = "111827";

/* ─── 공통 텍스트 빌더 ─── */
const txt = (text: string, opts?: { bold?: boolean; size?: number; color?: string; italics?: boolean }) =>
  new TextRun({
    text,
    bold: opts?.bold,
    size: opts?.size ?? 20,
    color: opts?.color ?? BLACK,
    font: "맑은 고딕",
    italics: opts?.italics,
  });

/* ─── 섹션 제목 단락 ─── */
const sectionTitle = (text: string) =>
  new Paragraph({
    children: [txt(text, { bold: true, size: 24, color: RED })],
    spacing: { before: 320, after: 120 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 8, color: RED, space: 4 },
    },
  });

/* ─── 일반 단락 ─── */
const para = (text: string, opts?: { bold?: boolean; size?: number; color?: string; spacing?: number }) =>
  new Paragraph({
    children: [txt(text, opts)],
    spacing: { after: opts?.spacing ?? 80 },
  });

/* ─── 테이블 헤더 셀 ─── */
const thCell = (text: string, widthPct = 12) =>
  new TableCell({
    children: [
      new Paragraph({
        children: [txt(text, { bold: true, size: 18, color: "FFFFFF" })],
        alignment: AlignmentType.CENTER,
      }),
    ],
    shading: { type: ShadingType.SOLID, color: RED, fill: RED },
    width: { size: widthPct, type: WidthType.PERCENTAGE },
    margins: { top: 80, bottom: 80, left: 80, right: 80 },
  });

/* ─── 테이블 데이터 셀 ─── */
const tdCell = (text: string, align: typeof AlignmentType[keyof typeof AlignmentType] = AlignmentType.CENTER, isAlt = false) =>
  new TableCell({
    children: [
      new Paragraph({
        children: [txt(text, { size: 18 })],
        alignment: align,
      }),
    ],
    shading: isAlt ? { type: ShadingType.SOLID, color: LIGHT_GRAY, fill: LIGHT_GRAY } : undefined,
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
  });

/* ─── 요약 카드 줄 ─── */
const metricRow = (label: string, value: string) =>
  new TableRow({
    children: [
      thCell(label, 30),
      new TableCell({
        children: [new Paragraph({ children: [txt(value, { bold: true, size: 22 })], alignment: AlignmentType.RIGHT })],
        width: { size: 70, type: WidthType.PERCENTAGE },
        margins: { top: 80, bottom: 80, left: 80, right: 120 },
      }),
    ],
  });

/* ─── 2컬럼 요약 테이블 ─── */
const metricsTable = (rows: { label: string; value: string }[]) =>
  new Table({
    rows: rows.map((r) => metricRow(r.label, r.value)),
    width: { size: 60, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: {
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: "E2E8F0" },
      insideVertical: { style: BorderStyle.NONE },
      top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
    },
  });

/* ─── 일반 데이터 테이블 ─── */
const dataTable = (headers: { text: string; pct: number }[], dataRows: string[][], opts?: { rightCols?: number[] }) => {
  const headerRow = new TableRow({
    children: headers.map((h) => thCell(h.text, h.pct)),
    tableHeader: true,
  });
  const bodyRows = dataRows.map((row, ri) =>
    new TableRow({
      children: row.map((cell, ci) =>
        tdCell(
          cell,
          (opts?.rightCols ?? []).includes(ci) ? AlignmentType.RIGHT : AlignmentType.CENTER,
          ri % 2 === 1
        )
      ),
    })
  );
  return new Table({
    rows: [headerRow, ...bodyRows],
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: {
      top:     { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0" },
      bottom:  { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0" },
      left:    { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0" },
      right:   { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: "E2E8F0" },
      insideVertical: { style: BorderStyle.SINGLE, size: 2, color: "E2E8F0" },
    },
  });
};

/* ─── 줄 구분 ─── */
const spacer = (n = 1) =>
  Array.from({ length: n }, () => new Paragraph({ children: [], spacing: { after: 0 } }));

/* ─── 메인 ─── */
export interface DocxInput {
  month: string;
  title: string;
  createdAt?: string;
  overall: { spend: number; impressions: number; clicks: number; results: number; ctr: number | null; cpc: number | null; costPerResult?: number | null; avg_ctr?: number | null; avg_cpc?: number | null; avg_cost_per_result?: number | null; total_spend?: number; total_impressions?: number; total_clicks?: number; total_results?: number };
  byChannel: any[];
  byBranch: any[];
  byBranchChannel: any[];
  top5: any[];
  warnings: any[];
  summaryText?: string;
  nextActionText?: string;
}

export const generateMarketingDocx = async (input: DocxInput): Promise<Buffer> => {
  const {
    month, title, createdAt, overall, byChannel, byBranch,
    byBranchChannel, top5, warnings, summaryText, nextActionText,
  } = input;

  const [y, m] = (month || "").split("-");
  const monthLabel = y && m ? `${y}년 ${parseInt(m)}월` : month;

  const spend = overall.spend ?? overall.total_spend ?? 0;
  const impressions = overall.impressions ?? overall.total_impressions ?? 0;
  const clicks = overall.clicks ?? overall.total_clicks ?? 0;
  const results = overall.results ?? overall.total_results ?? 0;
  const ctr = overall.ctr ?? overall.avg_ctr ?? null;
  const cpc = overall.cpc ?? overall.avg_cpc ?? null;
  const cpr = overall.costPerResult ?? overall.avg_cost_per_result ?? null;

  const children: (Paragraph | Table)[] = [];

  /* ── 표지 ── */
  children.push(
    new Paragraph({
      children: [txt("STRONG BOXING", { bold: true, size: 36, color: RED })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 400, after: 80 },
    }),
    new Paragraph({
      children: [txt("광고성과 분석 보고서", { bold: true, size: 44, color: BLACK })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [txt(title || `${monthLabel} 광고성과 분석`, { size: 26, color: GRAY })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [txt(`분석 기간: ${monthLabel}`, { size: 22, color: GRAY })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [txt(createdAt ? `생성일: ${new Date(createdAt).toLocaleDateString("ko-KR")}` : "", { size: 20, color: GRAY })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 500 },
    }),
    ...spacer(2),
  );

  /* ── 핵심 요약 ── */
  children.push(sectionTitle("핵심 요약"));
  children.push(
    metricsTable([
      { label: "총 광고비",     value: fWon(spend) },
      { label: "총 노출",       value: `${f(impressions)}회` },
      { label: "총 클릭",       value: `${f(clicks)}회` },
      { label: "평균 CTR",      value: fCtr(ctr) },
      { label: "평균 CPC",      value: fCpc(cpc) },
      { label: "총 결과",       value: results > 0 ? `${f(results)}건` : "-" },
      { label: "결과당 비용",    value: fCpc(cpr) },
    ]),
    ...spacer(),
  );

  /* ── 대표 요약 문장 ── */
  if (summaryText) {
    children.push(...spacer(), sectionTitle("대표 요약"));
    summaryText.split("\n").filter(Boolean).forEach((line) => {
      children.push(para(line));
    });
  }

  /* ── 채널별 성과 ── */
  if (byChannel.length > 0) {
    children.push(...spacer(), sectionTitle("채널별 성과"));
    const cHeaders = [
      { text: "채널", pct: 12 }, { text: "지출", pct: 14 }, { text: "노출", pct: 11 },
      { text: "클릭", pct: 10 }, { text: "CTR", pct: 9 }, { text: "CPC", pct: 12 },
      { text: "결과", pct: 10 }, { text: "결과당 비용", pct: 14 },
    ];
    const cRows = byChannel.length > 0 ? byChannel.map((c) => [
      chLabel(c.channel ?? ""),
      fWon(c.spend), f(c.impressions), f(c.clicks),
      fCtr(c.ctr), fCpc(c.cpc), f(c.results),
      fCpc(c.cost_per_result ?? c.costPerResult),
    ]) : [["데이터 없음","","","","","","",""]];
    children.push(dataTable(cHeaders, cRows, { rightCols: [1, 5, 7] }));
  }

  /* ── 지점별 성과 ── */
  if (byBranch.length > 0) {
    children.push(...spacer(), sectionTitle("지점별 성과"));
    const bHeaders = [
      { text: "지점", pct: 12 }, { text: "지출", pct: 14 }, { text: "노출", pct: 11 },
      { text: "클릭", pct: 10 }, { text: "CTR", pct: 9 }, { text: "CPC", pct: 12 },
      { text: "결과", pct: 10 }, { text: "결과당 비용", pct: 14 },
    ];
    const bRows = byBranch.map((b) => [
      brLabel(b.branch ?? ""),
      fWon(b.spend), f(b.impressions), f(b.clicks),
      fCtr(b.ctr), fCpc(b.cpc), f(b.results),
      fCpc(b.cost_per_result ?? b.costPerResult),
    ]);
    children.push(dataTable(bHeaders, bRows, { rightCols: [1, 5, 7] }));
  }

  /* ── 지점+채널별 ── */
  if (byBranchChannel.length > 0) {
    children.push(...spacer(), sectionTitle("지점 × 채널별 성과"));
    const bcHeaders = [
      { text: "지점", pct: 10 }, { text: "채널", pct: 10 }, { text: "지출", pct: 12 },
      { text: "노출", pct: 10 }, { text: "클릭", pct: 9 }, { text: "CTR", pct: 9 },
      { text: "CPC", pct: 12 }, { text: "결과", pct: 9 }, { text: "결과당 비용", pct: 11 },
    ];
    const bcRows = byBranchChannel.map((r) => [
      brLabel(r.branch ?? ""), chLabel(r.channel ?? ""),
      fWon(r.spend), f(r.impressions), f(r.clicks),
      fCtr(r.ctr), fCpc(r.cpc), f(r.results),
      fCpc(r.cost_per_result ?? r.costPerResult),
    ]);
    children.push(dataTable(bcHeaders, bcRows, { rightCols: [2, 6, 8] }));
  }

  /* ── TOP 5 ── */
  if (top5.length > 0) {
    children.push(...spacer(), sectionTitle("효율 좋은 광고 TOP 5"));
    const t5Headers = [
      { text: "순위", pct: 6 }, { text: "지점", pct: 8 }, { text: "채널", pct: 8 },
      { text: "광고명", pct: 24 }, { text: "지출", pct: 11 }, { text: "클릭", pct: 9 },
      { text: "CTR", pct: 9 }, { text: "CPC", pct: 11 }, { text: "결과", pct: 8 },
    ];
    const t5Rows = top5.map((r, i) => [
      `#${i + 1}`, brLabel(r.branch ?? ""), chLabel(r.channel ?? ""),
      adName(r), fWon(r.spend),
      f(r.effective_clicks ?? r.effectiveClicks),
      fCtr(r.ctr), fCpc(r.cpc), f(r.results),
    ]);
    children.push(dataTable(t5Headers, t5Rows, { rightCols: [4, 7] }));
  }

  /* ── 주의 광고 ── */
  if (warnings.length > 0) {
    children.push(...spacer(), sectionTitle("정리가 필요한 광고"));
    const wHeaders = [
      { text: "지점", pct: 8 }, { text: "채널", pct: 8 }, { text: "광고명", pct: 26 },
      { text: "지출", pct: 11 }, { text: "클릭", pct: 8 }, { text: "CTR", pct: 9 },
      { text: "CPC", pct: 11 }, { text: "판단 사유", pct: 15 },
    ];
    const wRows = warnings.map((r) => {
      const code = r.judgement as JudgementCode;
      const reason = code === "WARNING" ? "CPC 높음 / 클릭 저조" : code === "LOW_DATA" ? "데이터 부족" : "";
      return [
        brLabel(r.branch ?? ""), chLabel(r.channel ?? ""), adName(r),
        fWon(r.spend), f(r.effective_clicks ?? r.effectiveClicks),
        fCtr(r.ctr), fCpc(r.cpc), reason,
      ];
    });
    children.push(dataTable(wHeaders, wRows, { rightCols: [3, 6] }));
  }

  /* ── 다음 달 액션 ── */
  if (nextActionText) {
    children.push(...spacer(), sectionTitle("다음 달 액션 제안"));
    nextActionText.split("\n").filter(Boolean).forEach((line) => {
      children.push(para(line, { spacing: 100 }));
    });
  }

  /* ── 푸터 ── */
  children.push(
    ...spacer(2),
    new Paragraph({
      children: [txt("스트롱복싱 광고성과 분석 리포트", { size: 18, color: GRAY, italics: true })],
      alignment: AlignmentType.CENTER,
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0", space: 8 } },
      spacing: { before: 300 },
    }),
  );

  const doc = new Document({
    creator: "STRONGBOXING ERP",
    title: title || `${monthLabel} 광고성과 분석`,
    description: "스트롱복싱 월간 광고성과 보고서",
    styles: {
      default: {
        document: { run: { font: "맑은 고딕", size: 20 } },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 },
          },
        },
        children,
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
};
