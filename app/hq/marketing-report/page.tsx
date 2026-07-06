"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import AppShell from "@/components/AppShell";
import { parseCsvFile } from "@/lib/marketing/parseMarketingCsv";
import { normalizeRows } from "@/lib/marketing/normalizeMarketingRows";
import {
  calcOverall, calcByBranch, calcByChannel, calcByBranchAndChannel,
  judgePerformance, getTop5, getWarningAds,
} from "@/lib/marketing/calculateMarketingMetrics";
import {
  generateSummaryText, generateNextActionText, generateFullSummaryText,
} from "@/lib/marketing/generateMarketingSummary";
import { generateMarketingReportText } from "@/lib/marketing/generateMarketingReportText";
import {
  convertItemsToCsv, convertSummaryToCsv,
  downloadTextFile, downloadCsvFile,
  generateReportTxtFileName, generateDetailCsvFileName, generateSummaryCsvFileName,
} from "@/lib/marketing/exportMarketingReport";
import {
  BRANCH_LABELS, CHANNEL_LABELS, JUDGEMENT_TO_CODE, CODE_TO_JUDGEMENT,
  type MarketingBranch, type MarketingChannel, type NormalizedMarketingRow,
  type PerformanceJudgement, type JudgementCode,
} from "@/lib/marketing/types";

/* ─── 포맷 헬퍼 ─── */
const fmt = (n: number | null, suffix = "") =>
  n === null || isNaN(n as number) ? "-" : `${Math.round(n as number).toLocaleString()}${suffix}`;
const fmtCtr = (n: number | null) => (n === null ? "-" : `${Number(n).toFixed(2)}%`);
const fmtCpc = (n: number | null) => (n === null ? "-" : `${Math.round(n as number).toLocaleString()}원`);

const JUDGE_STYLE: Record<PerformanceJudgement, { bg: string; color: string }> = {
  "좋음":      { bg: "#f0fdf4", color: "#16a34a" },
  "보통":      { bg: "#eff6ff", color: "#3b82f6" },
  "주의":      { bg: "#fef2f2", color: "#ef4444" },
  "데이터 부족": { bg: "#f8fafc", color: "#94a3b8" },
};

const BRANCHES: MarketingBranch[] = ["MOKDONG","CHEOLSAN","GAEBONG","SINJEONG","YEONGDEUNGPO","UNKNOWN"];

const autoTitle = (month: string) => {
  if (!month) return "";
  const [y, m] = month.split("-");
  return `${y}년 ${parseInt(m)}월 광고성과 분석`;
};

/* ─── 타입 ─── */
type PageStatus = "idle" | "unsaved" | "saved" | "viewing";

interface SavedReport {
  id: number; report_month: string; title: string;
  total_spend: number; total_impressions: number; total_clicks: number; total_results: number;
  avg_ctr: number; avg_cpc: number; avg_cost_per_result: number; created_at: string;
}

interface DetailItem {
  branch: string; channel: string; campaign_name: string; adset_name: string;
  ad_name: string; creative_name: string; impressions: number; effective_clicks: number;
  results: number; spend: number; ctr: number; cpc: number; cost_per_result: number;
  judgement: JudgementCode;
}

interface AggRow {
  branch?: string; channel?: string; spend: number; impressions: number;
  clicks: number; results: number; ctr: number | null; cpc: number | null;
  cost_per_result?: number | null; costPerResult?: number | null;
}

interface DetailData {
  report: SavedReport & { summary_text: string; next_action_text: string };
  items: DetailItem[];
  byBranch: AggRow[]; byChannel: AggRow[]; byBranchChannel: AggRow[];
  top5: DetailItem[]; warnings: DetailItem[];
}

