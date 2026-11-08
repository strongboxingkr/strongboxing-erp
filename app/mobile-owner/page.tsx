"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from "recharts";
import { apiFetch } from "@/lib/api";

const BRANCH_ORDER = ["철산점", "목동점", "개봉점", "신정점"];
const branches = ["전체", ...BRANCH_ORDER];

const kstToday = () => new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
const fmt = (d: Date) => new Date(d.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
const money = (v: any) => Number(v || 0).toLocaleString();

const getWeekStart = () => {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000);
  d.setDate(d.getDate() - d.getDay());
  return fmt(d);
};
const getMonthStart = () => {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000);
  d.setDate(1);
  return fmt(d);
};

const today = kstToday();
const PRESETS = [
  { label: "오늘", start: () => today, end: () => today },
  { label: "이번주", start: getWeekStart, end: () => today },
  { label: "이번달", start: getMonthStart, end: () => today },
];

const periodLabel = (preset: number, start: string, end: string, branch: string) => {
  const branchTxt = branch === "전체" ? "전체 지점" : branch;
  if (preset === 0) return `오늘 매출 · ${branchTxt}`;
  if (preset === 1) return `이번주 매출 · ${branchTxt}`;
  return `이번달 매출 · ${branchTxt}`;
};

const periodRangeLabel = (preset: number, start: string, end: string) => {
  if (preset === 0) return today;
  return `${start} ~ ${end}`;
};

