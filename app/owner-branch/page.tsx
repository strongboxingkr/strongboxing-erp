"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";

const BRANCH_LIST = ["철산점", "목동점", "개봉점", "신정점"];

const kstToday = () => new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
const fmt = (d: Date) => new Date(d.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
const money = (v: any) => `${Number(v || 0).toLocaleString()}원`;

const getWeekStart = () => {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000);
  d.setDate(d.getDate() - d.getDay());
  return fmt(d);
};
const getLastWeekStart = () => {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000);
  d.setDate(d.getDate() - d.getDay() - 7);
  return fmt(d);
};
const getLastWeekEnd = () => {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000);
  d.setDate(d.getDate() - d.getDay() - 1);
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
  { label: "지난주", start: getLastWeekStart, end: getLastWeekEnd },
  { label: "이번주", start: getWeekStart, end: () => today },
  { label: "이번달", start: getMonthStart, end: () => today },
];

const LAST_BRANCH_KEY = "owner_last_branch";

function getLastBranch(): string {
  try { return localStorage.getItem(LAST_BRANCH_KEY) || BRANCH_LIST[0]; } catch { return BRANCH_LIST[0]; }
}
function setLastBranch(b: string) {
  try { localStorage.setItem(LAST_BRANCH_KEY, b); } catch {}
}

function OwnerBranchPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initBranch = searchParams.get("branch") || getLastBranch();
  const initPreset = Number(searchParams.get("preset") ?? 0);
  const initStart = searchParams.get("start") || PRESETS[initPreset].start();
  const initEnd = searchParams.get("end") || PRESETS[initPreset].end();

  const [branch, setBranch] = useState(BRANCH_LIST.includes(initBranch) ? initBranch : BRANCH_LIST[0]);
  const [preset, setPreset] = useState(initPreset);
  const [startDate, setStartDate] = useState(initStart);
  const [endDate, setEndDate] = useState(initEnd);

  const [data, setData] = useState<any>(null);
  const [dataError, setDataError] = useState(false);
  const [reservations, setReservations] = useState<any[]>([]);

  const reqId = useRef(0);

  const applyPreset = (idx: number) => {
    setPreset(idx);
    setStartDate(PRESETS[idx].start());
    setEndDate(PRESETS[idx].end());
  };

  const handleBranchChange = (b: string) => {
    setBranch(b);
    setLastBranch(b);
  };

  const load = useCallback(async () => {
    const id = ++reqId.current;
    const url = `/api/dashboard?start_date=${startDate}&end_date=${endDate}&branch_name=${encodeURIComponent(branch)}`;
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
      const rRes = await apiFetch("/api/calendar-events");
      const rJson = await rRes.json();
      if (reqId.current !== id) return;
      setReservations(
        (rJson.rows || []).filter(
          (r: any) =>
            r.start_datetime?.slice(0, 10) === today &&
            !["취소", "예약취소"].includes(r.status) &&
            r.branch_name === branch
        )
      );
    } catch {}
  }, [startDate, endDate, branch]);

  useEffect(() => {
    setLastBranch(branch);
    load();
  }, [load]);

  const branchData = data?.branch_sales?.find((b: any) => b.branch_name === branch) || null;
  const sales = branchData ? Number(branchData.sales || 0) : Number(data?.sales || 0);
  const prevSales = branchData ? Number(branchData.prev_sales || 0) : 0;
  const growth = prevSales > 0 ? Math.round(((sales - prevSales) / prevSales) * 100) : null;
  const compLabel = data?.comparison_label || "";

  const daysDiff = Math.floor((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000);
  const rangeTxt = daysDiff === 0 ? today : `${startDate} ~ ${endDate}`;

  const activeMem = Number(branchData?.active_members ?? data?.active_members ?? 0);
  const checkins = Number(branchData?.checkins ?? data?.checkins ?? 0);
  const expiring = Number(branchData?.expiring_soon ?? data?.alert_members ?? 0);
  const crmAlerts = Number(branchData?.crm_alerts ?? data?.crm_alerts ?? 0);
  const newMem = Number(branchData?.new_members ?? data?.new_members ?? 0);
  const reregCount = Number(branchData?.rereg_count ?? 0);

  const isLoaded = data !== null && !dataError;

  const SHORTCUTS = [
    { label: "회원", href: `/members?branch=${encodeURIComponent(branch)}` },
    { label: "출석", href: `/mobile-attendance?branch=${encodeURIComponent(branch)}` },
    { label: "결제", href: `/payments?branch=${encodeURIComponent(branch)}` },
    { label: "상담", href: `/mobile-crm?branch=${encodeURIComponent(branch)}` },
    { label: "예약", href: `/naver-calendar?branch=${encodeURIComponent(branch)}` },
    { label: "라커", href: `/locker?branch=${encodeURIComponent(branch)}` },
  ];

  return (
    <div style={S.page}>
      {/* 헤더 */}
      <div style={S.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => router.back()} style={S.backBtn}>←</button>
          <div style={{ fontWeight: 900, fontSize: 16, letterSpacing: 0.5, color: "#1e293b" }}>
            STRONG <span style={{ color: "#2563eb" }}>OWNER</span>
          </div>
        </div>
        <span style={S.badge}>대표</span>
      </div>

      {/* 필터: 지점 + 기간 */}
      <div style={S.filterBar}>
        <select
          value={branch}
          onChange={(e) => handleBranchChange(e.target.value)}
          style={S.branchSelect}
        >
          {BRANCH_LIST.map((b) => <option key={b}>{b}</option>)}
        </select>
        <div style={{ display: "flex", gap: 5 }}>
          {PRESETS.map((p, i) => (
            <button
              key={p.label}
              onClick={() => applyPreset(i)}
              style={{ ...S.presetBtn, background: preset === i ? "#2563eb" : "#f1f5f9", color: preset === i ? "#fff" : "#374151" }}
            >{p.label}</button>
          ))}
        </div>
      </div>
      <div style={{ padding: "4px 14px", background: "#fff", borderBottom: "1px solid #e2e8f0" }}>
        <span style={{ fontSize: 11, color: "#94a3b8" }}>{rangeTxt}</span>
      </div>

      {/* ① 선택 지점 실적 */}
      <div style={{ padding: "10px 12px 0" }}>
        <div style={S.sectionTitle}>선택 기간 실적</div>
        <div style={S.card}>
          {dataError ? (
            <div style={{ padding: "14px 16px", display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, color: "#ef4444" }}>조회 실패</span>
              <button onClick={load} style={S.retryBtn}>재시도</button>
            </div>
          ) : !data ? (
            <div style={{ padding: "14px 16px", fontSize: 13, color: "#94a3b8" }}>로딩 중...</div>
          ) : (
            <>
              <div style={{ padding: "12px 16px 8px" }}>
                <div style={{ fontSize: 10, color: "#64748b", marginBottom: 2 }}>매출 · {branch} · {compLabel}</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                  <div style={{ fontSize: 26, fontWeight: 900, color: "#1e3a8a" }}>{money(sales)}</div>
                  {growth !== null ? (
                    <div style={{ fontSize: 12, fontWeight: 700, color: growth >= 0 ? "#16a34a" : "#dc2626" }}>
                      {growth >= 0 ? "▲" : "▼"}{Math.abs(growth)}%
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>비교 없음</div>
                  )}
                </div>
              </div>
              <div style={{ padding: "0 16px 10px", borderTop: "1px solid #f1f5f9", display: "flex", gap: 0 }}>
                <div style={S.smallMetric}>
                  <div style={S.metricLbl}>신규</div>
                  <div style={S.metricVal}>{newMem}명</div>
                </div>
                <div style={{ ...S.smallMetric, borderLeft: "1px solid #f1f5f9" }}>
                  <div style={S.metricLbl}>재등록</div>
                  <div style={S.metricVal}>{reregCount}명</div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ② 회원 현황 */}
      <div style={{ padding: "10px 12px 0" }}>
        <div style={S.sectionTitle}>회원 현황 <span style={S.basisNote}>현재 기준</span></div>
        <div style={S.card}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
            <Link href={`/members?branch=${encodeURIComponent(branch)}`} style={S.statCell}>
              <div style={S.metricLbl}>유효회원</div>
              <div style={S.statVal}>{isLoaded ? activeMem : "—"}</div>
            </Link>
            <Link href={`/mobile-attendance?branch=${encodeURIComponent(branch)}&date=${today}`} style={{ ...S.statCell, borderLeft: "1px solid #f1f5f9" }}>
              <div style={S.metricLbl}>오늘 출석</div>
              <div style={S.statVal}>{isLoaded ? checkins : "—"}</div>
            </Link>
            <Link href={`/member-expiring?branch=${encodeURIComponent(branch)}`} style={{ ...S.statCell, borderTop: "1px solid #f1f5f9" }}>
              <div style={S.metricLbl}>만료 7일 이내</div>
              <div style={{ ...S.statVal, color: expiring > 0 ? "#d97706" : "#1e293b" }}>{isLoaded ? expiring : "—"}</div>
            </Link>
            <Link href={`/members?branch=${encodeURIComponent(branch)}&filter=low_count`} style={{ ...S.statCell, borderLeft: "1px solid #f1f5f9", borderTop: "1px solid #f1f5f9" }}>
              <div style={S.metricLbl}>잔여 횟수 부족</div>
              <div style={S.statVal}>{isLoaded ? (branchData?.alert_members ?? "—") : "—"}</div>
            </Link>
          </div>
        </div>
      </div>

      {/* ③ 예약·상담 요약 */}
      <div style={{ padding: "10px 12px 0" }}>
        <div style={S.sectionTitle}>예약·상담 <span style={S.basisNote}>오늘 기준</span></div>
        <div style={S.card}>
          {/* 재연락 기한 초과 */}
          <div style={{ padding: "9px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "#374151", fontWeight: 600 }}>재연락 기한 초과</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 900, color: crmAlerts > 0 ? "#dc2626" : "#1e293b" }}>
                {isLoaded ? `${crmAlerts}건` : "—"}
              </span>
              {isLoaded && crmAlerts > 0 && (
                <Link href={`/mobile-crm?branch=${encodeURIComponent(branch)}`} style={S.viewBtn}>보기</Link>
              )}
            </div>
          </div>
          <div style={S.divider} />
          {/* 오늘 예약 목록 */}
          <div style={{ padding: "9px 14px 4px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: "#374151", fontWeight: 600 }}>오늘 예약</span>
              <Link href={`/naver-calendar?branch=${encodeURIComponent(branch)}`} style={S.viewBtn}>전체보기</Link>
            </div>
            {reservations.length === 0 ? (
              <div style={{ fontSize: 12, color: "#94a3b8", paddingBottom: 6 }}>오늘 예약 없음</div>
            ) : (
              reservations.slice(0, 3).map((r, i) => (
                <div key={r.event_id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", borderTop: i > 0 ? "1px solid #f8fafc" : undefined }}>
                  <div style={{ width: 2, height: 28, background: "#2563eb", borderRadius: 1, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#1e293b" }}>
                      {r.start_datetime?.slice(11, 16)} · {r.customer_name}
                    </div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>{r.status || ""}</div>
                  </div>
                </div>
              ))
            )}
            {reservations.length > 3 && (
              <div style={{ fontSize: 11, color: "#94a3b8", padding: "4px 0 4px" }}>
                +{reservations.length - 3}건 더 있음
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ④ 운영 바로가기 */}
      <div style={{ padding: "10px 12px 0" }}>
        <div style={S.sectionTitle}>운영 바로가기</div>
        <div style={S.card}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 0 }}>
            {SHORTCUTS.map((item, i) => (
              <Link
                key={item.label}
                href={item.href}
                style={{
                  ...S.shortcutCell,
                  borderLeft: i % 3 !== 0 ? "1px solid #f1f5f9" : undefined,
                  borderTop: i >= 3 ? "1px solid #f1f5f9" : undefined,
                }}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* 하단 여백 */}
      <div style={{ height: "calc(72px + env(safe-area-inset-bottom, 0px))" }} />

      {/* 하단 탭바 */}
      <nav style={S.bottomNav}>
        {[
          { href: "/mobile-owner", label: "홈", active: false },
          { href: "/owner-branch", label: "지점현황", active: true },
          { href: "/mobile-monthly-sales", label: "매출", active: false },
          { href: "/mobile-members", label: "회원", active: false },
        ].map((item) => (
          <Link key={item.label} href={item.href} style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "10px 0", fontSize: 12, fontWeight: 600, textDecoration: "none",
            color: item.active ? "#2563eb" : "#64748b",
          }}>{item.label}</Link>
        ))}
        <Link href="/mobile-owner" style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "10px 0", fontSize: 12, fontWeight: 600, textDecoration: "none",
          color: "#64748b",
        }}>더보기</Link>
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
  backBtn: {
    background: "none", border: "none", fontSize: 18, cursor: "pointer",
    color: "#374151", padding: "0 4px 0 0", lineHeight: 1,
  },
  filterBar: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "7px 12px", background: "#fff", gap: 8, borderBottom: "1px solid #e2e8f0",
  },
  branchSelect: {
    padding: "5px 8px", borderRadius: 8, border: "1px solid #e2e8f0",
    fontSize: 14, fontWeight: 700, background: "#f8fafc", color: "#1e293b", cursor: "pointer",
  },
  presetBtn: {
    padding: "5px 10px", borderRadius: 7, border: "none",
    fontSize: 13, fontWeight: 600, cursor: "pointer",
  },
  card: { background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", overflow: "hidden" },
  divider: { height: 1, background: "#f1f5f9", margin: "0 14px" },
  sectionTitle: { fontSize: 13, fontWeight: 800, color: "#1e293b", marginBottom: 6 } as React.CSSProperties,
  basisNote: { fontSize: 10, color: "#94a3b8", fontWeight: 400, marginLeft: 6 } as React.CSSProperties,
  smallMetric: { flex: 1, padding: "7px 8px", textAlign: "center" as const },
  metricLbl: { fontSize: 10, color: "#64748b", marginBottom: 2 },
  metricVal: { fontSize: 14, fontWeight: 900, color: "#1e293b", whiteSpace: "nowrap" as const },
  statCell: {
    display: "block", padding: "10px 14px", textDecoration: "none",
  },
  statVal: { fontSize: 18, fontWeight: 900, color: "#1e293b", marginTop: 2 },
  viewBtn: {
    padding: "3px 9px", background: "#2563eb", color: "#fff",
    borderRadius: 6, fontSize: 11, fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap" as const,
  },
  retryBtn: {
    padding: "3px 9px", background: "#f1f5f9", color: "#374151",
    borderRadius: 6, fontSize: 11, fontWeight: 600, border: "1px solid #e2e8f0", cursor: "pointer",
  },
  shortcutCell: {
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: "12px 8px", fontSize: 13, fontWeight: 600, color: "#2563eb",
    textDecoration: "none",
  },
  bottomNav: {
    position: "fixed" as const, bottom: 0, left: 0, right: 0,
    background: "#fff", borderTop: "1px solid #e2e8f0",
    display: "grid", gridTemplateColumns: "repeat(5, 1fr)",
    paddingBottom: "env(safe-area-inset-bottom, 8px)", zIndex: 999,
  },
};

export default function OwnerBranchPage() {
  return (
    <Suspense>
      <OwnerBranchPageInner />
    </Suspense>
  );
}