/* ─── 메인 ─── */
export default function MarketingReportPage() {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [reportTitle, setReportTitle] = useState("");
  const [defaultBranch, setDefaultBranch] = useState<MarketingBranch | "ALL">("ALL");
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const [rows, setRows] = useState<NormalizedMarketingRow[]>([]);
  const [pageStatus, setPageStatus] = useState<PageStatus>("idle");
  const [savedReportId, setSavedReportId] = useState<number | null>(null);

  const [reportList, setReportList] = useState<SavedReport[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState("");

  const [detail, setDetail] = useState<DetailData | null>(null);
  const [saving, setSaving] = useState(false);

  const [toast, setToast] = useState("");
  const [toastType, setToastType] = useState<"ok" | "err">("ok");

  const naverRef = useRef<HTMLInputElement | null>(null);
  const daangnRef = useRef<HTMLInputElement | null>(null);
  const metaRef = useRef<HTMLInputElement | null>(null);

  const showToast = (msg: string, type: "ok" | "err" = "ok") => {
    setToast(msg); setToastType(type);
    setTimeout(() => setToast(""), 3000);
  };

  /* 리포트 목록 불러오기 */
  const loadList = useCallback(async () => {
    setListLoading(true); setListError("");
    try {
      const res = await fetch("/api/hq/marketing-reports");
      const json = await res.json();
      if (json.success) setReportList(json.data);
      else setListError("저장된 리포트를 불러오지 못했습니다.");
    } catch {
      setListError("저장된 리포트를 불러오지 못했습니다.");
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => { loadList(); }, [loadList]);

  /* CSV 분석 */
  const handleAnalyze = async () => {
    const allErrors: string[] = [];
    const allRaw = [];
    const slots = [
      { ref: naverRef, ch: "NAVER" as const },
      { ref: daangnRef, ch: "DAANGN" as const },
      { ref: metaRef, ch: "META" as const },
    ];
    for (const { ref, ch } of slots) {
      for (const file of Array.from(ref.current?.files ?? [])) {
        if (!file.name.endsWith(".csv")) { allErrors.push(`${file.name}: CSV 파일만 가능합니다.`); continue; }
        try { allRaw.push(await parseCsvFile(file, ch)); }
        catch (e: unknown) { allErrors.push((e as Error).message); }
      }
    }
    const { rows: normalized, errors: parseErrors } = normalizeRows(allRaw, defaultBranch);
    setUploadErrors([...allErrors, ...parseErrors]);
    setRows(normalized);
    setDetail(null);
    setSavedReportId(null);
    if (normalized.length > 0) {
      setPageStatus("unsaved");
      setReportTitle(autoTitle(month));
    }
  };

  /* 저장 */
  const handleSave = async () => {
    if (!month) { showToast("분석 월을 선택해주세요.", "err"); return; }
    if (rows.length === 0) { showToast("저장할 광고 분석 데이터가 없습니다.", "err"); return; }

    setSaving(true);
    try {
      const overall = calcOverall(rows);
      const summaryText = generateSummaryText(month, overall, calcByChannel(rows), calcByBranch(rows), getWarningAds(rows).length);
      const nextActionText = generateNextActionText(calcByChannel(rows), calcByBranch(rows), getWarningAds(rows).length);

      const items = rows.map((r) => {
        const judge = judgePerformance(r);
        return {
          branch: r.branch, channel: r.channel,
          campaign_name: r.campaignName, adset_name: r.adsetName,
          ad_name: r.adName, creative_name: r.creativeName,
          status: r.status, impressions: r.impressions, reach: r.reach,
          clicks: r.clicks, link_clicks: r.linkClicks, effective_clicks: r.effectiveClicks,
          results: r.results, spend: r.spend, ctr: r.ctr ?? 0, cpc: r.cpc ?? 0,
          cost_per_result: r.costPerResult ?? 0, judgement: JUDGEMENT_TO_CODE[judge],
          source_file_name: r.sourceFileName, start_date: r.startDate, end_date: r.endDate,
        };
      });

      const res = await fetch("/api/hq/marketing-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          report_month: month,
          title: reportTitle || autoTitle(month),
          summary_text: summaryText,
          next_action_text: nextActionText,
          totals: {
            spend: overall.spend, impressions: overall.impressions,
            clicks: overall.clicks, results: overall.results,
            ctr: overall.ctr ?? 0, cpc: overall.cpc ?? 0,
            costPerResult: overall.costPerResult ?? 0,
          },
          items,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      setSavedReportId(json.data.id);
      setPageStatus("saved");
      showToast("저장되었습니다!");
      loadList();
    } catch {
      showToast("리포트 저장 중 오류가 발생했습니다.", "err");
    } finally {
      setSaving(false);
    }
  };

  /* 저장된 리포트 보기 */
  const handleView = async (id: number) => {
    try {
      const res = await fetch(`/api/hq/marketing-reports/${id}`);
      const json = await res.json();
      if (!json.success) throw new Error();
      setDetail(json.data);
      setRows([]);
      setPageStatus("viewing");
      setMonth(json.data.report.report_month);
      setReportTitle(json.data.report.title);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      showToast("저장된 리포트를 불러오지 못했습니다.", "err");
    }
  };

  /* 삭제 */
  const handleDelete = async (id: number) => {
    if (!confirm("이 광고성과 리포트를 삭제할까요?")) return;
    try {
      const res = await fetch(`/api/hq/marketing-reports/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error();
      showToast("삭제되었습니다.");
      if (detail?.report.id === id) { setDetail(null); setRows([]); setPageStatus("idle"); }
      loadList();
    } catch {
      showToast("리포트 삭제 중 오류가 발생했습니다.", "err");
    }
  };

  /* ─── 대표 보고서 텍스트 생성 ─── */
  const buildReportText = (overallArg: any, byChannelArg: any[], byBranchArg: any[], top5Arg: any[], warnArg: any[]) => {
    return generateMarketingReportText({
      month,
      title: reportTitle || autoTitle(month),
      overall: overallArg,
      byChannel: byChannelArg,
      byBranch: byBranchArg,
      top5: top5Arg,
      warnings: warnArg,
    });
  };

  /* ─── 다운로드 핸들러 ─── */
  const handleCopyReport = async (text: string) => {
    if (!text) { showToast("다운로드할 리포트가 없습니다.", "err"); return; }
    try {
      await navigator.clipboard.writeText(text);
      showToast("보고서가 복사되었습니다!");
    } catch {
      showToast("보고서를 복사하지 못했습니다.", "err");
    }
  };

  const handleDownloadTxt = (text: string) => {
    if (!text) { showToast("다운로드할 리포트가 없습니다.", "err"); return; }
    try {
      downloadTextFile(generateReportTxtFileName(reportTitle, month), text);
    } catch {
      showToast("보고서 생성 중 오류가 발생했습니다.", "err");
    }
  };

  const handleDownloadDetailCsv = (items: any[]) => {
    if (!items.length) { showToast("다운로드할 리포트가 없습니다.", "err"); return; }
    try {
      downloadCsvFile(generateDetailCsvFileName(month), convertItemsToCsv(items));
    } catch {
      showToast("CSV 생성 중 오류가 발생했습니다.", "err");
    }
  };

  const handleDownloadDocx = async (reportId: number) => {
    try {
      const res = await fetch(`/api/hq/marketing-reports/${reportId}/docx`);
      if (!res.ok) { showToast("DOCX 보고서 생성 중 오류가 발생했습니다.", "err"); return; }
      const blob = await res.blob();
      const contentDisposition = res.headers.get("Content-Disposition") ?? "";
      const match = contentDisposition.match(/filename\*=UTF-8''(.+)/);
      const fileName = match ? decodeURIComponent(match[1]) : "광고성과보고서.docx";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = fileName;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
      showToast("DOCX 다운로드가 시작되었습니다!");
    } catch {
      showToast("DOCX 보고서 생성 중 오류가 발생했습니다.", "err");
    }
  };

  const handleDownloadSummaryCsv = (overallArg: any, byChannelArg: any[], byBranchArg: any[]) => {
    if (!byChannelArg.length && !byBranchArg.length) { showToast("다운로드할 리포트가 없습니다.", "err"); return; }
    try {
      downloadCsvFile(generateSummaryCsvFileName(month), convertSummaryToCsv(overallArg, byChannelArg, byBranchArg));
    } catch {
      showToast("CSV 생성 중 오류가 발생했습니다.", "err");
    }
  };

  /* 현재 분석 데이터 (CSV 분석 or 저장된 리포트 보기) */
  const overall = rows.length ? calcOverall(rows) : null;
  const byBranch = rows.length ? calcByBranch(rows) : (detail?.byBranch ?? [] as AggRow[]);
  const byChannel = rows.length ? calcByChannel(rows) : (detail?.byChannel ?? [] as AggRow[]);
  const byBranchChannel = rows.length ? calcByBranchAndChannel(rows) : (detail?.byBranchChannel ?? [] as AggRow[]);
  const top5rows = rows.length ? getTop5(rows) : [];
  const warnRows = rows.length ? getWarningAds(rows) : [];
  const summaryText = overall
    ? generateSummaryText(month, overall, byChannel as any, byBranch as any, warnRows.length)
    : detail?.report.summary_text ?? "";
  const nextActionText = overall
    ? generateNextActionText(byChannel as any, byBranch as any, warnRows.length)
    : detail?.report.next_action_text ?? "";
  const fullSummary = overall
    ? generateFullSummaryText(month, overall, byChannel as any, byBranch as any)
    : "";

  const hasData = rows.length > 0 || !!detail;

  /* 현재 활성 아이템 목록 */
  const activeItems: any[] = rows.length > 0
    ? rows.map((r) => ({ ...r, effective_clicks: r.effectiveClicks, ad_name: r.adName, campaign_name: r.campaignName, adset_name: r.adsetName, creative_name: r.creativeName, source_file_name: r.sourceFileName, start_date: r.startDate, end_date: r.endDate, link_clicks: r.linkClicks, reach_count: r.reach, cost_per_result: r.costPerResult, judgement: JUDGEMENT_TO_CODE[judgePerformance(r)] }))
    : (detail?.items ?? []);

  const activeTop5 = rows.length ? top5rows : (detail?.top5 ?? []);
  const activeWarnings = rows.length ? warnRows : (detail?.warnings ?? []);

  const activeOverall = overall ?? (detail ? {
    spend: detail.report.total_spend, impressions: detail.report.total_impressions,
    clicks: detail.report.total_clicks, results: detail.report.total_results,
    ctr: detail.report.avg_ctr, cpc: detail.report.avg_cpc, costPerResult: detail.report.avg_cost_per_result,
  } : null);

  const reportText = hasData && activeOverall
    ? buildReportText(activeOverall, byChannel, byBranch, activeTop5, activeWarnings)
    : "";

  const copy = (text: string) =>
    navigator.clipboard.writeText(text).then(() => showToast("복사되었습니다!"));

  /* ─── 렌더 헬퍼: 소재별 테이블 ─── */
  const renderItemsTable = () => {
    if (rows.length > 0) {
      return rows.map((r, i) => {
        const judge = judgePerformance(r);
        const js = JUDGE_STYLE[judge];
        return (
          <tr key={i}>
            <td><span className="badge" style={{ background: js.bg, color: js.color }}>{judge}</span></td>
            <td>{BRANCH_LABELS[r.branch] ?? r.branch}</td>
            <td>{CHANNEL_LABELS[r.channel] ?? r.channel}</td>
            <td className="td-ellipsis">{r.campaignName || "-"}</td>
            <td className="td-ellipsis">{r.adsetName || "-"}</td>
            <td className="td-ellipsis">{r.adName || r.creativeName || "-"}</td>
            <td>{fmt(r.impressions)}</td>
            <td>{fmt(r.effectiveClicks)}</td>
            <td>{fmtCtr(r.ctr)}</td>
            <td>{fmt(r.spend, "원")}</td>
            <td>{fmtCpc(r.cpc)}</td>
            <td>{fmt(r.results)}</td>
            <td>{fmtCpc(r.costPerResult)}</td>
          </tr>
        );
      });
    }
    if (detail) {
      return detail.items.map((r, i) => {
        const label = CODE_TO_JUDGEMENT[r.judgement] ?? "보통";
        const js = JUDGE_STYLE[label];
        return (
          <tr key={i}>
            <td><span className="badge" style={{ background: js.bg, color: js.color }}>{label}</span></td>
            <td>{BRANCH_LABELS[r.branch as MarketingBranch] ?? r.branch}</td>
            <td>{CHANNEL_LABELS[r.channel as MarketingChannel] ?? r.channel}</td>
            <td className="td-ellipsis">{r.campaign_name || "-"}</td>
            <td className="td-ellipsis">{r.adset_name || "-"}</td>
            <td className="td-ellipsis">{r.ad_name || r.creative_name || "-"}</td>
            <td>{fmt(r.impressions)}</td>
            <td>{fmt(r.effective_clicks)}</td>
            <td>{fmtCtr(r.ctr)}</td>
            <td>{fmt(r.spend, "원")}</td>
            <td>{fmtCpc(r.cpc)}</td>
            <td>{fmt(r.results)}</td>
            <td>{fmtCpc(r.cost_per_result)}</td>
          </tr>
        );
      });
    }
    return null;
  };

  const statusBadge = () => {
    if (pageStatus === "idle") return null;
    const map = {
      unsaved: { label: "미저장 분석", bg: "#fef9c3", color: "#854d0e" },
      saved:   { label: "저장 완료",   bg: "#f0fdf4", color: "#15803d" },
      viewing: { label: "저장된 리포트", bg: "#eff6ff", color: "#1d4ed8" },
    };
    const s = map[pageStatus as keyof typeof map];
    if (!s) return null;
    return (
      <span className="badge" style={{ background: s.bg, color: s.color, fontSize: 12, padding: "4px 12px" }}>
        {s.label}
      </span>
    );
  };

  return (
    <AppShell title="광고성과 분석">
    <div style={{ padding: "24px 28px", maxWidth: 1200, margin: "0 auto" }}>
      <style>{`
        .mk-card{background:#fff;border-radius:16px;padding:20px 24px;border:1px solid #e2e8f0;margin-bottom:20px}
        .mk-table{width:100%;border-collapse:collapse;font-size:13px}
        .mk-table th{background:#f8fafc;color:#64748b;font-weight:700;padding:9px 12px;text-align:left;border-bottom:2px solid #e2e8f0;white-space:nowrap}
        .mk-table td{padding:9px 12px;border-bottom:1px solid #f1f5f9;vertical-align:middle}
        .mk-table tr:hover td{background:#fafbfc}
        .badge{display:inline-block;padding:2px 9px;border-radius:999px;font-size:11px;font-weight:700}
        .sec{font-size:15px;font-weight:800;color:#111827;margin-bottom:12px}
        .scard{background:#f8fafc;border-radius:12px;padding:14px 16px}
        .slabel{font-size:11px;color:#94a3b8;font-weight:600;margin-bottom:3px}
        .svalue{font-size:20px;font-weight:900;color:#111827}
        .inp{border:1.5px solid #e2e8f0;border-radius:8px;padding:7px 12px;font-size:13px;outline:none;background:#fff}
        .inp:focus{border-color:#111827}
        .btn{border:none;border-radius:8px;padding:8px 16px;font-size:13px;font-weight:700;cursor:pointer;transition:opacity .15s}
        .btn:disabled{opacity:.5;cursor:not-allowed}
        .btn-dark{background:#111827;color:#fff}
        .btn-gray{background:#f1f5f9;color:#374151}
        .btn-red{background:#fef2f2;color:#ef4444}
        .btn-blue{background:#eff6ff;color:#2563eb}
        .upload-box{border:2px dashed #e2e8f0;border-radius:10px;padding:14px;cursor:pointer;text-align:center;color:#94a3b8;font-size:13px;transition:border-color .15s}
        .upload-box:hover{border-color:#94a3b8}
        .td-ellipsis{max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      `}</style>

      {/* 헤더 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0, color: "#111827" }}>월간 광고성과 분석</h1>
            {statusBadge()}
          </div>
          <p style={{ color: "#9ca3af", marginTop: 4, fontSize: 13 }}>CSV 업로드 후 분석, 저장, 히스토리 조회가 가능합니다.</p>
        </div>
        {pageStatus === "unsaved" && (
          <button className="btn btn-dark" onClick={handleSave} disabled={saving} style={{ padding: "10px 22px" }}>
            {saving ? "저장 중..." : "이 리포트 저장"}
          </button>
        )}
        {pageStatus === "saved" && savedReportId && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "#16a34a", fontWeight: 700 }}>✅ 저장 완료</span>
            <button className="btn btn-gray" onClick={() => handleView(savedReportId)}>다시 보기</button>
          </div>
        )}
      </div>

      {/* 업로드 + 필터 */}
      <div className="mk-card">
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 18 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 4 }}>분석 월</label>
            <input className="inp" type="month" value={month} onChange={(e) => { setMonth(e.target.value); setReportTitle(autoTitle(e.target.value)); }} />
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 4 }}>리포트 제목</label>
            <input className="inp" style={{ width: "100%" }} value={reportTitle} onChange={(e) => setReportTitle(e.target.value)} placeholder={autoTitle(month)} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 4 }}>기본 지점</label>
            <select className="inp" value={defaultBranch} onChange={(e) => setDefaultBranch(e.target.value as MarketingBranch | "ALL")}>
              <option value="ALL">미지정</option>
              {BRANCHES.map((b) => <option key={b} value={b}>{BRANCH_LABELS[b]}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 14, marginBottom: 18 }}>
          {([
            { label: "네이버 광고 CSV", ref: naverRef },
            { label: "당근비즈니스 CSV", ref: daangnRef },
            { label: "메타 광고 CSV", ref: metaRef },
          ] as const).map(({ label, ref }) => (
            <div key={label}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 6 }}>{label}</label>
              <div className="upload-box" onClick={() => ref.current?.click()}>
                <input ref={ref} type="file" accept=".csv" multiple style={{ display: "none" }} />
                📂 클릭하여 파일 선택
              </div>
            </div>
          ))}
        </div>

        <button className="btn btn-dark" onClick={handleAnalyze} style={{ padding: "10px 28px", fontSize: 14 }}>
          분석 시작
        </button>

        {uploadErrors.length > 0 && (
          <div style={{ marginTop: 14, padding: 12, background: "#fef2f2", borderRadius: 10, fontSize: 13, color: "#ef4444" }}>
            {uploadErrors.map((e, i) => <div key={i}>⚠️ {e}</div>)}
          </div>
        )}
      </div>

      {/* ─── 분석 결과 ─── */}
      {hasData && (
        <>
          {/* 전체 요약 */}
          <div className="mk-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
              <div className="sec" style={{ margin: 0 }}>전체 요약</div>
              <button className="btn btn-gray" onClick={() => copy(fullSummary || generateFullSummaryText(month, {
                branch: "ALL", channel: "ALL",
                impressions: detail?.report.total_impressions ?? 0,
                clicks: detail?.report.total_clicks ?? 0,
                results: detail?.report.total_results ?? 0,
                spend: detail?.report.total_spend ?? 0,
                ctr: detail?.report.avg_ctr ?? null,
                cpc: detail?.report.avg_cpc ?? null,
                costPerResult: detail?.report.avg_cost_per_result ?? null,
              }, byChannel as any, byBranch as any))}>전체 요약 복사</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(130px,1fr))", gap: 10 }}>
              {[
                ["총 지출",   fmt(overall?.spend ?? detail?.report.total_spend ?? null, "원")],
                ["총 노출",   fmt(overall?.impressions ?? detail?.report.total_impressions ?? null)],
                ["총 클릭",   fmt(overall?.clicks ?? detail?.report.total_clicks ?? null)],
                ["평균 CTR",  fmtCtr(overall?.ctr ?? detail?.report.avg_ctr ?? null)],
                ["평균 CPC",  fmtCpc(overall?.cpc ?? detail?.report.avg_cpc ?? null)],
                ["총 결과",   fmt(overall?.results ?? detail?.report.total_results ?? null)],
                ["결과당 비용", fmtCpc(overall?.costPerResult ?? detail?.report.avg_cost_per_result ?? null)],
              ].map(([label, value]) => (
                <div className="scard" key={label}>
                  <div className="slabel">{label}</div>
                  <div className="svalue">{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 지점별 */}
          {byBranch.length > 0 && (
            <div className="mk-card">
              <div className="sec">지점별 성과</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(190px,1fr))", gap: 10 }}>
                {byBranch.map((b) => (
                  <div className="scard" key={b.branch}>
                    <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 8 }}>
                      {BRANCH_LABELS[b.branch as MarketingBranch] ?? b.branch}
                    </div>
                    {[["지출", fmt(b.spend, "원")], ["노출", fmt(b.impressions)], ["클릭", fmt(b.clicks)],
                      ["CTR", fmtCtr(b.ctr)], ["CPC", fmtCpc(b.cpc)], ["결과", fmt(b.results)]
                    ].map(([lbl, val]) => (
                      <div key={lbl} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                        <span style={{ color: "#94a3b8" }}>{lbl}</span>
                        <span style={{ fontWeight: 700 }}>{val}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 채널별 */}
          <div className="mk-card">
            <div className="sec">채널별 비교</div>
            <div style={{ overflowX: "auto" }}>
              <table className="mk-table">
                <thead><tr>{["채널","지출","노출","클릭","CTR","CPC","결과","결과당 비용"].map((h) => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>
                  {byChannel.map((c) => (
                    <tr key={c.channel}>
                      <td style={{ fontWeight: 700 }}>{CHANNEL_LABELS[c.channel as MarketingChannel] ?? c.channel}</td>
                      <td>{fmt(c.spend, "원")}</td><td>{fmt(c.impressions)}</td><td>{fmt(c.clicks)}</td>
                      <td>{fmtCtr(c.ctr)}</td><td>{fmtCpc(c.cpc)}</td><td>{fmt(c.results)}</td>
                      <td>{fmtCpc((c as AggRow).cost_per_result ?? (c as AggRow).costPerResult ?? null)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 지점×채널 */}
          <div className="mk-card">
            <div className="sec">지점 × 채널별</div>
            <div style={{ overflowX: "auto" }}>
              <table className="mk-table">
                <thead><tr>{["지점","채널","지출","노출","클릭","CTR","CPC","결과","결과당 비용"].map((h) => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>
                  {byBranchChannel.map((r, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 700 }}>{BRANCH_LABELS[r.branch as MarketingBranch] ?? r.branch}</td>
                      <td>{CHANNEL_LABELS[r.channel as MarketingChannel] ?? r.channel}</td>
                      <td>{fmt(r.spend, "원")}</td><td>{fmt(r.impressions)}</td><td>{fmt(r.clicks)}</td>
                      <td>{fmtCtr(r.ctr)}</td><td>{fmtCpc(r.cpc)}</td><td>{fmt(r.results)}</td>
                      <td>{fmtCpc((r as AggRow).cost_per_result ?? (r as AggRow).costPerResult ?? null)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 소재별 */}
          <div className="mk-card">
            <div className="sec">광고 소재별 상세</div>
            <div style={{ overflowX: "auto" }}>
              <table className="mk-table">
                <thead>
                  <tr>{["판단","지점","채널","캠페인","광고세트","광고명","노출","클릭","CTR","지출","CPC","결과","결과당 비용"].map((h) => <th key={h}>{h}</th>)}</tr>
                </thead>
                <tbody>{renderItemsTable()}</tbody>
              </table>
            </div>
          </div>

          {/* TOP 5 */}
          {(rows.length ? top5rows : detail?.top5 ?? []).length > 0 && (
            <div className="mk-card">
              <div className="sec">🏆 효율 좋은 광고 TOP 5</div>
              <div style={{ overflowX: "auto" }}>
                <table className="mk-table">
                  <thead><tr>{["순위","지점","채널","광고명","클릭","CTR","CPC"].map((h) => <th key={h}>{h}</th>)}</tr></thead>
                  <tbody>
                    {(rows.length ? top5rows : detail?.top5 ?? []).map((r: any, i: number) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 900, color: "#f59e0b" }}>#{i + 1}</td>
                        <td>{BRANCH_LABELS[r.branch as MarketingBranch] ?? r.branch}</td>
                        <td>{CHANNEL_LABELS[r.channel as MarketingChannel] ?? r.channel}</td>
                        <td>{r.adName || r.ad_name || r.campaignName || r.campaign_name || "-"}</td>
                        <td>{fmt(r.effectiveClicks ?? r.effective_clicks)}</td>
                        <td>{fmtCtr(r.ctr)}</td>
                        <td style={{ color: "#16a34a", fontWeight: 700 }}>{fmtCpc(r.cpc)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 주의 광고 */}
          {(rows.length ? warnRows : detail?.warnings ?? []).length > 0 && (
            <div className="mk-card">
              <div className="sec">🔴 정리가 필요한 광고</div>
              <div style={{ overflowX: "auto" }}>
                <table className="mk-table">
                  <thead><tr>{["지점","채널","광고명","지출","클릭","CTR","CPC"].map((h) => <th key={h}>{h}</th>)}</tr></thead>
                  <tbody>
                    {(rows.length ? warnRows : detail?.warnings ?? []).map((r: any, i: number) => (
                      <tr key={i}>
                        <td>{BRANCH_LABELS[r.branch as MarketingBranch] ?? r.branch}</td>
                        <td>{CHANNEL_LABELS[r.channel as MarketingChannel] ?? r.channel}</td>
                        <td>{r.adName || r.ad_name || r.campaignName || r.campaign_name || "-"}</td>
                        <td style={{ color: "#ef4444", fontWeight: 700 }}>{fmt(r.spend, "원")}</td>
                        <td>{fmt(r.effectiveClicks ?? r.effective_clicks)}</td>
                        <td>{fmtCtr(r.ctr)}</td>
                        <td style={{ color: "#ef4444", fontWeight: 700 }}>{fmtCpc(r.cpc)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 요약 문구 */}
          <div className="mk-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
              <div className="sec" style={{ margin: 0 }}>대표 요약 문구</div>
              <button className="btn btn-gray" onClick={() => copy(summaryText)}>복사</button>
            </div>
            <div style={{ background: "#f8fafc", borderRadius: 10, padding: 14, fontSize: 14, lineHeight: 1.8, color: "#1e293b", marginBottom: 20 }}>
              {summaryText || "-"}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
              <div className="sec" style={{ margin: 0 }}>다음 달 액션 제안</div>
              <button className="btn btn-gray" onClick={() => copy(nextActionText)}>복사</button>
            </div>
            <div style={{ background: "#f8fafc", borderRadius: 10, padding: 14, fontSize: 14, lineHeight: 2, color: "#1e293b", whiteSpace: "pre-line" }}>
              {nextActionText || "-"}
            </div>
          </div>

          {/* ─── 대표 보고서 ─── */}
          <div className="mk-card" style={{ border: "1.5px solid #e0e7ff" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
              <div>
                <div className="sec" style={{ margin: 0 }}>📄 대표 보고서</div>
                <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>대표 보고용 전체 텍스트입니다. 복사하거나 파일로 다운로드하세요.</p>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="btn btn-gray" style={{ fontSize: 12 }} onClick={() => handleCopyReport(reportText)}>보고서 복사</button>
                <button className="btn btn-gray" style={{ fontSize: 12 }} onClick={() => handleDownloadTxt(reportText)}>TXT 다운로드</button>
                <button className="btn btn-gray" style={{ fontSize: 12 }} onClick={() => handleDownloadDetailCsv(activeItems)}>상세 CSV</button>
                <button className="btn btn-gray" style={{ fontSize: 12 }} onClick={() => activeOverall && handleDownloadSummaryCsv(activeOverall, byChannel, byBranch)}>요약 CSV</button>
                {(pageStatus === "viewing" && detail) && (
                  <>
                    <button
                      className="btn"
                      style={{ fontSize: 12, background: "#1e293b", color: "#fff" }}
                      onClick={() => handleDownloadDocx(detail.report.id)}
                    >
                      DOCX 다운로드
                    </button>
                    <button
                      className="btn"
                      style={{ fontSize: 12, background: "#7c3aed", color: "#fff" }}
                      onClick={() => window.open(`/hq/marketing-report/${detail.report.id}/print`, "_blank")}
                    >
                      PDF 저장용 화면
                    </button>
                  </>
                )}
              </div>
            </div>
            <pre style={{
              background: "#f8fafc", borderRadius: 12, padding: "18px 20px",
              fontSize: 13, lineHeight: 1.85, color: "#1e293b",
              whiteSpace: "pre-wrap", wordBreak: "break-word",
              fontFamily: "'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif",
              maxHeight: 600, overflowY: "auto", border: "1px solid #e2e8f0",
            }}>
              {reportText || "데이터를 분석하면 보고서가 자동 생성됩니다."}
            </pre>
          </div>
        </>
      )}

      {/* ─── 저장된 리포트 목록 ─── */}
      <div className="mk-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div className="sec" style={{ margin: 0 }}>저장된 리포트 히스토리</div>
          <button className="btn btn-gray" onClick={loadList} style={{ fontSize: 12 }}>새로고침</button>
        </div>

        {listLoading && <div style={{ color: "#94a3b8", fontSize: 13 }}>불러오는 중...</div>}
        {listError && <div style={{ color: "#ef4444", fontSize: 13 }}>{listError}</div>}

        {!listLoading && !listError && reportList.length === 0 && (
          <div style={{ color: "#94a3b8", fontSize: 13 }}>저장된 리포트가 없습니다.</div>
        )}

        {reportList.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table className="mk-table">
              <thead>
                <tr>{["분석 월","제목","총 지출","총 클릭","평균 CPC","저장일",""].map((h) => <th key={h}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {reportList.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 700 }}>{r.report_month}</td>
                    <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</td>
                    <td>{fmt(r.total_spend, "원")}</td>
                    <td>{fmt(r.total_clicks)}</td>
                    <td>{fmtCpc(r.avg_cpc)}</td>
                    <td style={{ color: "#94a3b8", fontSize: 12 }}>{new Date(r.created_at).toLocaleDateString("ko-KR")}</td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="btn btn-blue" style={{ padding: "4px 12px", fontSize: 12 }} onClick={() => handleView(r.id)}>보기</button>
                        <button className="btn btn-red" style={{ padding: "4px 12px", fontSize: 12 }} onClick={() => handleDelete(r.id)}>삭제</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 토스트 */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)",
          background: toastType === "err" ? "#ef4444" : "#111827",
          color: "#fff", padding: "10px 22px", borderRadius: 10,
          fontSize: 13, fontWeight: 700, zIndex: 9999, boxShadow: "0 4px 20px rgba(0,0,0,.25)",
        }}>
          {toast}
        </div>
      )}
    </div>
    </AppShell>
  );
}
