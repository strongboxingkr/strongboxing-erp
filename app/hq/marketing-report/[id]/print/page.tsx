"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { BRANCH_LABELS, CHANNEL_LABELS, CODE_TO_JUDGEMENT, type JudgementCode } from "@/lib/marketing/types";

const f = (n: number | null | undefined) =>
  n == null || isNaN(n as number) ? "-" : Math.round(n as number).toLocaleString("ko-KR");
const fWon = (n: number | null | undefined) =>
  n == null || isNaN(n as number) ? "-" : `${Math.round(n as number).toLocaleString("ko-KR")}원`;
const fCtr = (n: number | null | undefined) =>
  n == null || isNaN(n as number) ? "-" : `${Number(n).toFixed(2)}%`;
const fCpc = fWon;
const brLabel = (s: string) => BRANCH_LABELS[s as keyof typeof BRANCH_LABELS] ?? s;
const chLabel = (s: string) => CHANNEL_LABELS[s as keyof typeof CHANNEL_LABELS] ?? s;
const jLabel = (s: string) => CODE_TO_JUDGEMENT[s as JudgementCode] ?? s;
const adName = (r: any) =>
  r.ad_name || r.campaign_name || r.adset_name || r.creative_name || "이름 없는 광고";

interface ReportData {
  report: {
    id: number; report_month: string; title: string;
    total_spend: number; total_impressions: number; total_clicks: number; total_results: number;
    avg_ctr: number; avg_cpc: number; avg_cost_per_result: number;
    summary_text: string; next_action_text: string; created_at: string;
  };
  items: any[];
  byBranch: any[]; byChannel: any[]; byBranchChannel: any[];
  top5: any[]; warnings: any[];
}

