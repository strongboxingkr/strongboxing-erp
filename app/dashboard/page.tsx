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

  // 선택 기간 재등록 합산 (branch_sales에만 있음)
  const totalRereg = branch === "전체"
    ? branchSales.reduce((s: number, b: any) => s + Number(b.rereg_count || 0), 0)
    : Number(branchSales[0]?.rereg_count || 0);

  const isMonth = startDate === getMonthStart() && endDate === today;

  return (
    <AppShell title="대표 대시보드">
      <style>{`
        .db-section { background:#fff; border:1px solid #e5e7eb; border-radius:8px; padding:18px 20px; margin-bottom:14px; }
        .db-section-title { font-size:13px; font-weight:700; color:#374151; margin-bottom:14px; letter-spacing:.02em; text-transform:uppercase; }
        .kpi-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:1px; background:#e5e7eb; border:1px solid #e5e7eb; border-radius:8px; overflow:hidden; }
        @media(max-width:900px){ .kpi-grid { grid-template-columns:1fr 1fr; } }
        .kpi-cell { background:#fff; padding:16px 20px; }
        .kpi-num { font-size:26px; font-weight:800; color:#111827; line-height:1.1; margin-bottom:4px; }
        .kpi-label { font-size:12px; color:#6b7280; font-weight:500; }
        .kpi-sub { font-size:11px; color:#9ca3af; margin-top:2px; }
        .branch-table { width:100%; border-collapse:collapse; font-size:13px; }
        .branch-table th { padding:9px 14px; text-align:right; font-size:11px; font-weight:600; color:#6b7280; border-bottom:2px solid #e5e7eb; white-space:nowrap; }
        .branch-table th:first-child { text-align:left; }
        .branch-table td { padding:11px 14px; text-align:right; color:#111827; border-bottom:1px solid #f3f4f6; }
        .branch-table td:first-child { text-align:left; font-weight:600; }
        .branch-table tr:last-child td { border-bottom:none; }
        .branch-table tr:hover td { background:#f9fafb; }
        .ops-item { display:flex; align-items:center; justify-content:space-between; padding:11px 0; border-bottom:1px solid #f3f4f6; }
        .ops-item:last-child { border-bottom:none; }
        .ops-label { font-size:14px; color:#374151; }
        .ops-count { font-size:20px; font-weight:800; }
        .filter-bar { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
        .range-btn { height:34px; padding:0 12px; border-radius:6px; border:1px solid #e5e7eb; background:#fff; font-size:13px; font-weight:500; cursor:pointer; color:#374151; }
        .range-btn:hover { background:#f9fafb; }
      `}</style>

      {/* 필터 바 */}
      <div className="db-section" style={{ padding: "12px 16px", marginBottom: 14 }}>
        <div className="filter-bar">
          {(user?.role === "ADMIN" || user?.role === "OWNER") && (
            <select className="input" style={{ height: 34, fontSize: 13, width: 110 }} value={branch} onChange={e => setBranch(e.target.value)}>
              <option>전체</option>
              {branches.map(b => <option key={b.option_id}>{b.option_name}</option>)}
            </select>
          )}
          <input className="input" type="date" style={{ height: 34, width: 140, fontSize: 13 }} value={startDate} onChange={e => setStartDate(e.target.value)} />
          <span style={{ color: "#9ca3af", fontSize: 13 }}>~</span>
          <input className="input" type="date" style={{ height: 34, width: 140, fontSize: 13 }} value={endDate} onChange={e => setEndDate(e.target.value)} />
          <div style={{ display: "flex", gap: 6 }}>
            {([["오늘", "today"], ["이번 주", "week"], ["이번 달", "month"]] as const).map(([lbl, t]) => (
              <button key={t} className="range-btn" onClick={() => setRange(t)}>{lbl}</button>
            ))}
          </div>
          <button className="btn secondary" style={{ height: 34, fontSize: 13, marginLeft: "auto" }} onClick={loadDashboard}>새로고침</button>
        </div>
      </div>

      {/* KPI */}
      <div className="kpi-grid" style={{ marginBottom: 14 }}>
        <div className="kpi-cell">
          <div className="kpi-num">{money(totalSales)}</div>
          <div className="kpi-label">매출</div>
          <div className="kpi-sub">{startDate === endDate ? startDate : `${startDate} ~ ${endDate}`}</div>
        </div>
        <div className="kpi-cell">
          <div className="kpi-num">{data.new_members || 0}<span style={{ fontSize: 16, fontWeight: 500, color: "#6b7280" }}>명</span></div>
          <div className="kpi-label">신규 등록</div>
          <div className="kpi-sub">가입일 기준 · 선택 기간</div>
        </div>
        <div className="kpi-cell">
          <div className="kpi-num">{totalRereg}<span style={{ fontSize: 16, fontWeight: 500, color: "#6b7280" }}>명</span></div>
          <div className="kpi-label">재등록</div>
          <div className="kpi-sub">선택 기간 결제 · 기존 회원</div>
        </div>
        <div className="kpi-cell">
          <div className="kpi-num">{data.active_members || 0}<span style={{ fontSize: 16, fontWeight: 500, color: "#6b7280" }}>명</span></div>
          <div className="kpi-label">현재 이용 가능 회원</div>
          <div className="kpi-sub">만료일·잔여 횟수 기준 · 현재</div>
        </div>
      </div>

      {/* 지점별 현황 표 */}
      {branch === "전체" && branchSales.length > 0 && (
        <div className="db-section">
          <div className="db-section-title">지점별 현황</div>
          <div style={{ overflowX: "auto" }}>
            <table className="branch-table">
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>지점</th>
                  <th>매출</th>
                  <th>신규</th>
                  <th>재등록</th>
                  <th>이용 가능</th>
                  <th>만료 예정<br /><span style={{ fontWeight: 400 }}>(7일 이내)</span></th>
                </tr>
              </thead>
              <tbody>
                {branchSales.map((b: any) => (
                  <tr key={b.branch_name}>
                    <td>{b.branch_name}</td>
                    <td>
                      {Number(b.sales || 0).toLocaleString()}원
                      {b.sales_growth !== null && b.sales_growth !== undefined && (
                        <span style={{ marginLeft: 6, fontSize: 11, color: b.sales_growth >= 0 ? "#16a34a" : "#dc2626" }}>
                          {b.sales_growth >= 0 ? "▲" : "▼"}{Math.abs(b.sales_growth)}%
                        </span>
                      )}
                    </td>
                    <td>{b.new_members || 0}명</td>
                    <td>{b.rereg_count || 0}명</td>
                    <td>{b.active_members || 0}명</td>
                    <td style={{ color: (b.expiring_soon || 0) > 0 ? "#dc2626" : "#374151" }}>
                      {b.expiring_soon || 0}명
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 10 }}>
            매출·신규·재등록은 선택 기간 기준. 이용 가능·만료 예정은 현재 기준.
            {data.comparison_label && ` 증감: ${data.comparison_label}.`}
          </div>
        </div>
      )}

      {/* 확인할 일 */}
      <div className="db-section">
        <div className="db-section-title">확인할 일</div>
        <div>
          {[
            {
              label: "만료 임박 회원",
              desc: "만료일 7일 이내 또는 횟수권 3회 이하",
              count: data.alert_members || 0,
              href: "/member-alerts",
              warn: (data.alert_members || 0) > 0,
            },
            {
              label: "재연락 필요 상담",
              desc: "재연락 예정일이 오늘 이전",
              count: data.crm_alerts || 0,
              href: "/crm-alerts",
              warn: (data.crm_alerts || 0) > 0,
            },
            {
              label: "오늘 만료",
              desc: "오늘이 만료일인 활성 회원",
              count: data.today_expire || 0,
              href: "/member-expiring",
              warn: (data.today_expire || 0) > 0,
            },
          ].map((item) => (
            <div key={item.label} className="ops-item">
              <div>
                <div className="ops-label">{item.label}</div>
                <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{item.desc}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span className="ops-count" style={{ color: item.warn ? "#dc2626" : "#9ca3af" }}>
                  {item.count}건
                </span>
                {item.count > 0 && (
                  <a href={item.href} style={{ fontSize: 12, color: "#2563eb", fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap" }}>
                    보기 →
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
          style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#374151", padding: "6px 0" }}
        >
          <span style={{ fontSize: 11 }}>{secondary ? "▲" : "▼"}</span>
          {secondary ? "보조 분석 접기" : "보조 분석 펼치기"}
          <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 400 }}>결제수단 · 예약 비교 · 피크타임 · 일별 매출</span>
        </button>

        {secondary && (
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 14 }}>

            {/* 결제수단 비율 */}
            <div className="db-section" style={{ marginBottom: 0 }}>
              <div className="db-section-title">결제수단 비율</div>
              {totalSales === 0 ? (
                <div style={{ color: "#9ca3af", fontSize: 13 }}>해당 기간 매출 없음</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[
                    { label: "카드", amt: Number(pm.CARD || 0), color: "#2563eb" },
                    { label: "현금", amt: Number(pm.CASH || 0), color: "#16a34a" },
                    { label: "계좌이체", amt: Number(pm.TRANSFER || 0), color: "#7c3aed" },
                  ].map(({ label, amt, color }) => {
                    const p = totalSales > 0 ? Math.round((amt / totalSales) * 100) : 0;
                    return (
                      <div key={label}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                          <span style={{ fontSize: 13, color: "#374151" }}>{label}</span>
                          <span style={{ fontSize: 13, color: "#111827", fontWeight: 600 }}>{money(amt)} <span style={{ color: "#9ca3af", fontWeight: 400, fontSize: 12 }}>{p}%</span></span>
                        </div>
                        <div style={{ background: "#f3f4f6", borderRadius: 4, height: 6, overflow: "hidden" }}>
                          <div style={{ width: `${p}%`, height: "100%", background: color, borderRadius: 4, transition: "width .4s" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 예약 비교 */}
            {branch === "전체" && reservStats && (
              <div className="db-section" style={{ marginBottom: 0 }}>
                <div className="db-section-title">지점별 예약 비교 (네이버 예약 기준)</div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
                        <th style={{ padding: "8px 12px", textAlign: "left", fontSize: 11, color: "#6b7280", fontWeight: 600 }}>지점</th>
                        <th style={{ padding: "8px 12px", textAlign: "right", fontSize: 11, color: "#6b7280", fontWeight: 600 }}>{reservStats.this_month}</th>
                        <th style={{ padding: "8px 12px", textAlign: "right", fontSize: 11, color: "#6b7280", fontWeight: 600 }}>{reservStats.prev_month}</th>
                        <th style={{ padding: "8px 12px", textAlign: "right", fontSize: 11, color: "#6b7280", fontWeight: 600 }}>증감</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reservStats.rows?.map((r: any) => {
                        const diff = r.this_month - r.prev_month;
                        return (
                          <tr key={r.branch_name} style={{ borderBottom: "1px solid #f3f4f6" }}>
                            <td style={{ padding: "9px 12px", fontWeight: 600 }}>{r.branch_name}</td>
                            <td style={{ padding: "9px 12px", textAlign: "right" }}>{r.this_month}건</td>
                            <td style={{ padding: "9px 12px", textAlign: "right", color: "#9ca3af" }}>{r.prev_month}건</td>
                            <td style={{ padding: "9px 12px", textAlign: "right", fontSize: 12, fontWeight: 600, color: diff > 0 ? "#16a34a" : diff < 0 ? "#dc2626" : "#9ca3af" }}>
                              {diff > 0 ? `+${diff}` : diff < 0 ? `${diff}` : "–"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 8 }}>
                  naver_reservations 테이블 기준. calendar_events와 수치가 다를 수 있음 (미확인).
                </div>
              </div>
            )}

            {/* 일별 매출 (OWNER) */}
            {user?.role === "OWNER" && salesDaily && (
              <div className="db-section" style={{ marginBottom: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, flexWrap: "wrap", gap: 6 }}>
                  <div className="db-section-title" style={{ marginBottom: 0 }}>일별 매출 비교</div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>
                    {salesDaily.prevMonth} 합계 <strong>{salesDaily.prevTotal.toLocaleString()}원</strong>
                    {" · "}
                    {salesDaily.thisMonth} {salesDaily.todayDay}일까지 <strong style={{ color: "#2563eb" }}>{salesDaily.thisTotal.toLocaleString()}원</strong>
                    {salesDaily.prevSameDay > 0 && (
                      <span style={{ marginLeft: 8, color: salesDaily.thisTotal >= salesDaily.prevSameDay ? "#16a34a" : "#dc2626", fontWeight: 600 }}>
                        {salesDaily.thisTotal >= salesDaily.prevSameDay ? "▲" : "▼"}
                        {Math.abs(salesDaily.thisTotal - salesDaily.prevSameDay).toLocaleString()}원
                        <span style={{ color: "#9ca3af", fontWeight: 400 }}> (동기간 대비)</span>
                      </span>
                    )}
                  </div>
                </div>
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
                              {d.this > 0 && <div title={`${d.day}일 이번달: ${d.this.toLocaleString()}원`} style={{ width: "100%", height: `${thisPct}%`, minHeight: 2, background: isFuture ? "#e2e8f0" : isToday ? "#1d4ed8" : "#2563eb", borderRadius: "2px 2px 0 0" }} />}
                              {d.prev > 0 && d.this === 0 && !isFuture && <div title={`${d.day}일 전달: ${d.prev.toLocaleString()}원`} style={{ width: "100%", height: `${prevPct}%`, minHeight: 2, background: "#bfdbfe", borderRadius: "2px 2px 0 0" }} />}
                              {d.this > 0 && d.prev > 0 && <div style={{ width: "55%", height: `${prevPct}%`, minHeight: 2, background: "#bfdbfe", borderRadius: "2px 2px 0 0", alignSelf: "flex-end", marginBottom: 0 }} />}
                            </div>
                          );
                        })}
                      </div>
                      <div style={{ display: "flex", gap: 2 }}>
                        {salesDaily.days.map((d: any) => (
                          <div key={d.day} style={{ flex: 1, fontSize: 9, textAlign: "center", color: d.day === todayDay ? "#2563eb" : "#cbd5e1", fontWeight: d.day === todayDay ? 700 : 400 }}>
                            {d.day % 5 === 1 || d.day === todayDay ? d.day : ""}
                          </div>
                        ))}
                      </div>
                      <div style={{ display: "flex", gap: 14, marginTop: 8, fontSize: 11, color: "#6b7280" }}>
                        <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#2563eb", borderRadius: 2, marginRight: 4 }} />{salesDaily.thisMonth}</span>
                        <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#bfdbfe", borderRadius: 2, marginRight: 4 }} />{salesDaily.prevMonth}</span>
                        <span style={{ color: "#9ca3af" }}>* 오늘({todayDay}일)은 하루 미완료</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* 피크타임 (ADMIN/OWNER) */}
            {user && ["ADMIN", "OWNER"].includes(user.role) && (
              <div className="db-section" style={{ marginBottom: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div className="db-section-title" style={{ marginBottom: 0 }}>피크타임 분석 · 출석 기준 (중복 제외 인원)</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {[["week","1주"],["month","1개월"],["3month","3개월"]].map(([v, l]) => (
                      <button key={v} onClick={() => { setAttendPeriod(v); loadAttendStats(v, branch); }}
                        style={{ height: 30, padding: "0 10px", borderRadius: 5, fontSize: 12, fontWeight: 600, cursor: "pointer",
                          border: attendPeriod === v ? "none" : "1px solid #e5e7eb",
                          background: attendPeriod === v ? "#2563eb" : "#f9fafb",
                          color: attendPeriod === v ? "#fff" : "#374151" }}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
                {attendStats && (() => {
                  const hours: any[] = attendStats.hours || [];
                  const days: any[] = attendStats.days || [];
                  const maxH = Math.max(...hours.map(h => h.cnt), 1);
                  const maxD = Math.max(...days.map(d => d.cnt), 1);
                  const peakH = hours.reduce((a: any, b: any) => b.cnt > a.cnt ? b : a, hours[0]);
                  return (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 10 }}>
                          시간대별 입장
                          {peakH && <span style={{ marginLeft: 8, color: "#2563eb" }}>피크 {peakH.hour}시 ({peakH.cnt}명)</span>}
                        </div>
                        <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 72 }}>
                          {hours.filter(h => h.hour >= 10 && h.hour <= 23).map(h => (
                            <div key={h.hour} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                              <div style={{ width: "100%", borderRadius: "2px 2px 0 0", height: `${Math.round((h.cnt / maxH) * 60)}px`, background: h.hour === peakH?.hour ? "#2563eb" : "#93c5fd", minHeight: h.cnt > 0 ? 2 : 0 }} />
                              {(h.hour % 3 === 1 || h.hour === 10) && <div style={{ fontSize: 9, color: "#9ca3af" }}>{h.hour}</div>}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 10 }}>요일별 입장</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                          {days.map(d => (
                            <div key={d.dow} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <div style={{ width: 18, fontSize: 12, fontWeight: 600, color: d.dow === 0 ? "#ef4444" : d.dow === 6 ? "#3b82f6" : "#374151" }}>{d.name}</div>
                              <div style={{ flex: 1, background: "#f3f4f6", borderRadius: 3, height: 14, overflow: "hidden" }}>
                                <div style={{ width: `${Math.round((d.cnt / maxD) * 100)}%`, height: "100%", background: d.cnt === maxD ? "#2563eb" : "#93c5fd", borderRadius: 3 }} />
                              </div>
                              <div style={{ width: 36, fontSize: 12, color: "#374151", textAlign: "right" }}>{d.cnt}명</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

          </div>
        )}
      </div>

    </AppShell>
  );
}
