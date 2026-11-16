"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { apiFetch } from "@/lib/api";

const fmt = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};

const today = fmt(new Date());
const getMonthStart = () => { const d = new Date(); d.setDate(1); return fmt(d); };
const getWeekStart = () => { const d = new Date(); d.setDate(d.getDate() - d.getDay()); return fmt(d); };

const money = (v: any) => `${Number(v || 0).toLocaleString()}원`;

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [branch, setBranch] = useState("전체");
  const [startDate, setStartDate] = useState(getMonthStart());
  const [endDate, setEndDate] = useState(today);
  const [user, setUser] = useState<any>(null);
  const [attendStats, setAttendStats] = useState<any>(null);
  const [attendPeriod, setAttendPeriod] = useState("month");
  const [salesDaily, setSalesDaily] = useState<any>(null);
  const [reservStats, setReservStats] = useState<any>(null);
  const [secondary, setSecondary] = useState(false);

  useEffect(() => {
    apiFetch("/api/settings?option_type=BRANCH").then(r => r.json()).then(d => setBranches(d.rows || []));
    const u = JSON.parse(localStorage.getItem("user") || "null");
    if (u) {
      setUser(u);
      if (["ADMIN", "OWNER"].includes(u.role)) loadAttendStats("month", "전체");
      if (u.role === "OWNER") loadSalesDaily("전체");
    }
    apiFetch("/api/reservation-stats").then(r => r.json()).then(d => { if (d.success) setReservStats(d); });
  }, []);

  useEffect(() => {
    loadDashboard();
    const t = setInterval(loadDashboard, 60000);
    return () => clearInterval(t);
  }, [branch, startDate, endDate]);

  useEffect(() => {
    if (user && ["ADMIN", "OWNER"].includes(user.role)) loadAttendStats(attendPeriod, branch);
    if (user?.role === "OWNER") loadSalesDaily(branch);
  }, [branch, user]);

  const loadDashboard = async () => {
    let url = `/api/dashboard?start_date=${startDate}&end_date=${endDate}`;
    if (branch !== "전체") url += `&branch_name=${encodeURIComponent(branch)}`;
    const res = await apiFetch(url);
    setData(await res.json());
  };

  const loadSalesDaily = async (b: string) => {
    let url = "/api/sales-daily";
    if (b !== "전체") url += `?branch_name=${encodeURIComponent(b)}`;
    const res = await apiFetch(url);
    const json = await res.json();
    if (json.success) setSalesDaily(json);
  };

  const loadAttendStats = async (period: string, b: string) => {
    let url = `/api/attendance-stats?period=${period}`;
    url += b !== "전체" ? `&branch_name=${encodeURIComponent(b)}` : "&by_branch=Y";
    const res = await apiFetch(url);
    const json = await res.json();
    if (json.success) setAttendStats(json);
  };

  const setRange = (type: "today" | "week" | "month") => {
    if (type === "today") { setStartDate(today); setEndDate(today); }
    else if (type === "week") { setStartDate(getWeekStart()); setEndDate(today); }
    else { setStartDate(getMonthStart()); setEndDate(today); }
  };

  if (!data) return <AppShell title="대표 대시보드"><div style={{ padding: 48, color: "#9ca3af", fontSize: 14 }}>불러오는 중...</div></AppShell>;

  const branchSales: any[] = data.branch_sales || [];
  const totalSales = Number(data.sales || 0);
  const pm = data.payment_methods || {};

  const totalRereg = branch === "전체"
    ? branchSales.reduce((s: number, b: any) => s + Number(b.rereg_count || 0), 0)
    : Number(branchSales[0]?.rereg_count || 0);

  const isMonth = startDate === getMonthStart() && endDate === today;

  return (
    <AppShell title="대표 대시보드">
      <style>{`
        /* ── 공통 ── */
        .db-card { background:#fff; border:1px solid #e2e5eb; border-radius:10px; overflow:hidden; box-shadow:0 1px 4px rgba(0,0,0,.06); margin-bottom:14px; }
        .db-card-header { padding:13px 20px; border-bottom:1px solid #e2e5eb; display:flex; align-items:center; gap:8px; }
        .db-card-header-dot { width:6px; height:6px; border-radius:50%; background:#0f2044; flex-shrink:0; }
        .db-card-title { font-size:13px; font-weight:700; color:#111827; }
        .db-card-sub { font-size:11px; color:#9ca3af; margin-left:4px; }

        /* ── 필터 ── */
        .filter-bar { display:flex; gap:8px; align-items:center; flex-wrap:wrap; padding:11px 16px; }
        /* select: line-height/inline-flex 금지 — native select는 height만으로 세로 정렬됨 */
        .filter-bar select.input {
          box-sizing: border-box;
          height: 38px;
          padding: 0 10px;
          padding-right: 28px;
          font-size: 13px;
          width: auto;
          -webkit-appearance: auto;
          appearance: auto;
          cursor: pointer;
        }
        /* date input은 inline-flex + align-items 가능 */
        .filter-bar input[type="date"].input {
          box-sizing: border-box;
          height: 38px;
          padding: 0 10px;
          font-size: 13px;
          width: auto;
          display: inline-flex;
          align-items: center;
        }
        .range-btn { height:38px; padding:0 12px; border-radius:6px; border:1px solid #e2e5eb; background:#fff; font-size:13px; font-weight:500; cursor:pointer; color:#374151; }
        .range-btn:hover { background:#f4f5f7; }
        .range-btn.active { background:#0f2044; color:#fff; border-color:#0f2044; }

        /* ── KPI ── */
        .kpi-row { display:grid; grid-template-columns:2fr 1fr 1fr 1fr; gap:12px; margin-bottom:14px; }
        @media(max-width:900px){ .kpi-row { grid-template-columns:1fr 1fr; } }
        .kpi-main { background:#fff; border:1px solid #e2e5eb; border-radius:10px; border-top:3px solid #0f2044; padding:18px 22px; box-shadow:0 1px 4px rgba(0,0,0,.06); }
        .kpi-main-label { font-size:11px; font-weight:700; color:#9ca3af; letter-spacing:.07em; text-transform:uppercase; margin-bottom:6px; }
        .kpi-main-num { font-size:34px; font-weight:800; color:#0f2044; letter-spacing:-.02em; line-height:1.1; font-variant-numeric:tabular-nums; }
        .kpi-main-period { font-size:12px; color:#9ca3af; margin-top:5px; }
        .kpi-side { background:#fff; border:1px solid #e2e5eb; border-radius:10px; padding:16px 18px; box-shadow:0 1px 4px rgba(0,0,0,.06); display:flex; flex-direction:column; gap:5px; }
        .kpi-side-label { font-size:11px; font-weight:700; color:#9ca3af; letter-spacing:.06em; text-transform:uppercase; }
        .kpi-side-num { font-size:26px; font-weight:800; color:#111827; letter-spacing:-.01em; font-variant-numeric:tabular-nums; }
        .kpi-side-sub { font-size:11px; color:#9ca3af; }
        .growth-badge { display:inline-flex; align-items:center; padding:2px 8px; border-radius:999px; font-size:11px; font-weight:700; margin-top:6px; }
        .growth-up { background:#dcfce7; color:#166534; }
        .growth-dn { background:#fee2e2; color:#991b1b; }

        /* ── 지점표 ── */
        .branch-table { width:100%; border-collapse:collapse; font-variant-numeric:tabular-nums; }
        .branch-table th { padding:9px 16px; text-align:right; font-size:11px; font-weight:700; color:#9ca3af; border-bottom:1px solid #e2e5eb; letter-spacing:.04em; white-space:nowrap; }
        .branch-table th:first-child { text-align:left; }
        .branch-table td { padding:12px 16px; text-align:right; font-size:14px; color:#111827; border-bottom:1px solid #f3f4f6; }
        .branch-table td:first-child { text-align:left; }
        .branch-table tr:last-child td { border-bottom:none; }
        .branch-table tr:hover td { background:#f8f9fb; }
        .rank-badge { display:inline-flex; width:20px; height:20px; align-items:center; justify-content:center; border-radius:4px; font-size:10px; font-weight:800; margin-right:7px; }
        .rank-1 { background:#0f2044; color:#fff; }
        .rank-other { background:#f3f4f6; color:#6b7280; }
        .expire-badge { display:inline-block; padding:2px 8px; border-radius:999px; font-size:11px; font-weight:700; }
        .expire-warn { background:#fee2e2; color:#991b1b; }
        .expire-mid { background:#fef3c7; color:#92400e; }

        /* ── 확인할 일 ── */
        .ops-row { display:flex; align-items:center; padding:12px 16px; border-bottom:1px solid #f3f4f6; gap:10px; flex-wrap:wrap; }
        .ops-row:last-child { border-bottom:none; }
        .ops-icon { font-size:18px; min-width:24px; flex-shrink:0; }
        .ops-text { flex:1 1 120px; min-width:0; }
        .ops-label { font-size:14px; font-weight:600; color:#111827; word-break:keep-all; white-space:nowrap; }
        .ops-hint { font-size:11px; color:#9ca3af; margin-top:2px; word-break:keep-all; white-space:normal; }
        .ops-right { display:flex; align-items:center; gap:8px; flex-shrink:0; }
        .ops-count { font-size:20px; font-weight:800; min-width:36px; text-align:right; font-variant-numeric:tabular-nums; }
        .ops-link-btn { padding:5px 11px; border-radius:6px; border:1.5px solid #1d4ed8; background:#eff6ff; color:#1d4ed8; font-size:12px; font-weight:700; cursor:pointer; white-space:nowrap; }
        .ops-link-btn:hover { background:#dbeafe; }
      `}</style>

      {/* 필터 바 */}
      <div className="db-card" style={{ marginBottom: 14 }}>
        <div className="filter-bar">
          {(user?.role === "ADMIN" || user?.role === "OWNER") && (
            <select className="input" style={{ width: 120 }} value={branch} onChange={e => setBranch(e.target.value)}>
              <option>전체</option>
              {branches.map(b => <option key={b.option_id}>{b.option_name}</option>)}
            </select>
          )}
          <input className="input" type="date" style={{ width: 148 }} value={startDate} onChange={e => setStartDate(e.target.value)} />
          <span style={{ color: "#9ca3af", fontSize: 13 }}>~</span>
          <input className="input" type="date" style={{ width: 148 }} value={endDate} onChange={e => setEndDate(e.target.value)} />
          <div style={{ display: "flex", gap: 6 }}>
            {([["오늘", "today"], ["이번 주", "week"], ["이번 달", "month"]] as const).map(([lbl, t]) => (
              <button key={t} className={`range-btn${(t === "month" && isMonth) || (t === "today" && startDate === today && endDate === today) ? " active" : ""}`} onClick={() => setRange(t)}>{lbl}</button>
            ))}
          </div>
          <button className="btn secondary" style={{ height: 38, fontSize: 13, padding: "0 14px", marginLeft: "auto" }} onClick={loadDashboard}>새로고침</button>
        </div>
      </div>

      {/* KPI */}
      <div className="kpi-row">
        <div className="kpi-main">
          <div className="kpi-main-label">매출</div>
          <div className="kpi-main-num">{money(totalSales)}</div>
          <div className="kpi-main-period">{startDate === endDate ? startDate : `${startDate} ~ ${endDate}`}</div>
        </div>
        <div className="kpi-side">
          <div className="kpi-side-label">신규 등록</div>
          <div className="kpi-side-num">{data.new_members || 0}<span style={{ fontSize: 15, fontWeight: 500, color: "#9ca3af" }}>명</span></div>
          <div className="kpi-side-sub">가입일 기준</div>
        </div>
        <div className="kpi-side">
          <div className="kpi-side-label">재등록</div>
          <div className="kpi-side-num">{totalRereg}<span style={{ fontSize: 15, fontWeight: 500, color: "#9ca3af" }}>명</span></div>
          <div className="kpi-side-sub">기존 회원 결제</div>
        </div>
        <div className="kpi-side">
          <div className="kpi-side-label">이용 가능</div>
          <div className="kpi-side-num">{data.active_members || 0}<span style={{ fontSize: 15, fontWeight: 500, color: "#9ca3af" }}>명</span></div>
          <div className="kpi-side-sub">현재 기준</div>
        </div>
      </div>

      {/* 지점별 현황 + 확인할 일 */}
      <div style={{ display: "grid", gridTemplateColumns: branch === "전체" && branchSales.length > 0 ? "1fr 280px" : "1fr", gap: 14, marginBottom: 14, alignItems: "start" }}>

        {/* 지점별 현황 표 */}
        {branch === "전체" && branchSales.length > 0 && (
          <div className="db-card" style={{ marginBottom: 0 }}>
            <div className="db-card-header">
              <div className="db-card-header-dot" />
              <span className="db-card-title">지점별 현황</span>
              <span className="db-card-sub">매출·신규·재등록: 선택기간 / 이용가능·만료예정: 현재</span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="branch-table">
                <thead>
                  <tr>
                    <th style={{ textAlign: "left" }}>지점</th>
                    <th>매출</th>
                    <th>신규</th>
                    <th>재등록</th>
                    <th>이용 가능</th>
                    <th>만료 예정</th>
                  </tr>
                </thead>
                <tbody>
                  {branchSales.map((b: any, idx: number) => (
                    <tr key={b.branch_name}>
                      <td>
                        <span className={`rank-badge ${idx === 0 ? "rank-1" : "rank-other"}`}>{idx + 1}</span>
                        {b.branch_name}
                      </td>
                      <td style={{ fontWeight: idx === 0 ? 800 : 400, color: idx === 0 ? "#0f2044" : "#111827" }}>
                        {Number(b.sales || 0).toLocaleString()}원
                        {b.sales_growth !== null && b.sales_growth !== undefined && (
                          <span style={{ marginLeft: 5, fontSize: 11, fontWeight: 600, color: b.sales_growth >= 0 ? "#16a34a" : "#dc2626" }}>
                            {b.sales_growth >= 0 ? "▲" : "▼"}{Math.abs(b.sales_growth)}%
                          </span>
                        )}
                      </td>
                      <td>{b.new_members || 0}명</td>
                      <td>{b.rereg_count || 0}명</td>
                      <td>{b.active_members || 0}명</td>
                      <td>
                        {(b.expiring_soon || 0) >= 5
                          ? <span className="expire-badge expire-warn">{b.expiring_soon}명</span>
                          : (b.expiring_soon || 0) >= 2
                          ? <span className="expire-badge expire-mid">{b.expiring_soon}명</span>
                          : <span>{b.expiring_soon || 0}명</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 확인할 일 */}
        <div className="db-card" style={{ marginBottom: 0 }}>
          <div className="db-card-header">
            <div className="db-card-header-dot" style={{ background: "#dc2626" }} />
            <span className="db-card-title">확인할 일</span>
          </div>
          {[
            { icon: "⚠", label: "만료 임박 회원", hint: "기간권 3일 이내 · 횟수권 3회 이하", count: data.alert_members || 0, href: "/member-management?tab=만료 예정", warnColor: "#dc2626" },
            { icon: "↩", label: "재연락 필요 상담", hint: "재연락 예정일 경과", count: data.crm_alerts || 0, href: "/crm-alerts", warnColor: "#d97706" },
            { icon: "📅", label: "오늘 만료", hint: "오늘이 만료일인 회원", count: data.today_expire || 0, href: "/member-management?tab=만료·소진", warnColor: "#374151" },
          ].map((item) => (
            <div key={item.label} className="ops-row">
              <div className="ops-icon">{item.icon}</div>
              <div className="ops-text">
                <div className="ops-label">{item.label}</div>
                <div className="ops-hint">{item.hint}</div>
              </div>
              <div className="ops-right">
                <div className="ops-count" style={{ color: item.count > 0 ? item.warnColor : "#9ca3af" }}>{item.count}</div>
                {item.count > 0 && (
                  <a href={item.href} style={{ textDecoration: "none" }}>
                    <div className="ops-link-btn">보기</div>
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 보조 분석 (접기/펼치기) */}
      <div style={{ marginBottom: 14 }}>
        <button
          onClick={() => setSecondary(!secondary)}
          style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#374151", padding: "6px 2px" }}
        >
          <span style={{ fontSize: 10, color: "#9ca3af" }}>{secondary ? "▲" : "▼"}</span>
          {secondary ? "보조 분석 접기" : "보조 분석 펼치기"}
          <span style={{ fontSize: 12, color: "#9ca3af", fontWeight: 400 }}>결제수단 · 예약 비교 · 피크타임 · 일별 매출</span>
        </button>

        {secondary && (
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 14 }}>

            {/* 예약 비교 */}
            {branch === "전체" && reservStats && (
              <div className="db-card" style={{ marginBottom: 0 }}>
                <div className="db-card-header">
                  <div className="db-card-header-dot" />
                  <span className="db-card-title">지점별 예약 비교</span>
                  <span className="db-card-sub">네이버 예약(naver_reservations) 기준</span>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table className="branch-table">
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left" }}>지점</th>
                        <th>{reservStats.this_month}</th>
                        <th style={{ color: "#c4c9d4" }}>{reservStats.prev_month}</th>
                        <th>증감</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reservStats.rows?.map((r: any) => {
                        const diff = r.this_month - r.prev_month;
                        return (
                          <tr key={r.branch_name}>
                            <td style={{ fontWeight: 600 }}>{r.branch_name}</td>
                            <td>{r.this_month}건</td>
                            <td style={{ color: "#9ca3af" }}>{r.prev_month}건</td>
                            <td style={{ fontWeight: 700, color: diff > 0 ? "#16a34a" : diff < 0 ? "#dc2626" : "#9ca3af" }}>
                              {diff > 0 ? `+${diff}` : diff < 0 ? `${diff}` : "–"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 일별 매출 (OWNER) */}
            {user?.role === "OWNER" && salesDaily && (
              <div className="db-card" style={{ marginBottom: 0 }}>
                <div className="db-card-header" style={{ justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div className="db-card-header-dot" />
                    <span className="db-card-title">일별 매출 비교</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#6b7280", fontVariantNumeric: "tabular-nums" }}>
                    {salesDaily.prevMonth} <strong>{salesDaily.prevTotal.toLocaleString()}원</strong>
                    {" · "}
                    {salesDaily.thisMonth} {salesDaily.todayDay}일까지 <strong style={{ color: "#1d4ed8" }}>{salesDaily.thisTotal.toLocaleString()}원</strong>
                    {salesDaily.prevSameDay > 0 && (
                      <span style={{ marginLeft: 8, fontWeight: 700, color: salesDaily.thisTotal >= salesDaily.prevSameDay ? "#16a34a" : "#dc2626" }}>
                        {salesDaily.thisTotal >= salesDaily.prevSameDay ? "▲" : "▼"}
                        {Math.abs(salesDaily.thisTotal - salesDaily.prevSameDay).toLocaleString()}원
                        <span style={{ color: "#9ca3af", fontWeight: 400 }}> 동기간 대비</span>
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ padding: "16px 20px" }}>
                  {(() => {
                    const todayDay = salesDaily.todayDay;
                    const maxVal = Math.max(...salesDaily.days.map((d: any) => Math.max(d.this, d.prev)), 1);
                    return (
                      <div>
                        <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 100, marginBottom: 4 }}>
                          {salesDaily.days.map((d: any) => {
                            const thisPct = Math.round((d.this / maxVal) * 100);
                            const prevPct = Math.round((d.prev / maxVal) * 100);
                            const isFuture = d.day > todayDay;
                            const isToday = d.day === todayDay;
                            return (
                              <div key={d.day} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%", gap: 1 }}>
                                {d.this > 0 && <div title={`${d.day}일 이번달: ${d.this.toLocaleString()}원`} style={{ width: "100%", height: `${thisPct}%`, minHeight: 2, background: isFuture ? "#e2e8f0" : isToday ? "#0f2044" : "#1d4ed8", borderRadius: "2px 2px 0 0" }} />}
                                {d.prev > 0 && d.this === 0 && !isFuture && <div title={`${d.day}일 전달: ${d.prev.toLocaleString()}원`} style={{ width: "100%", height: `${prevPct}%`, minHeight: 2, background: "#bfdbfe", borderRadius: "2px 2px 0 0" }} />}
                                {d.this > 0 && d.prev > 0 && <div style={{ width: "55%", height: `${prevPct}%`, minHeight: 2, background: "#bfdbfe", borderRadius: "2px 2px 0 0", alignSelf: "flex-end" }} />}
                              </div>
                            );
                          })}
                        </div>
                        <div style={{ display: "flex", gap: 2 }}>
                          {salesDaily.days.map((d: any) => (
                            <div key={d.day} style={{ flex: 1, fontSize: 9, textAlign: "center", color: d.day === todayDay ? "#1d4ed8" : "#cbd5e1", fontWeight: d.day === todayDay ? 700 : 400 }}>
                              {d.day % 5 === 1 || d.day === todayDay ? d.day : ""}
                            </div>
                          ))}
                        </div>
                        <div style={{ display: "flex", gap: 14, marginTop: 10, fontSize: 11, color: "#6b7280" }}>
                          <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#1d4ed8", borderRadius: 2, marginRight: 4 }} />{salesDaily.thisMonth}</span>
                          <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#bfdbfe", borderRadius: 2, marginRight: 4 }} />{salesDaily.prevMonth}</span>
                          <span style={{ color: "#9ca3af" }}>오늘({todayDay}일)은 하루 미완료</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* 피크타임 (ADMIN/OWNER) */}
            {user && ["ADMIN", "OWNER"].includes(user.role) && (
              <div className="db-card" style={{ marginBottom: 0 }}>
                <div className="db-card-header" style={{ justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div className="db-card-header-dot" />
                    <span className="db-card-title">피크타임 분석</span>
                    <span className="db-card-sub">출석 기준 · 중복 제외</span>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {[["week","1주"],["month","1개월"],["3month","3개월"]].map(([v, l]) => (
                      <button key={v} onClick={() => { setAttendPeriod(v); loadAttendStats(v, branch); }}
                        style={{ height: 28, padding: "0 10px", borderRadius: 5, fontSize: 12, fontWeight: 600, cursor: "pointer",
                          border: attendPeriod === v ? "none" : "1px solid #e2e5eb",
                          background: attendPeriod === v ? "#0f2044" : "#f8f9fb",
                          color: attendPeriod === v ? "#fff" : "#374151" }}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ padding: "16px 20px" }}>
                  {attendStats && (() => {
                    const hours: any[] = attendStats.hours || [];
                    const days: any[] = attendStats.days || [];
                    const maxH = Math.max(...hours.map(h => h.cnt), 1);
                    const maxD = Math.max(...days.map(d => d.cnt), 1);
                    const peakH = hours.reduce((a: any, b: any) => b.cnt > a.cnt ? b : a, hours[0]);
                    return (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 10 }}>
                            시간대별 입장
                            {peakH && <span style={{ marginLeft: 8, fontSize: 12, color: "#1d4ed8", fontWeight: 700 }}>피크 {peakH.hour}시 ({peakH.cnt}명)</span>}
                          </div>
                          <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 80 }}>
                            {hours.filter(h => h.hour >= 10 && h.hour <= 23).map(h => (
                              <div key={h.hour} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                                <div style={{ width: "100%", borderRadius: "2px 2px 0 0", height: `${Math.round((h.cnt / maxH) * 68)}px`, background: h.hour === peakH?.hour ? "#0f2044" : "#93c5fd", minHeight: h.cnt > 0 ? 2 : 0 }} />
                                {(h.hour % 3 === 1 || h.hour === 10) && <div style={{ fontSize: 9, color: "#9ca3af" }}>{h.hour}</div>}
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 10 }}>요일별 입장</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {days.map(d => (
                              <div key={d.dow} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <div style={{ width: 18, fontSize: 13, fontWeight: 700, color: d.dow === 0 ? "#ef4444" : d.dow === 6 ? "#3b82f6" : "#374151" }}>{d.name}</div>
                                <div style={{ flex: 1, background: "#f3f4f6", borderRadius: 3, height: 14, overflow: "hidden" }}>
                                  <div style={{ width: `${Math.round((d.cnt / maxD) * 100)}%`, height: "100%", background: d.cnt === maxD ? "#0f2044" : "#93c5fd", borderRadius: 3 }} />
                                </div>
                                <div style={{ width: 36, fontSize: 13, color: "#374151", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{d.cnt}명</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

          </div>
        )}
      </div>

    </AppShell>
  );
}