export default function MobileOwnerPage() {
  const [data, setData] = useState<any>(null);
  const [dataError, setDataError] = useState(false);
  const [chartRows, setChartRows] = useState<any[] | null>(null);
  const [chartError, setChartError] = useState(false);
  const [reservations, setReservations] = useState<any[]>([]);
  const [showMore, setShowMore] = useState(false);

  const [preset, setPreset] = useState(0);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [branch, setBranch] = useState("전체");

  const reqId = useRef(0);

  const applyPreset = (idx: number) => {
    setPreset(idx);
    setStartDate(PRESETS[idx].start());
    setEndDate(PRESETS[idx].end());
  };

  const load = useCallback(async () => {
    const id = ++reqId.current;
    let url = `/api/dashboard?start_date=${startDate}&end_date=${endDate}`;
    if (branch !== "전체") url += `&branch_name=${encodeURIComponent(branch)}`;
    try {
      const res = await apiFetch(url);
      const json = await res.json();
      if (reqId.current !== id) return;
      setData(json);
      setDataError(false);
    } catch {
      if (reqId.current !== id) return;
      setDataError(true);
    }

    try {
      let chartUrl = "/api/dashboard/chart";
      if (branch !== "전체") chartUrl += `?branch_name=${encodeURIComponent(branch)}`;
      const cRes = await apiFetch(chartUrl);
      const cJson = await cRes.json();
      if (reqId.current !== id) return;
      if (cJson.success) { setChartRows(cJson.rows || []); setChartError(false); }
      else setChartError(true);
    } catch {
      if (reqId.current !== id) return;
      setChartError(true);
    }

    try {
      const rRes = await apiFetch("/api/calendar-events");
      const rJson = await rRes.json();
      if (reqId.current !== id) return;
      setReservations((rJson.rows || []).filter(
        (r: any) => r.start_datetime?.slice(0, 10) === today && !["취소", "예약취소"].includes(r.status)
      ));
    } catch {}
  }, [startDate, endDate, branch]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, [load]);

  const rawBranchSales = data?.branch_sales || [];
  // 고정 순서 유지 (매출 순 정렬 대신 BRANCH_ORDER 사용)
  const branchSales = BRANCH_ORDER.map((name) =>
    rawBranchSales.find((b: any) => b.branch_name === name) || { branch_name: name, sales: 0, prev_sales: 0, sales_growth: null, new_members: 0, rereg_count: 0, active_members: 0 }
  );
  const totalSales = Number(data?.sales || 0);
  const compLabel = data?.comparison_label || "전기간 대비";

  const prevTotalSales = rawBranchSales.reduce((sum: number, b: any) => sum + Number(b.prev_sales || 0), 0);
  const totalGrowth = prevTotalSales > 0
    ? Math.round(((totalSales - prevTotalSales) / prevTotalSales) * 100)
    : null;

  const hasChartData = chartRows !== null && !chartError && chartRows.some((r) => r.sales > 0);
  const maxSales = hasChartData ? Math.max(...chartRows!.map((r) => Number(r.sales || 0))) : 1;

  const checkItems = [
    {
      label: "만료 7일 이내",
      total: branch === "전체"
        ? rawBranchSales.reduce((s: number, b: any) => s + Number(b.expiring_soon || 0), 0)
        : Number(data?.alert_members || 0),
      perBranch: branch === "전체" ? BRANCH_ORDER.map((name) => {
        const b = rawBranchSales.find((r: any) => r.branch_name === name);
        return { name, count: Number(b?.expiring_soon || 0) };
      }) : [],
      href: "/member-expiring",
      urgent: false,
    },
    {
      label: "재연락 기한 초과",
      total: Number(data?.crm_alerts || 0),
      perBranch: branch === "전체" ? BRANCH_ORDER.map((name) => {
        const b = rawBranchSales.find((r: any) => r.branch_name === name);
        return { name, count: Number(b?.crm_alerts || 0) };
      }) : [],
      href: "/crm-alerts",
      urgent: true,
    },
    {
      label: "오늘 만료",
      total: Number(data?.today_expire || 0),
      perBranch: [],
      href: "/member-expiring",
      urgent: false,
    },
  ];

  const monthlySalesHref = branch === "전체"
    ? "/mobile-monthly-sales"
    : `/mobile-monthly-sales?branch=${encodeURIComponent(branch)}`;

  return (
    <div style={S.page}>
      {/* 헤더 */}
      <div style={S.header}>
        <div style={{ fontWeight: 900, fontSize: 16, letterSpacing: 0.5, color: "#1e293b" }}>
          STRONG <span style={{ color: "#2563eb" }}>OWNER</span>
        </div>
        <span style={S.badge}>대표</span>
      </div>

      {/* 필터 */}
      <div style={S.filterBar}>
        <div style={{ display: "flex", gap: 5 }}>
          {PRESETS.map((p, i) => (
            <button key={p.label} onClick={() => applyPreset(i)} style={{
              ...S.presetBtn,
              background: preset === i ? "#2563eb" : "#f1f5f9",
              color: preset === i ? "#fff" : "#475569",
              borderColor: preset === i ? "#2563eb" : "#e2e8f0",
            }}>{p.label}</button>
          ))}
        </div>
        <select value={branch} onChange={(e) => setBranch(e.target.value)} style={S.smallSelect}>
          {branches.map((b) => <option key={b}>{b}</option>)}
        </select>
      </div>
      <div style={{ padding: "3px 16px 4px", background: "#fff", borderBottom: "1px solid #e2e8f0" }}>
        <span style={{ fontSize: 11, color: "#94a3b8" }}>{periodRangeLabel(preset, startDate, endDate)}</span>
      </div>

      <div style={S.body}>

        {/* ② 핵심 실적 요약 */}
        <div style={S.card}>
          {dataError ? (
            <div style={{ padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, color: "#ef4444" }}>조회 실패</span>
              <button onClick={load} style={S.retryBtn}>재시도</button>
            </div>
          ) : !data ? (
            <div style={{ padding: "14px 16px", fontSize: 13, color: "#94a3b8" }}>로딩 중...</div>
          ) : (
            <>
              <div style={{ padding: "12px 16px 10px" }}>
                <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>
                  {periodLabel(preset, startDate, endDate, branch)}
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 26, fontWeight: 900, color: "#0f172a", letterSpacing: -0.5, fontVariantNumeric: "tabular-nums" }}>
                    {money(totalSales)}<span style={{ fontSize: 14, fontWeight: 500, color: "#64748b", marginLeft: 2 }}>원</span>
                  </span>
                  {totalGrowth !== null ? (
                    <span style={{ fontSize: 12, fontWeight: 700, color: totalGrowth >= 0 ? "#16a34a" : "#dc2626" }}>
                      {totalGrowth >= 0 ? "▲" : "▼"}{Math.abs(totalGrowth)}%
                      <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 400, marginLeft: 3 }}>{compLabel}</span>
                    </span>
                  ) : (
                    <span style={{ fontSize: 11, color: "#cbd5e1" }}>비교 없음</span>
                  )}
                </div>
              </div>
              <div style={{ borderTop: "1px solid #f1f5f9", display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr" }}>
                {[
                  { lbl: "신규", val: data.new_members ?? 0, sub: "선택기간" },
                  { lbl: "재등록", val: rawBranchSales.reduce((s: number, b: any) => s + Number(b.rereg_count || 0), 0), sub: "선택기간" },
                  { lbl: "유효회원", val: data.active_members ?? 0, sub: "현재" },
                  { lbl: "오늘출석", val: data.checkins ?? 0, sub: "오늘" },
                ].map((m, i) => (
                  <div key={m.lbl} style={{ ...S.smallMetric, borderLeft: i > 0 ? "1px solid #f1f5f9" : undefined }}>
                    <div style={S.metricLbl}>{m.lbl} <span style={S.basisLbl}>{m.sub}</span></div>
                    <div style={S.metricVal}>{m.val}<span style={S.unitLbl}>명</span></div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* ③ 지점별 실적 */}
        {branch === "전체" && (
          <div>
            <div style={S.sectionHeader}>
              <span style={S.sectionTitle}>지점별 실적</span>
              <span style={{ fontSize: 11, color: "#94a3b8" }}>{compLabel}</span>
            </div>
            <div style={S.card}>
              {!data ? (
                <div style={{ padding: "12px 16px", fontSize: 13, color: "#94a3b8" }}>로딩 중...</div>
              ) : branchSales.map((b: any, i: number) => {
                const growth = b.sales_growth;
                const hasGrowth = growth !== null && growth !== undefined;
                return (
                  <div key={b.branch_name}>
                    {i > 0 && <div style={S.divider} />}
                    <Link
                      href={`/owner-branch?branch=${encodeURIComponent(b.branch_name)}&preset=${preset}&start=${startDate}&end=${endDate}`}
                      style={{ textDecoration: "none", display: "block" }}
                    >
                      <div style={{ padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: "0 0 auto" }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}>{b.branch_name}</div>
                          <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                            신규 {b.new_members || 0} · 재등록 {b.rereg_count || 0} · 유효 {b.active_members || 0}명
                          </div>
                        </div>
                        <div style={{ textAlign: "right", flex: "0 0 auto" }}>
                          <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                            {money(b.sales || 0)}<span style={{ fontSize: 12, fontWeight: 400, color: "#64748b" }}>원</span>
                          </div>
                          {hasGrowth ? (
                            <div style={{ fontSize: 11, color: growth >= 0 ? "#16a34a" : "#dc2626", marginTop: 1, fontWeight: 600 }}>
                              {growth >= 0 ? "▲" : "▼"}{Math.abs(growth)}%
                            </div>
                          ) : (
                            <div style={{ fontSize: 11, color: "#cbd5e1", marginTop: 1 }}>—</div>
                          )}
                        </div>
                      </div>
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ④ 확인 필요한 항목 */}
        <div>
          <div style={S.sectionHeader}>
            <span style={S.sectionTitle}>확인 필요한 항목</span>
            <span style={{ fontSize: 11, color: "#94a3b8" }}>현재 기준</span>
          </div>
          <div style={S.card}>
            {checkItems.map((item, i) => {
              const isLoaded = data !== null && !dataError;
              const displayVal = dataError ? "?" : !isLoaded ? "—" : item.total;
              const isUrgent = item.urgent && isLoaded && item.total > 0;
              return (
                <div key={item.label}>
                  {i > 0 && <div style={S.divider} />}
                  <div style={{ padding: "10px 16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>{item.label}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 16, fontWeight: 800, color: isUrgent ? "#dc2626" : "#1e293b", fontVariantNumeric: "tabular-nums" }}>
                          {displayVal}{isLoaded && !dataError ? <span style={{ fontSize: 12, fontWeight: 400, color: "#64748b" }}>명</span> : ""}
                        </span>
                        {isLoaded && !dataError && item.total > 0 && (
                          <Link href={item.href} style={S.outlineBtn}>보기</Link>
                        )}
                      </div>
                    </div>
                    {item.perBranch.length > 0 && isLoaded && !dataError && item.total > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "3px 10px", marginTop: 5 }}>
                        {item.perBranch.filter((b) => b.count > 0).map((b) => (
                          <span key={b.name} style={{ fontSize: 12, color: "#64748b" }}>
                            {b.name} <b style={{ color: "#374151" }}>{b.count}</b>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ⑤ 월별 매출 바로가기 */}
        <Link href={monthlySalesHref} style={{ textDecoration: "none", display: "block" }}>
          <div style={{ ...S.card, padding: "13px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}>월별 매출</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>날짜별 결제 내역 상세 조회</div>
            </div>
            <span style={{ fontSize: 18, color: "#94a3b8", lineHeight: 1 }}>›</span>
          </div>
        </Link>

        {/* ⑥ 최근 7일 매출 추이 */}
        <div>
          <div style={S.sectionHeader}>
            <span style={S.sectionTitle}>최근 7일 매출</span>
            {chartError && <button onClick={load} style={S.retryBtn}>재시도</button>}
          </div>
          <div style={{ ...S.card, padding: chartRows === null || chartError ? undefined : "10px 4px 6px 0" }}>
            {chartError ? (
              <div style={{ padding: "12px 16px", fontSize: 12, color: "#94a3b8" }}>차트를 불러올 수 없습니다.</div>
            ) : chartRows === null ? (
              <div style={{ padding: "12px 16px", fontSize: 12, color: "#94a3b8" }}>로딩 중...</div>
            ) : !hasChartData ? (
              <div style={{ padding: "12px 16px", fontSize: 12, color: "#94a3b8" }}>기간 내 매출 데이터가 없습니다.</div>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={chartRows} margin={{ top: 4, right: 14, left: 0, bottom: 0 }}>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis
                    domain={[0, maxSales]}
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    tickFormatter={(v) => v === 0 ? "0" : `${Math.round(v / 10000)}만`}
                    axisLine={false} tickLine={false} width={34}
                  />
                  <Tooltip
                    formatter={(v: any) => [`${Number(v).toLocaleString()}원`, "매출"]}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
                  />
                  <Line type="monotone" dataKey="sales" stroke="#2563eb" strokeWidth={2}
                    dot={{ r: 3, fill: "#2563eb" }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* ⑦ 오늘 예약 */}
        <div>
          <div style={S.sectionHeader}>
            <span style={S.sectionTitle}>오늘 예약</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {reservations.length > 0 && <span style={{ fontSize: 11, color: "#94a3b8" }}>{reservations.length}건</span>}
              <Link href="/naver-calendar" style={S.outlineBtn}>전체보기</Link>
            </div>
          </div>
          <div style={S.card}>
            {reservations.length === 0 ? (
              <div style={{ padding: "10px 16px", fontSize: 12, color: "#94a3b8" }}>오늘 예약이 없습니다.</div>
            ) : (
              reservations.slice(0, 5).map((r, i) => (
                <div key={r.event_id}>
                  {i > 0 && <div style={S.divider} />}
                  <div style={{ padding: "9px 16px", display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 3, alignSelf: "stretch", minHeight: 32, background: "#2563eb", borderRadius: 2, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>
                        {r.start_datetime?.slice(11, 16)} · {r.customer_name}
                      </div>
                      <div style={{ fontSize: 12, color: "#64748b", marginTop: 1 }}>
                        {r.branch_name}{r.status ? ` · ${r.status}` : ""}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* 하단 여백 */}
      <div style={{ height: "calc(72px + env(safe-area-inset-bottom, 0px))" }} />

      {/* 더보기 오버레이 */}
      {showMore && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 1000 }} onClick={() => setShowMore(false)}>
          <div style={{ position: "absolute", bottom: "calc(60px + env(safe-area-inset-bottom, 0px))", left: 0, right: 0, background: "#fff", borderRadius: "16px 16px 0 0", padding: "16px 16px calc(16px + env(safe-area-inset-bottom, 0px))" }}
            onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 10 }}>더보기</div>
            {[
              { href: "/mobile-attendance", label: "출석 관리" },
              { href: "/mobile-crm", label: "상담 관리" },
              { href: "/mobile-monthly-sales", label: "월별 매출" },
              { href: "/hq/analytics", label: "분석" },
              { href: "/dashboard", label: "PC 버전" },
            ].map((item) => (
              <Link key={item.href} href={item.href}
                onClick={() => setShowMore(false)}
                style={{ display: "block", padding: "11px 4px", fontSize: 14, fontWeight: 600, color: "#1e293b", textDecoration: "none", borderBottom: "1px solid #f1f5f9" }}>
                {item.label} →
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 하단 탭바 */}
      <nav style={S.bottomNav}>
        {[
          { href: "/mobile-owner", label: "홈", active: true },
          { href: "/owner-branch", label: "지점현황", active: false },
          { href: "/mobile-monthly-sales", label: "매출", active: false },
          { href: "/mobile-members", label: "회원", active: false },
        ].map((item) => (
          <Link key={item.label} href={item.href} style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "10px 0", fontSize: 12, fontWeight: 600, textDecoration: "none",
            color: item.active ? "#2563eb" : "#64748b",
          }}>{item.label}</Link>
        ))}
        <button onClick={() => setShowMore(true)} style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "10px 0", fontSize: 12, fontWeight: 600,
          color: "#64748b", background: "none", border: "none", cursor: "pointer",
        }}>더보기</button>
      </nav>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: { background: "#f8fafc", minHeight: "100vh" },
  header: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "12px 16px 10px",
    background: "#fff", borderBottom: "1px solid #e2e8f0",
  },
  badge: {
    background: "#f1f5f9", border: "1px solid #e2e8f0",
    padding: "3px 10px", borderRadius: 999, fontSize: 11, color: "#64748b", fontWeight: 600,
  },
  filterBar: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "7px 16px", background: "#fff", gap: 8,
  },
  presetBtn: {
    padding: "5px 10px", borderRadius: 7, border: "1px solid",
    fontSize: 13, fontWeight: 600, cursor: "pointer",
  },
  smallSelect: {
    padding: "5px 8px", borderRadius: 8, border: "1px solid #e2e8f0",
    fontSize: 13, background: "#f8fafc", color: "#374151", cursor: "pointer",
  },
  body: {
    padding: "12px 16px", display: "flex", flexDirection: "column" as const, gap: 20,
  },
  card: { background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", overflow: "hidden" },
  divider: { height: 1, background: "#f1f5f9", margin: "0 16px" },
  sectionHeader: {
    display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8,
  },
  sectionTitle: { fontSize: 13, fontWeight: 800, color: "#1e293b" },
  smallMetric: { padding: "8px 4px", textAlign: "center" as const },
  metricLbl: { fontSize: 10, color: "#64748b", marginBottom: 2 },
  metricVal: { fontSize: 14, fontWeight: 800, color: "#1e293b", whiteSpace: "nowrap" as const, fontVariantNumeric: "tabular-nums" },
  basisLbl: { fontSize: 9, color: "#94a3b8", fontWeight: 400 },
  unitLbl: { fontSize: 11, fontWeight: 400, color: "#64748b", marginLeft: 1 },
  outlineBtn: {
    padding: "3px 9px", background: "#fff", color: "#475569",
    borderRadius: 6, fontSize: 11, fontWeight: 600, textDecoration: "none",
    border: "1px solid #cbd5e1", whiteSpace: "nowrap" as const,
  },
  retryBtn: {
    padding: "3px 9px", background: "#f1f5f9", color: "#374151",
    borderRadius: 6, fontSize: 11, fontWeight: 600, border: "1px solid #e2e8f0", cursor: "pointer",
  },
  bottomNav: {
    position: "fixed" as const, bottom: 0, left: 0, right: 0,
    background: "#fff", borderTop: "1px solid #e2e8f0",
    display: "grid", gridTemplateColumns: "repeat(5, 1fr)",
    paddingBottom: "env(safe-area-inset-bottom, 8px)", zIndex: 999,
  },
};
