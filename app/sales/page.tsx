"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import { apiFetch } from "@/lib/api";

const now = new Date();
const DAYS = ["일", "월", "화", "수", "목", "금", "토"];
const METHOD: Record<string, string> = { CASH: "현금", CARD: "카드", TRANSFER: "계좌이체" };
const METHOD_COLOR: Record<string, { bg: string; color: string }> = {
  CARD: { bg: "#dbeafe", color: "#1d4ed8" },
  CASH: { bg: "#dcfce7", color: "#15803d" },
  TRANSFER: { bg: "#ede9fe", color: "#7c3aed" },
};

type Tab = "일별" | "월별" | "연별";

const fmt = (n: any) => Number(n || 0).toLocaleString();

function SalesInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const initTab = (sp.get("tab") as Tab) || "월별";

  const [user, setUser] = useState<any>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [branch, setBranch] = useState("전체");
  const [tab, setTab] = useState<Tab>(initTab);

  // 일별
  const [dailyDate, setDailyDate] = useState(now.toISOString().slice(0, 10));
  const [dailyData, setDailyData] = useState<any>(null);

  // 월별
  const [mYear, setMYear] = useState(String(now.getFullYear()));
  const [mMonth, setMMonth] = useState(String(now.getMonth() + 1));
  const [monthlyRows, setMonthlyRows] = useState<any[]>([]);
  const [monthlySelectedDate, setMonthlySelectedDate] = useState<string | null>(null);
  const [monthlyDetail, setMonthlyDetail] = useState<any>(null);

  // 연별
  const [aYear, setAYear] = useState(String(now.getFullYear()));
  const [annualRows, setAnnualRows] = useState<any[]>([]);
  const [annualSelectedMonth, setAnnualSelectedMonth] = useState<number | null>(null);
  const [annualDetail, setAnnualDetail] = useState<any>(null);

  const [loading, setLoading] = useState(false);
  const isAdminOrOwner = user?.role === "ADMIN" || user?.role === "OWNER";

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem("user") || "null");
    setUser(u);
    if (u && u.role !== "ADMIN" && u.role !== "OWNER") setBranch(u.branch_name || "전체");
    apiFetch("/api/settings?option_type=BRANCH").then(r => r.json()).then(d => setBranches(d.rows || []));
  }, []);

  const branchParam = (b = branch) => b !== "전체" ? `&branch_name=${encodeURIComponent(b)}` : "";

  // 일별 로드
  const loadDaily = async (b = branch) => {
    setLoading(true);
    const res = await apiFetch(`/api/daily-sales-detail?date=${dailyDate}${branchParam(b)}`);
    const json = await res.json();
    setDailyData(json.success ? json : null);
    setLoading(false);
  };

  // 월별 로드
  const loadMonthly = async (b = branch) => {
    setLoading(true);
    const res = await apiFetch(`/api/monthly-sales?year=${mYear}&month=${mMonth}${branchParam(b)}`);
    const json = await res.json();
    setMonthlyRows(json.rows || []);
    setMonthlySelectedDate(null);
    setMonthlyDetail(null);
    setLoading(false);
  };

  // 월별 날짜 상세
  const loadMonthlyDetail = async (date: string) => {
    setMonthlySelectedDate(date);
    const res = await apiFetch(`/api/daily-sales-detail?date=${date}${branchParam()}`);
    const json = await res.json();
    setMonthlyDetail(json.success ? json : null);
  };

  // 연별 로드
  const loadAnnual = async (b = branch) => {
    setLoading(true);
    const res = await apiFetch(`/api/sales/annual?year=${aYear}${branchParam(b)}`);
    const json = await res.json();
    setAnnualRows(json.rows || []);
    setAnnualSelectedMonth(null);
    setAnnualDetail(null);
    setLoading(false);
  };

  // 연별 월 상세 (월별 API 재사용)
  const loadAnnualMonthDetail = async (m: number) => {
    setAnnualSelectedMonth(m);
    const res = await apiFetch(`/api/monthly-sales?year=${aYear}&month=${m}${branchParam()}`);
    const json = await res.json();
    setAnnualDetail(json.rows || []);
  };

  useEffect(() => {
    if (!user) return;
    if (tab === "일별") loadDaily();
    else if (tab === "월별") loadMonthly();
    else loadAnnual();
  }, [user, branch, tab]);

  // 엑셀 다운로드
  const download = async () => {
    let url = `/api/sales/export?mode=${tab === "일별" ? "daily" : tab === "월별" ? "monthly" : "annual"}`;
    if (tab === "일별") url += `&date=${dailyDate}`;
    else if (tab === "월별") url += `&year=${mYear}&month=${mMonth}`;
    else url += `&year=${aYear}`;
    if (branch !== "전체") url += `&branch_name=${encodeURIComponent(branch)}`;
    const res = await apiFetch(url);
    if (!res.ok) { alert("내보내기 권한이 없습니다."); return; }
    const blob = await res.blob();
    const cd = res.headers.get("Content-Disposition") || "";
    const match = cd.match(/filename\*=UTF-8''(.+)/);
    const filename = match ? decodeURIComponent(match[1]) : "매출.xlsx";
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  };

  // 월별 집계
  const mCash = monthlyRows.reduce((s, r) => s + Number(r.cash_amount || 0), 0);
  const mCard = monthlyRows.reduce((s, r) => s + Number(r.card_amount || 0), 0);
  const mTrf  = monthlyRows.reduce((s, r) => s + Number(r.transfer_amount || 0), 0);
  const mTot  = monthlyRows.reduce((s, r) => s + Number(r.total_amount || 0), 0);

  // 연별 집계 (1~12월 맵)
  const annualByMonth: Record<number, any> = {};
  annualRows.forEach(r => { annualByMonth[Number(r.month_num)] = r; });
  const aTot = Object.values(annualByMonth).reduce((s: number, r: any) => s + Number(r.total_amount || 0), 0);

  const thStyle: React.CSSProperties = { padding: "9px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#9ca3af", borderBottom: "1px solid #e5e7eb", whiteSpace: "nowrap" };
  const tdStyle: React.CSSProperties = { padding: "9px 12px", verticalAlign: "middle", fontSize: 14 };
  const numStyle: React.CSSProperties = { ...tdStyle, textAlign: "right", fontVariantNumeric: "tabular-nums" };

  return (
    <AppShell title="매출">
      <style>{`
        .sales-tabs { display:flex; gap:0; border-bottom:2px solid #e2e5eb; margin-bottom:14px; }
        .sales-tab { padding:9px 20px; font-size:13px; font-weight:600; color:#6b7280; cursor:pointer; border-bottom:2px solid transparent; margin-bottom:-2px; background:none; border-top:none; border-left:none; border-right:none; }
        .sales-tab.active { color:#0f2044; border-bottom-color:#0f2044; }
        .sales-toolbar { display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-bottom:12px; }
        /* select: line-height/flex 금지 — native select는 height만으로 세로 정렬 */
        .sales-toolbar select.input {
          box-sizing: border-box !important;
          height: 38px !important;
          padding: 0 10px !important;
          padding-right: 28px !important;
          font-size: 13px !important;
          width: auto !important;
          appearance: auto !important;
          -webkit-appearance: auto !important;
        }
        /* input[type=date], input[type=number] 등 non-select */
        .sales-toolbar input.input {
          box-sizing: border-box !important;
          height: 38px !important;
          padding: 0 10px !important;
          font-size: 13px !important;
          width: auto !important;
        }
        .sales-card { background:#fff; border:1px solid #e2e5eb; border-radius:10px; overflow:hidden; }
        .sales-card-title { padding:12px 16px; border-bottom:1px solid #e2e5eb; font-size:14px; font-weight:700; color:#111827; display:flex; justify-content:space-between; align-items:center; }
        .sales-summary { display:grid; border-bottom:1px solid #e2e5eb; }
        .sales-kpi { padding:10px 14px; border-right:1px solid #e2e5eb; text-align:center; }
        .sales-kpi:last-child { border-right:none; }
        .sales-kpi-label { font-size:11px; color:#9ca3af; }
        .sales-kpi-val { font-size:15px; font-weight:800; }
        .sales-tbl { width:100%; border-collapse:collapse; font-size:14px; }
        .sales-tbl th { padding:9px 12px; text-align:left; font-size:11px; font-weight:700; color:#9ca3af; border-bottom:1px solid #e2e5eb; white-space:nowrap; background:#f9fafb; }
        .sales-tbl td { padding:9px 12px; vertical-align:middle; border-bottom:1px solid #f1f3f5; }
        .sales-tbl tr:last-child td { border-bottom:none; }
        .sales-tbl tr.clickable:hover td { background:#f0f7ff; cursor:pointer; }
        .sales-tbl tr.selected td { background:#eff6ff; }
        .sales-num { text-align:right; font-variant-numeric:tabular-nums; }
        .sales-total-row td { font-weight:800; background:#f8faff; color:#0f2044; border-top:2px solid #e2e5eb; }
        .btn-export { height:36px; padding:0 14px; font-size:12px; font-weight:600; border:1px solid #0f2044; border-radius:6px; background:#0f2044; color:#fff; cursor:pointer; white-space:nowrap; }
        .btn-export:hover { background:#1d4ed8; border-color:#1d4ed8; }
        .info-note { font-size:11px; color:#9ca3af; padding:4px 0; }
        @media(max-width:720px){ .sales-summary { grid-template-columns:1fr 1fr !important; } }
      `}</style>

      {/* 탭 */}
      <div className="sales-tabs">
        {(["일별", "월별", "연별"] as Tab[]).map(t => (
          <button key={t} className={`sales-tab${tab === t ? " active" : ""}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {/* ── 일별 ───────────────────────────────── */}
      {tab === "일별" && (
        <>
          <div className="sales-toolbar">
            {isAdminOrOwner ? (
              <select className="input" style={{ width: 130 }} value={branch} onChange={e => { setBranch(e.target.value); loadDaily(e.target.value); }}>
                <option>전체</option>
                {branches.map(b => <option key={b.option_id}>{b.option_name}</option>)}
              </select>
            ) : <span style={{ fontSize: 13, fontWeight: 600 }}>{user?.branch_name}</span>}
            <input className="input" type="date" value={dailyDate} onChange={e => setDailyDate(e.target.value)} />
            <button className="btn" style={{ height: 38 }} onClick={() => loadDaily()}>조회</button>
            {isAdminOrOwner && <button className="btn-export" onClick={download}>엑셀 내보내기</button>}
          </div>

          <div className="sales-card">
            <div className="sales-card-title"><span>{dailyDate} 결제 내역</span><span style={{ fontSize: 13, color: "#6b7280", fontWeight: 400 }}>{dailyData?.rows?.length || 0}건</span></div>
            {dailyData && (
              <div className="sales-summary" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
                {[{ l: "현금", v: dailyData.summary?.cash, c: "#16a34a" }, { l: "카드", v: dailyData.summary?.card, c: "#1d4ed8" }, { l: "계좌이체", v: dailyData.summary?.transfer, c: "#7c3aed" }, { l: "총매출", v: dailyData.summary?.total, c: "#d97706" }].map(k => (
                  <div key={k.l} className="sales-kpi"><div className="sales-kpi-label">{k.l}</div><div className="sales-kpi-val" style={{ color: k.c }}>{fmt(k.v)}</div></div>
                ))}
              </div>
            )}
            <div style={{ overflowX: "auto" }}>
              <table className="sales-tbl">
                <thead><tr><th>회원</th><th>상품</th><th>결제</th><th className="sales-num">실결제액</th>{isAdminOrOwner && <th>시각</th>}<th>메모</th></tr></thead>
                <tbody>
                  {loading ? <tr><td colSpan={6} style={{ textAlign: "center", padding: 28, color: "#9ca3af" }}>불러오는 중...</td></tr>
                    : !dailyData?.rows?.length ? <tr><td colSpan={6} style={{ textAlign: "center", padding: 28, color: "#9ca3af" }}>결제 내역이 없습니다.</td></tr>
                    : dailyData.rows.map((r: any) => {
                      const mc = METHOD_COLOR[r.payment_method] || { bg: "#f3f4f6", color: "#374151" };
                      return (
                        <tr key={r.payment_id}>
                          <td style={{ fontWeight: 600 }}>
                            {branch === "전체" && r.branch_name && <span style={{ fontSize: 11, color: "#94a3b8", marginRight: 4 }}>[{r.branch_name.replace("점", "")}]</span>}
                            {r.member_name || "-"}
                          </td>
                          <td>{r.product_name || "-"}</td>
                          <td><span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 12, fontWeight: 700, background: mc.bg, color: mc.color }}>{METHOD[r.payment_method] || r.payment_method}</span></td>
                          <td className="sales-num" style={{ fontWeight: 700 }}>{fmt(r.final_amount)}</td>
                          {isAdminOrOwner && <td style={{ color: "#6b7280", fontSize: 12 }}>{String(r.created_at || "").slice(11, 16)}</td>}
                          <td style={{ color: "#9ca3af", fontSize: 12 }}>{r.memo || ""}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── 월별 ───────────────────────────────── */}
      {tab === "월별" && (
        <>
          <div className="sales-toolbar">
            {isAdminOrOwner ? (
              <select className="input" style={{ width: 130 }} value={branch} onChange={e => { setBranch(e.target.value); loadMonthly(e.target.value); }}>
                <option>전체</option>
                {branches.map(b => <option key={b.option_id}>{b.option_name}</option>)}
              </select>
            ) : <span style={{ fontSize: 13, fontWeight: 600 }}>{user?.branch_name}</span>}
            <select className="input" style={{ width: 100 }} value={mYear} onChange={e => setMYear(e.target.value)}>
              {[2023, 2024, 2025, 2026, 2027].map(y => <option key={y}>{y}</option>)}
            </select>
            <select className="input" style={{ width: 80 }} value={mMonth} onChange={e => setMMonth(e.target.value)}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{m}월</option>)}
            </select>
            <button className="btn" style={{ height: 38 }} onClick={() => loadMonthly()}>조회</button>
            {isAdminOrOwner && <button className="btn-export" onClick={download}>엑셀 내보내기</button>}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: monthlySelectedDate ? "minmax(0,1fr) minmax(0,1fr)" : "1fr", gap: 14 }}>
            <div className="sales-card">
              <div className="sales-card-title">{mYear}년 {mMonth}월 일자별 매출</div>
              <div className="sales-summary" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
                {[{ l: "현금", v: mCash, c: "#16a34a" }, { l: "카드", v: mCard, c: "#1d4ed8" }, { l: "계좌이체", v: mTrf, c: "#7c3aed" }, { l: "총매출", v: mTot, c: "#d97706" }].map(k => (
                  <div key={k.l} className="sales-kpi"><div className="sales-kpi-label">{k.l}</div><div className="sales-kpi-val" style={{ color: k.c }}>{fmt(k.v)}</div></div>
                ))}
              </div>
              <div style={{ overflowX: "auto" }}>
                <table className="sales-tbl">
                  <thead><tr><th>일</th><th>요일</th><th className="sales-num">현금</th><th className="sales-num">카드</th><th className="sales-num">계좌</th><th className="sales-num">총매출</th><th className="sales-num">건수</th></tr></thead>
                  <tbody>
                    {loading ? <tr><td colSpan={7} style={{ textAlign: "center", padding: 28, color: "#9ca3af" }}>불러오는 중...</td></tr>
                      : monthlyRows.length === 0 ? <tr><td colSpan={7} style={{ textAlign: "center", padding: 28, color: "#9ca3af" }}>결제 내역이 없습니다.</td></tr>
                      : monthlyRows.map(r => {
                        const dow = Number(r.dow) - 1;
                        const isSelected = monthlySelectedDate === r.sale_date;
                        return (
                          <tr key={r.sale_date} className={`clickable${isSelected ? " selected" : ""}`} onClick={() => loadMonthlyDetail(r.sale_date)}>
                            <td style={{ fontWeight: 700 }}>{Number(r.sale_day)}일</td>
                            <td style={{ color: dow === 0 ? "#ef4444" : dow === 6 ? "#3b82f6" : "#374151" }}>{DAYS[dow] ?? ""}</td>
                            <td className="sales-num">{Number(r.cash_amount) > 0 ? fmt(r.cash_amount) : "-"}</td>
                            <td className="sales-num">{Number(r.card_amount) > 0 ? fmt(r.card_amount) : "-"}</td>
                            <td className="sales-num">{Number(r.transfer_amount) > 0 ? fmt(r.transfer_amount) : "-"}</td>
                            <td className="sales-num" style={{ fontWeight: 800, color: "#d97706" }}>{fmt(r.total_amount)}</td>
                            <td className="sales-num" style={{ color: "#9ca3af" }}>{r.count}</td>
                          </tr>
                        );
                      })}
                    {monthlyRows.length > 0 && (
                      <tr className="sales-total-row">
                        <td colSpan={2}>합계</td>
                        <td className="sales-num">{fmt(mCash)}</td>
                        <td className="sales-num">{fmt(mCard)}</td>
                        <td className="sales-num">{fmt(mTrf)}</td>
                        <td className="sales-num">{fmt(mTot)}</td>
                        <td className="sales-num">{monthlyRows.reduce((s, r) => s + Number(r.count || 0), 0)}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {monthlySelectedDate && monthlyDetail && (
              <div className="sales-card">
                <div className="sales-card-title">
                  <span>{monthlySelectedDate} 상세</span>
                  <button onClick={() => { setMonthlySelectedDate(null); setMonthlyDetail(null); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 18 }}>✕</button>
                </div>
                <div className="sales-summary" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
                  {[{ l: "현금", v: monthlyDetail.summary?.cash, c: "#16a34a" }, { l: "카드", v: monthlyDetail.summary?.card, c: "#1d4ed8" }, { l: "계좌", v: monthlyDetail.summary?.transfer, c: "#7c3aed" }, { l: "총매출", v: monthlyDetail.summary?.total, c: "#d97706" }].map(k => (
                    <div key={k.l} className="sales-kpi"><div className="sales-kpi-label">{k.l}</div><div className="sales-kpi-val" style={{ color: k.c }}>{fmt(k.v)}</div></div>
                  ))}
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table className="sales-tbl">
                    <thead><tr><th>회원</th><th>상품</th><th>결제</th><th className="sales-num">금액</th></tr></thead>
                    <tbody>
                      {monthlyDetail.rows?.map((r: any) => {
                        const mc = METHOD_COLOR[r.payment_method] || { bg: "#f3f4f6", color: "#374151" };
                        return (
                          <tr key={r.payment_id}>
                            <td style={{ fontWeight: 600 }}>{r.member_name || "-"}</td>
                            <td style={{ fontSize: 13 }}>{r.product_name || "-"}</td>
                            <td><span style={{ padding: "2px 7px", borderRadius: 5, fontSize: 11, fontWeight: 700, background: mc.bg, color: mc.color }}>{METHOD[r.payment_method] || r.payment_method}</span></td>
                            <td className="sales-num" style={{ fontWeight: 700, color: "#d97706" }}>{fmt(r.final_amount)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── 연별 ───────────────────────────────── */}
      {tab === "연별" && (
        <>
          <div className="sales-toolbar">
            {isAdminOrOwner ? (
              <select className="input" style={{ width: 130 }} value={branch} onChange={e => { setBranch(e.target.value); loadAnnual(e.target.value); }}>
                <option>전체</option>
                {branches.map(b => <option key={b.option_id}>{b.option_name}</option>)}
              </select>
            ) : <span style={{ fontSize: 13, fontWeight: 600 }}>{user?.branch_name}</span>}
            <select className="input" style={{ width: 100 }} value={aYear} onChange={e => setAYear(e.target.value)}>
              {[2023, 2024, 2025, 2026, 2027].map(y => <option key={y}>{y}</option>)}
            </select>
            <button className="btn" style={{ height: 38 }} onClick={() => loadAnnual()}>조회</button>
            {isAdminOrOwner && <button className="btn-export" onClick={download}>엑셀 내보내기</button>}
          </div>
          <div className="info-note" style={{ marginBottom: 8 }}>지출·차액은 별도 지출 등록 기능이 없어 미집계 표시됩니다. 차액 열은 엑셀 내보내기에 "매출-등록지출"로 표기됩니다.</div>

          <div style={{ display: "grid", gridTemplateColumns: annualSelectedMonth !== null ? "minmax(0,1fr) minmax(0,1fr)" : "1fr", gap: 14 }}>
            <div className="sales-card">
              <div className="sales-card-title"><span>{aYear}년 월별 집계</span><span style={{ fontSize: 13, color: "#6b7280", fontWeight: 400 }}>연간 {fmt(aTot)}원</span></div>
              <div style={{ overflowX: "auto" }}>
                <table className="sales-tbl">
                  <thead><tr><th>월</th><th className="sales-num">현금</th><th className="sales-num">카드</th><th className="sales-num">계좌이체</th><th className="sales-num">기타</th><th className="sales-num">총매출</th><th className="sales-num">건수</th></tr></thead>
                  <tbody>
                    {loading ? <tr><td colSpan={7} style={{ textAlign: "center", padding: 28, color: "#9ca3af" }}>불러오는 중...</td></tr>
                      : Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
                        const r = annualByMonth[m];
                        const isSelected = annualSelectedMonth === m;
                        return (
                          <tr key={m} className={`clickable${isSelected ? " selected" : ""}`} onClick={() => loadAnnualMonthDetail(m)}>
                            <td style={{ fontWeight: 700, color: isSelected ? "#1d4ed8" : "#374151" }}>{m}월</td>
                            <td className="sales-num">{r && Number(r.cash_amount) > 0 ? fmt(r.cash_amount) : "-"}</td>
                            <td className="sales-num">{r && Number(r.card_amount) > 0 ? fmt(r.card_amount) : "-"}</td>
                            <td className="sales-num">{r && Number(r.transfer_amount) > 0 ? fmt(r.transfer_amount) : "-"}</td>
                            <td className="sales-num">{r && Number(r.other_amount) > 0 ? fmt(r.other_amount) : "-"}</td>
                            <td className="sales-num" style={{ fontWeight: 800, color: r ? "#d97706" : "#9ca3af" }}>{r ? fmt(r.total_amount) : "-"}</td>
                            <td className="sales-num" style={{ color: "#9ca3af" }}>{r ? r.count : "-"}</td>
                          </tr>
                        );
                      })}
                    {Object.keys(annualByMonth).length > 0 && (
                      <tr className="sales-total-row">
                        <td>합계</td>
                        <td className="sales-num">{fmt(annualRows.reduce((s, r) => s + Number(r.cash_amount || 0), 0))}</td>
                        <td className="sales-num">{fmt(annualRows.reduce((s, r) => s + Number(r.card_amount || 0), 0))}</td>
                        <td className="sales-num">{fmt(annualRows.reduce((s, r) => s + Number(r.transfer_amount || 0), 0))}</td>
                        <td className="sales-num">{fmt(annualRows.reduce((s, r) => s + Number(r.other_amount || 0), 0))}</td>
                        <td className="sales-num">{fmt(aTot)}</td>
                        <td className="sales-num">{annualRows.reduce((s, r) => s + Number(r.count || 0), 0)}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {annualSelectedMonth !== null && annualDetail && (
              <div className="sales-card">
                <div className="sales-card-title">
                  <span>{aYear}년 {annualSelectedMonth}월 일자별</span>
                  <button onClick={() => { setAnnualSelectedMonth(null); setAnnualDetail(null); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 18 }}>✕</button>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table className="sales-tbl">
                    <thead><tr><th>일</th><th className="sales-num">현금</th><th className="sales-num">카드</th><th className="sales-num">계좌</th><th className="sales-num">총매출</th></tr></thead>
                    <tbody>
                      {annualDetail.length === 0 ? <tr><td colSpan={5} style={{ textAlign: "center", padding: 28, color: "#9ca3af" }}>내역 없음</td></tr>
                        : annualDetail.map((r: any) => (
                          <tr key={r.sale_date}>
                            <td style={{ fontWeight: 600 }}>{Number(r.sale_day)}일</td>
                            <td className="sales-num">{Number(r.cash_amount) > 0 ? fmt(r.cash_amount) : "-"}</td>
                            <td className="sales-num">{Number(r.card_amount) > 0 ? fmt(r.card_amount) : "-"}</td>
                            <td className="sales-num">{Number(r.transfer_amount) > 0 ? fmt(r.transfer_amount) : "-"}</td>
                            <td className="sales-num" style={{ fontWeight: 800, color: "#d97706" }}>{fmt(r.total_amount)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </AppShell>
  );
}

export default function SalesPage() {
  return <Suspense><SalesInner /></Suspense>;
}
