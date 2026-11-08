"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { apiFetch } from "@/lib/api";

const branches = ["전체", "철산점", "목동점", "개봉점", "신정점"];

/** KST 기준 오늘 날짜 */
const kstToday = () => new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
const fmt = (d: Date) => new Date(d.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
const money = (v: any) => `${Number(v || 0).toLocaleString()}원`;

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

  // 필터 변경 경쟁 방지용 ref
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

  const branchSales = data?.branch_sales || [];
  const totalSales = Number(data?.sales || 0);
  const compLabel = data?.comparison_label || "전기간 대비";

  // 비교 기간 전체 매출 (branch_sales의 prev_sales 합산)
  const prevTotalSales = branchSales.reduce((sum: number, b: any) => sum + Number(b.prev_sales || 0), 0);
  const totalGrowth = prevTotalSales > 0
    ? Math.round(((totalSales - prevTotalSales) / prevTotalSales) * 100)
    : null;

  const hasChartData = chartRows !== null && !chartError && chartRows.some((r) => r.sales > 0);
  const maxSales = hasChartData ? Math.max(...chartRows!.map((r) => Number(r.sales || 0))) : 1;

  // 확인 필요 항목: 지점별로 집계
  const checkItems = [
    {
      label: "만료 7일 이내",
      total: branch === "전체"
        ? branchSales.reduce((s: number, b: any) => s + Number(b.expiring_soon || 0), 0)
        : Number(data?.alert_members || 0),
      perBranch: branch === "전체" ? branchSales.map((b: any) => ({ name: b.branch_name, count: Number(b.expiring_soon || 0) })) : [],
      href: "/member-expiring",
      urgent: false,
      basis: "현재 기준",
    },
    {
      label: "재연락 기한 초과",
      total: Number(data?.crm_alerts || 0),
      perBranch: branch === "전체" ? branchSales.map((b: any) => ({ name: b.branch_name, count: Number(b.crm_alerts || 0) })) : [],
      href: "/crm-alerts",
      urgent: true,
      basis: "현재 기준",
    },
    {
      label: "오늘 만료",
      total: Number(data?.today_expire || 0),
      perBranch: [],
      href: "/member-expiring",
      urgent: false,
      basis: "오늘 기준",
    },
  ];

  const presetChartTitle = preset === 0 ? "최근 7일 매출" : preset === 1 ? "최근 7일 매출 (주간)" : "최근 7일 매출 (월간)";

  return (
    <div style={S.page}>
      {/* 헤더 */}
      <div style={S.header}>
        <div style={{ fontWeight: 900, fontSize: 16, letterSpacing: 0.5, color: "#1e293b" }}>
          STRONG <span style={{ color: "#2563eb" }}>OWNER</span>
        </div>
        <span style={S.badge}>대표</span>
      </div>

      {/* ① 기간·지점 필터 */}
      <div style={S.filterBar}>
        <div style={{ display: "flex", gap: 5 }}>
          {PRESETS.map((p, i) => (
            <button key={p.label} onClick={() => applyPreset(i)} style={{
              ...S.presetBtn,
              background: preset === i ? "#2563eb" : "#f1f5f9",
              color: preset === i ? "#fff" : "#374151",
            }}>{p.label}</button>
          ))}
        </div>
        <select value={branch} onChange={(e) => setBranch(e.target.value)} style={S.smallSelect}>
          {branches.map((b) => <option key={b}>{b}</option>)}
        </select>
      </div>
      <div style={{ padding: "4px 14px", background: "#fff", borderBottom: "1px solid #e2e8f0" }}>
        <span style={{ fontSize: 11, color: "#94a3b8" }}>{periodRangeLabel(preset, startDate, endDate)}</span>
      </div>

      {/* ② 핵심 실적 요약 */}
      <div style={{ padding: "10px 12px 0" }}>
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
              {/* 매출 + 증감 */}
              <div style={{ padding: "12px 16px 0" }}>
                <div style={{ fontSize: 10, color: "#64748b", marginBottom: 2 }}>
                  선택 기간 매출 · {branch}
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                  <div style={{ fontSize: 28, fontWeight: 900, color: "#1e3a8a", letterSpacing: -0.5 }}>
                    {money(totalSales)}
                  </div>
                  {totalGrowth !== null ? (
                    <div style={{ fontSize: 12, fontWeight: 700, color: totalGrowth >= 0 ? "#16a34a" : "#dc2626" }}>
                      {totalGrowth >= 0 ? "▲" : "▼"}{Math.abs(totalGrowth)}% <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 400 }}>{compLabel}</span>
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>비교 기준 없음</div>
                  )}
                </div>
              </div>
              {/* 신규·재등록 */}
              <div style={{ padding: "8px 16px", display: "flex", gap: 0, borderTop: "1px solid #f1f5f9", marginTop: 8 }}>
                <div style={S.smallMetric}>
                  <div style={S.metricLbl}>신규 <span style={S.basisLbl}>선택기간</span></div>
                  <div style={S.metricVal}>{data.new_members ?? 0}명</div>
                </div>
                <div style={{ ...S.smallMetric, borderLeft: "1px solid #f1f5f9" }}>
                  <div style={S.metricLbl}>재등록 <span style={S.basisLbl}>선택기간</span></div>
                  <div style={S.metricVal}>
                    {branchSales.reduce((s: number, b: any) => s + Number(b.rereg_count || 0), 0)}명
                  </div>
                </div>
                <div style={{ ...S.smallMetric, borderLeft: "1px solid #f1f5f9" }}>
                  <div style={S.metricLbl}>유효회원 <span style={S.basisLbl}>현재</span></div>
                  <div style={S.metricVal}>{data.active_members ?? 0}명</div>
                </div>
                <div style={{ ...S.smallMetric, borderLeft: "1px solid #f1f5f9" }}>
                  <div style={S.metricLbl}>오늘 출석 <span style={S.basisLbl}>오늘</span></div>
                  <div style={S.metricVal}>{data.checkins ?? 0}명</div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ③ 확인 필요한 항목 */}
      <div style={{ padding: "10px 12px 0" }}>
        <div style={S.sectionTitle}>확인 필요한 항목
          <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 400, marginLeft: 6 }}>현재 기준</span>
        </div>
        <div style={S.card}>
          {checkItems.map((item, i) => {
            const isLoaded = data !== null && !dataError;
            const displayVal = dataError ? "?" : !isLoaded ? "—" : item.total;
            const isUrgent = item.urgent && isLoaded && item.total > 0;
            return (
              <div key={item.label}>
                {i > 0 && <div style={S.divider} />}
                <div style={{ padding: "10px 14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>{item.label}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 16, fontWeight: 900, color: isUrgent ? "#dc2626" : "#1e293b" }}>
                        {displayVal}{isLoaded && !dataError ? "명" : ""}
                      </span>
                      {isLoaded && !dataError && item.total > 0 && (
                        <Link href={item.href} style={S.viewBtn}>보기</Link>
                      )}
                    </div>
                  </div>
                  {/* 지점별 미니 행 */}
                  {item.perBranch.length > 0 && isLoaded && !dataError && item.total > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "3px 10px", marginTop: 5 }}>
                      {item.perBranch.filter((b) => b.count > 0).map((b) => (
                        <span key={b.name} style={{ fontSize: 11, color: "#64748b" }}>
                          {b.name} <b style={{ color: "#1e293b" }}>{b.count}</b>
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

      {/* ④ 지점별 실적 */}
      {branch === "전체" && (
        <div style={{ padding: "10px 12px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
            <div style={S.sectionTitle}>지점별 실적</div>
            <div style={{ fontSize: 10, color: "#94a3b8" }}>{compLabel}</div>
          </div>
          <div style={S.card}>
            {branchSales.length === 0 && !data ? (
              <div style={{ padding: "12px 14px", fontSize: 13, color: "#94a3b8" }}>로딩 중...</div>
            ) : branchSales.map((b: any, i: number) => {
              const growth = b.sales_growth;
              const hasGrowth = growth !== null && growth !== undefined;
              return (
                <div key={b.branch_name}>
                  {i > 0 && <div style={S.divider} />}
                  <Link
                    href={`/mobile-branch?branch=${encodeURIComponent(b.branch_name)}`}
                    style={{ textDecoration: "none", display: "block" }}
                  >
                    <div style={{ padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                      <div style={{ flex: "0 0 auto" }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}>{b.branch_name}</div>
                        <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                          신규 {b.new_members || 0} · 재등록 {b.rereg_count || 0} · 유효 {b.active_members || 0}명
                        </div>
                      </div>
                      <div style={{ textAlign: "right", flex: "0 0 auto" }}>
                        <div style={{ fontSize: 15, fontWeight: 900, color: "#2563eb", whiteSpace: "nowrap" }}>
                          {money(b.sales || 0)}
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

      {/* ⑤ 매출 추이 */}
      <div style={{ padding: "10px 12px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
          <div style={S.sectionTitle}>{presetChartTitle}</div>
          {chartError && (
            <button onClick={load} style={S.retryBtn}>재시도</button>
          )}
        </div>
        <div style={{ ...S.card, padding: chartRows === null || chartError ? undefined : "10px 4px 6px 0" }}>
          {chartError ? (
            <div style={{ padding: "12px 16px", fontSize: 12, color: "#94a3b8" }}>
              차트를 불러올 수 없습니다.
            </div>
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

      {/* ⑥ 오늘 예약 */}
      <div style={{ padding: "10px 12px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div style={S.sectionTitle}>오늘 예약 <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 400 }}>오늘 기준</span></div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {reservations.length > 0 && <span style={{ fontSize: 11, color: "#94a3b8" }}>{reservations.length}건</span>}
            <Link href="/naver-calendar" style={S.viewBtn}>전체보기</Link>
          </div>
        </div>
        <div style={S.card}>
          {reservations.length === 0 ? (
            <div style={{ padding: "10px 14px", fontSize: 12, color: "#94a3b8" }}>오늘 예약이 없습니다.</div>
          ) : (
            reservations.slice(0, 5).map((r, i) => (
              <div key={r.event_id}>
                {i > 0 && <div style={S.divider} />}
                <div style={{ padding: "9px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 3, alignSelf: "stretch", minHeight: 32, background: "#2563eb", borderRadius: 2, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>
                      {r.start_datetime?.slice(11, 16)} · {r.customer_name}
                    </div>
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 1 }}>
                      {r.branch_name}{r.status ? ` · ${r.status}` : ""}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
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
          { href: "/mobile-branch", label: "지점현황", active: false },
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
  page: { background: "#f1f5f9", minHeight: "100vh" },
  header: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "12px 14px 10px",
    background: "#fff", borderBottom: "1px solid #e2e8f0",
  },
  badge: {
    background: "#f1f5f9", border: "1px solid #e2e8f0",
    padding: "3px 10px", borderRadius: 999, fontSize: 11, color: "#64748b", fontWeight: 600,
  },
  filterBar: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "7px 12px", background: "#fff", gap: 8,
  },
  presetBtn: {
    padding: "5px 10px", borderRadius: 7, border: "none",
    fontSize: 13, fontWeight: 600, cursor: "pointer",
  },
  smallSelect: {
    padding: "5px 8px", borderRadius: 8, border: "1px solid #e2e8f0",
    fontSize: 13, background: "#f8fafc", color: "#374151", cursor: "pointer",
  },
  card: { background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", overflow: "hidden" },
  divider: { height: 1, background: "#f1f5f9", margin: "0 14px" },
  sectionTitle: { fontSize: 13, fontWeight: 800, color: "#1e293b", marginBottom: 6 },
  smallMetric: { flex: 1, padding: "7px 8px", textAlign: "center" as const },
  metricLbl: { fontSize: 10, color: "#64748b", marginBottom: 2 },
  metricVal: { fontSize: 14, fontWeight: 900, color: "#1e293b", whiteSpace: "nowrap" as const },
  basisLbl: { fontSize: 9, color: "#94a3b8", fontWeight: 400 },
  viewBtn: {
    padding: "3px 9px", background: "#2563eb", color: "#fff",
    borderRadius: 6, fontSize: 11, fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap" as const,
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