export default function PrintPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    fetch(`/api/hq/marketing-reports/${id}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setData(json.data);
        else setError("인쇄용 보고서를 불러오지 못했습니다.");
      })
      .catch(() => setError("인쇄용 보고서를 불러오지 못했습니다."));
  }, [id]);

  if (error) return (
    <div style={{ padding: 40, fontFamily: "맑은 고딕, sans-serif" }}>
      <p style={{ color: "#ef4444" }}>{error}</p>
      <button onClick={() => router.back()} style={{ marginTop: 12, cursor: "pointer" }}>돌아가기</button>
    </div>
  );

  if (!data) return (
    <div style={{ padding: 40, fontFamily: "맑은 고딕, sans-serif", color: "#94a3b8" }}>불러오는 중...</div>
  );

  const { report, items, byBranch, byChannel, byBranchChannel, top5, warnings } = data;
  const [y, m] = (report.report_month || "").split("-");
  const monthLabel = y && m ? `${y}년 ${parseInt(m)}월` : report.report_month;

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: "맑은 고딕", "Apple SD Gothic Neo", sans-serif; color: #111827; background: #fff; }
        .page { max-width: 794px; margin: 0 auto; padding: 40px 48px; }
        .no-print { }
        h1 { font-size: 28px; font-weight: 900; color: #111827; }
        h2 { font-size: 17px; font-weight: 800; color: #D01E2E; border-bottom: 2px solid #D01E2E; padding-bottom: 6px; margin: 32px 0 14px; }
        h3 { font-size: 14px; font-weight: 700; color: #374151; margin: 20px 0 8px; }
        p { font-size: 13px; line-height: 1.75; color: #374151; margin-bottom: 6px; }
        .cover { text-align: center; padding: 40px 0 60px; border-bottom: 3px solid #D01E2E; margin-bottom: 40px; }
        .cover .brand { font-size: 16px; font-weight: 700; color: #D01E2E; letter-spacing: 3px; margin-bottom: 12px; }
        .cover .report-title { font-size: 26px; font-weight: 900; margin-bottom: 8px; }
        .cover .sub { font-size: 14px; color: #6b7280; margin-top: 4px; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; margin: 14px 0 24px; }
        .metric-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 16px; }
        .metric-label { font-size: 11px; color: #94a3b8; font-weight: 600; margin-bottom: 4px; }
        .metric-value { font-size: 20px; font-weight: 900; color: #111827; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 8px; page-break-inside: avoid; }
        th { background: #D01E2E; color: #fff; font-weight: 700; padding: 7px 8px; text-align: center; white-space: nowrap; }
        td { padding: 6px 8px; border: 1px solid #e2e8f0; text-align: center; vertical-align: middle; }
        tr:nth-child(even) td { background: #f8fafc; }
        td.right { text-align: right; }
        td.left { text-align: left; }
        .action-line { font-size: 13px; line-height: 1.9; padding: 2px 0; }
        .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #94a3b8; }
        .btn-bar { display: flex; gap: 10px; justify-content: flex-end; margin-bottom: 24px; }
        .btn { border: none; border-radius: 8px; padding: 9px 20px; font-size: 13px; font-weight: 700; cursor: pointer; }
        .btn-print { background: #D01E2E; color: #fff; }
        .btn-back  { background: #f1f5f9; color: #374151; }
        @media print {
          .no-print { display: none !important; }
          body { background: #fff; }
          .page { padding: 20px 32px; max-width: 100%; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; }
          h2 { page-break-after: avoid; }
          @page { size: A4; margin: 18mm 16mm; }
        }
      `}</style>

      <div className="page">
        {/* 컨트롤 바 */}
        <div className="btn-bar no-print">
          <button className="btn btn-back" onClick={() => router.back()}>← 돌아가기</button>
          <button className="btn btn-print" onClick={() => window.print()}>🖨 인쇄 / PDF 저장</button>
        </div>

        {/* 표지 */}
        <div className="cover">
          <div className="brand">STRONG BOXING</div>
          <div className="report-title">광고성과 분석 보고서</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: "10px 0 6px" }}>{report.title || `${monthLabel} 광고성과 분석`}</h1>
          <div className="sub">분석 기간: {monthLabel}</div>
          <div className="sub">생성일: {new Date(report.created_at).toLocaleDateString("ko-KR")}</div>
          <div className="sub" style={{ marginTop: 10 }}>
            채널: {[...new Set(items.map((i: any) => chLabel(i.channel)))].join(" · ") || "-"} &nbsp;|&nbsp;
            지점: {[...new Set(items.map((i: any) => brLabel(i.branch)))].join(" · ") || "-"}
          </div>
        </div>

        {/* 핵심 요약 */}
        <h2>핵심 요약</h2>
        <div className="metrics">
          {[
            ["총 광고비", fWon(report.total_spend)],
            ["총 노출", `${f(report.total_impressions)}회`],
            ["총 클릭", `${f(report.total_clicks)}회`],
            ["평균 CTR", fCtr(report.avg_ctr)],
            ["평균 CPC", fCpc(report.avg_cpc)],
            ["총 결과", report.total_results > 0 ? `${f(report.total_results)}건` : "-"],
            ["결과당 비용", fCpc(report.avg_cost_per_result)],
          ].map(([label, value]) => (
            <div className="metric-card" key={label}>
              <div className="metric-label">{label}</div>
              <div className="metric-value">{value}</div>
            </div>
          ))}
        </div>

        {/* 대표 요약 문장 */}
        {report.summary_text && (
          <>
            <h2>대표 요약</h2>
            {report.summary_text.split("\n").filter(Boolean).map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </>
        )}

        {/* 채널별 */}
        {byChannel.length > 0 && (
          <>
            <h2>채널별 성과</h2>
            <table>
              <thead>
                <tr>
                  {["채널","지출","노출","클릭","CTR","CPC","결과","결과당 비용"].map((h) => <th key={h}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {byChannel.map((c: any) => (
                  <tr key={c.channel}>
                    <td style={{ fontWeight: 700 }}>{chLabel(c.channel)}</td>
                    <td className="right">{fWon(c.spend)}</td>
                    <td>{f(c.impressions)}</td>
                    <td>{f(c.clicks)}</td>
                    <td>{fCtr(c.ctr)}</td>
                    <td className="right">{fCpc(c.cpc)}</td>
                    <td>{f(c.results)}</td>
                    <td className="right">{fCpc(c.cost_per_result)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* 지점별 */}
        {byBranch.length > 0 && (
          <>
            <h2>지점별 성과</h2>
            <table>
              <thead>
                <tr>{["지점","지출","노출","클릭","CTR","CPC","결과","결과당 비용"].map((h) => <th key={h}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {byBranch.map((b: any) => (
                  <tr key={b.branch}>
                    <td style={{ fontWeight: 700 }}>{brLabel(b.branch)}</td>
                    <td className="right">{fWon(b.spend)}</td>
                    <td>{f(b.impressions)}</td>
                    <td>{f(b.clicks)}</td>
                    <td>{fCtr(b.ctr)}</td>
                    <td className="right">{fCpc(b.cpc)}</td>
                    <td>{f(b.results)}</td>
                    <td className="right">{fCpc(b.cost_per_result)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* 지점×채널 */}
        {byBranchChannel.length > 0 && (
          <>
            <h2>지점 × 채널별 성과</h2>
            <table>
              <thead>
                <tr>{["지점","채널","지출","노출","클릭","CTR","CPC","결과","결과당 비용"].map((h) => <th key={h}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {byBranchChannel.map((r: any, i: number) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 700 }}>{brLabel(r.branch)}</td>
                    <td>{chLabel(r.channel)}</td>
                    <td className="right">{fWon(r.spend)}</td>
                    <td>{f(r.impressions)}</td>
                    <td>{f(r.clicks)}</td>
                    <td>{fCtr(r.ctr)}</td>
                    <td className="right">{fCpc(r.cpc)}</td>
                    <td>{f(r.results)}</td>
                    <td className="right">{fCpc(r.cost_per_result)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* TOP 5 */}
        {top5.length > 0 && (
          <>
            <h2>효율 좋은 광고 TOP 5</h2>
            <table>
              <thead>
                <tr>{["순위","지점","채널","광고명","지출","클릭","CTR","CPC","결과"].map((h) => <th key={h}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {top5.map((r: any, i: number) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 900, color: "#f59e0b" }}>#{i + 1}</td>
                    <td>{brLabel(r.branch)}</td>
                    <td>{chLabel(r.channel)}</td>
                    <td className="left" style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{adName(r)}</td>
                    <td className="right">{fWon(r.spend)}</td>
                    <td>{f(r.effective_clicks)}</td>
                    <td>{fCtr(r.ctr)}</td>
                    <td className="right" style={{ color: "#16a34a", fontWeight: 700 }}>{fCpc(r.cpc)}</td>
                    <td>{f(r.results)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* 주의 광고 */}
        {warnings.length > 0 && (
          <>
            <h2>정리가 필요한 광고</h2>
            <table>
              <thead>
                <tr>{["지점","채널","광고명","지출","클릭","CTR","CPC","판단 사유"].map((h) => <th key={h}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {warnings.map((r: any, i: number) => (
                  <tr key={i}>
                    <td>{brLabel(r.branch)}</td>
                    <td>{chLabel(r.channel)}</td>
                    <td className="left" style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{adName(r)}</td>
                    <td className="right" style={{ color: "#ef4444" }}>{fWon(r.spend)}</td>
                    <td>{f(r.effective_clicks)}</td>
                    <td>{fCtr(r.ctr)}</td>
                    <td className="right" style={{ color: "#ef4444" }}>{fCpc(r.cpc)}</td>
                    <td>{r.judgement === "WARNING" ? "CPC 높음 / 클릭 저조" : "데이터 부족"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* 다음 달 액션 */}
        {report.next_action_text && (
          <>
            <h2>다음 달 액션 제안</h2>
            {report.next_action_text.split("\n").filter(Boolean).map((line, i) => (
              <p key={i} className="action-line">{line}</p>
            ))}
          </>
        )}

        {/* 푸터 */}
        <div className="footer">
          스트롱복싱 광고성과 분석 리포트 · {monthLabel}
        </div>
      </div>
    </>
  );
}
