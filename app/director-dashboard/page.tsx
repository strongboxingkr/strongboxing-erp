"use client";

import { useEffect, useState, useCallback } from "react";
import AppShell from "@/components/AppShell";
import { apiFetch } from "@/lib/api";
import Link from "next/link";

const money = (v: any) => `${Number(v || 0).toLocaleString()}원`;
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const fmtTime = (t: string) => {
  if (!t) return "";
  return t.slice(0, 5);
};
const dateLabel = () => {
  const d = new Date();
  return d.toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" });
};

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  PENDING:   { bg: "#fef3c7", color: "#92400e", label: "대기" },
  CONFIRMED: { bg: "#dbeafe", color: "#1d4ed8", label: "확정" },
  VISITED:   { bg: "#dcfce7", color: "#166534", label: "방문" },
  CANCELLED: { bg: "#f3f4f6", color: "#9ca3af", label: "취소" },
  NOSHOW:    { bg: "#fee2e2", color: "#dc2626", label: "노쇼" },
};

export default function DirectorDashboardPage() {
  const [user, setUser]           = useState<any>(null);
  const [branches, setBranches]   = useState<any[]>([]);
  const [selBranch, setSelBranch] = useState<string | null>(null);
  const [summary, setSummary]     = useState<any>(null);
  const [attendance, setAttendance]   = useState<any[]>([]);
  const [allBranches, setAllBranches] = useState<any[]>([]);
  const [expiring, setExpiring]       = useState<any[]>([]);
  const [reservations, setReservations] = useState<any[] | null>(null);
  const [reservErr, setReservErr]       = useState(false);
  const [loading, setLoading]     = useState(true);
  const [showAllBranch, setShowAllBranch] = useState(false);
  const [alertCounts, setAlertCounts] = useState<any>(null);

  const isAdminOrOwner = (role: string) => role === "ADMIN" || role === "OWNER";

  /* ── 데이터 로드 ── */
  const loadData = useCallback(async (u: any, branch?: string) => {
    setLoading(true);
    const branchForQuery = branch ?? (isAdminOrOwner(u.role) ? undefined : u.branch_name);
    const bp = branchForQuery ? `?branch_name=${encodeURIComponent(branchForQuery)}` : "";

    try {
      const [sumRes, attRes, allAttRes, expRes, alertRes] = await Promise.all([
        apiFetch(`/api/dashboard/summary${bp}`),
        apiFetch(`/api/attendance/live${bp}`),
        apiFetch(`/api/attendance/live?all_branches=true`),
        apiFetch(`/api/members?status=ACTIVE&expiring=7${branchForQuery ? `&branch_name=${encodeURIComponent(branchForQuery)}` : ""}`),
        apiFetch(`/api/dashboard${bp}&start_date=${todayStr()}&end_date=${todayStr()}`),
      ]);

      const [sumJson, attJson, allAttJson, expJson, alertJson] = await Promise.all([
        sumRes.json(), attRes.json(), allAttRes.json(), expRes.json(), alertRes.json(),
      ]);

      setSummary(sumJson.data || sumJson);

      setAttendance(attJson.rows || []);

      const branchList = ["철산점", "목동점", "개봉점", "신정점"];
      const branchMap: Record<string, number> = {};
      branchList.forEach(b => (branchMap[b] = 0));
      (allAttJson.branches || []).forEach((r: any) => { branchMap[r.branch_name] = Number(r.count || 0); });
      setAllBranches(branchList.map(b => ({ branch_name: b, count: branchMap[b] })));

      const today0 = new Date(); today0.setHours(0, 0, 0, 0);
      const threeDays = new Date(today0); threeDays.setDate(threeDays.getDate() + 3);
      const expRows = (expJson.rows || []).filter((m: any) => {
        if (!m.end_date) return false;
        const end = new Date(m.end_date); end.setHours(0, 0, 0, 0);
        return end >= today0 && end <= threeDays;
      });
      setExpiring(expRows.slice(0, 10));

      setAlertCounts(alertJson);
    } catch {
      /* summary 실패해도 예약은 별도 로드 */
    }

    /* 예약 조회 */
    await loadReservations(branchForQuery);

    setLoading(false);
  }, []);

  const loadReservations = async (branchForQuery?: string) => {
    setReservErr(false);
    try {
      const bp = branchForQuery ? `?branch_name=${encodeURIComponent(branchForQuery)}` : "";
      const res = await apiFetch(`/api/naver-reservations${bp}`);
      const json = await res.json();
      const today = todayStr();
      const rows = (json.rows || [])
        .filter((r: any) => r.reservation_date === today)
        .sort((a: any, b: any) => (a.reservation_time || "").localeCompare(b.reservation_time || ""));
      setReservations(rows);
    } catch {
      setReservErr(true);
      setReservations(null);
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem("user");
    if (!saved) return;
    const u = JSON.parse(saved);
    setUser(u);
    if (isAdminOrOwner(u.role)) {
      apiFetch("/api/settings?option_type=BRANCH").then(r => r.json()).then(d => setBranches(d.rows || []));
      setSelBranch("전체");
    }
    loadData(u);
  }, [loadData]);

  const handleBranchChange = (b: string) => {
    setSelBranch(b);
    loadData(user, b === "전체" ? undefined : b);
  };

  const refresh = () => loadData(user, selBranch && selBranch !== "전체" ? selBranch : undefined);

  /* ── 현황 헤더 텍스트 ── */
  const headerBranch = (() => {
    if (!user) return "";
    if (isAdminOrOwner(user.role)) {
      return selBranch && selBranch !== "전체" ? `${selBranch} 현황` : "전체 지점 현황";
    }
    return `${user.branch_name || ""} 현황`;
  })();

  /* ── 확인할 일 항목 ── */
  const opsItems = [
    {
      icon: "⚠",
      label: "만료 임박 회원",
      hint: "기간권 3일 이내 · 횟수권 3회 이하",
      count: alertCounts?.alert_members ?? (loading ? null : 0),
      href: "/member-management?tab=만료 예정",
      warnColor: "#dc2626",
    },
    {
      icon: "↩",
      label: "재연락 필요",
      hint: "재연락 예정일 경과",
      count: alertCounts?.crm_alerts ?? (loading ? null : 0),
      href: "/crm-alerts",
      warnColor: "#d97706",
    },
    {
      icon: "📅",
      label: "오늘 만료",
      hint: "오늘이 만료일인 회원",
      count: alertCounts?.today_expire ?? (loading ? null : 0),
      href: "/member-management?tab=만료·소진",
      warnColor: "#374151",
    },
    {
      icon: "📋",
      label: "예약 확정 대기",
      hint: "PENDING 상태 예약",
      count: reservations !== null
        ? reservations.filter(r => r.status === "PENDING").length
        : (loading ? null : 0),
      href: "/naver-calendar",
      warnColor: "#7c3aed",
    },
  ];

  return (
    <AppShell title="관장 대시보드">
      <style>{`
        /* ── 공통 (대표 대시보드와 동일 계열) ── */
        .dir-card { background:#fff; border:1px solid #e2e5eb; border-radius:10px; overflow:hidden; box-shadow:0 1px 4px rgba(0,0,0,.06); margin-bottom:14px; }
        .dir-card-header { padding:13px 20px; border-bottom:1px solid #e2e5eb; display:flex; align-items:center; gap:8px; }
        .dir-dot { width:6px; height:6px; border-radius:50%; flex-shrink:0; }
        .dir-card-title { font-size:13px; font-weight:700; color:#111827; }
        .dir-card-sub { font-size:11px; color:#9ca3af; }

        /* ── 헤더 바 ── */
        .dir-header-bar { display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:14px; }
        .dir-branch-label { font-size:16px; font-weight:800; color:#0f2044; }
        .dir-date-label { font-size:13px; color:#6b7280; }
        .dir-refresh-btn { margin-left:auto; height:34px; padding:0 14px; font-size:12px; border:1px solid #e2e5eb; border-radius:7px; background:#fff; color:#374151; cursor:pointer; font-weight:600; }
        .dir-refresh-btn:hover { background:#f4f5f7; }

        /* ── KPI ── */
        .dir-kpi-row { display:grid; grid-template-columns:2fr 1fr 1fr 1fr; gap:12px; margin-bottom:14px; }
        @media(max-width:900px){ .dir-kpi-row { grid-template-columns:1fr 1fr; } }
        .dir-kpi-main { background:#fff; border:1px solid #e2e5eb; border-radius:10px; border-top:3px solid #0f2044; padding:18px 22px; box-shadow:0 1px 4px rgba(0,0,0,.06); }
        .dir-kpi-main-label { font-size:11px; font-weight:700; color:#9ca3af; letter-spacing:.07em; text-transform:uppercase; margin-bottom:6px; }
        .dir-kpi-main-num { font-size:30px; font-weight:800; color:#0f2044; letter-spacing:-.02em; line-height:1.1; font-variant-numeric:tabular-nums; }
        .dir-kpi-main-sub { font-size:11px; color:#9ca3af; margin-top:4px; }
        .dir-kpi-side { background:#fff; border:1px solid #e2e5eb; border-radius:10px; padding:16px 18px; box-shadow:0 1px 4px rgba(0,0,0,.06); display:flex; flex-direction:column; gap:5px; }
        .dir-kpi-side-label { font-size:11px; font-weight:700; color:#9ca3af; letter-spacing:.06em; text-transform:uppercase; }
        .dir-kpi-side-num { font-size:24px; font-weight:800; color:#111827; letter-spacing:-.01em; font-variant-numeric:tabular-nums; }
        .dir-kpi-side-sub { font-size:11px; color:#9ca3af; }

        /* ── 본문 2열 ── */
        .dir-body { display:grid; grid-template-columns:minmax(0,2fr) minmax(240px,1fr); gap:14px; margin-bottom:14px; align-items:start; }
        @media(max-width:800px){ .dir-body { grid-template-columns:1fr; } }

        /* ── 예약 목록 ── */
        .dir-resv-row { display:flex; align-items:center; padding:11px 16px; border-bottom:1px solid #f1f3f5; gap:12px; cursor:pointer; text-decoration:none; }
        .dir-resv-row:last-child { border-bottom:none; }
        .dir-resv-row:hover { background:#f8faff; }
        .dir-resv-time { font-size:14px; font-weight:800; color:#0f2044; min-width:42px; font-variant-numeric:tabular-nums; }
        .dir-resv-name { font-size:14px; font-weight:700; color:#111827; min-width:60px; }
        .dir-resv-product { font-size:13px; color:#374151; flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .dir-resv-source { font-size:11px; color:#9ca3af; white-space:nowrap; }
        .dir-status-badge { display:inline-block; padding:2px 8px; border-radius:999px; font-size:11px; font-weight:700; white-space:nowrap; flex-shrink:0; }

        /* ── 확인할 일 ── */
        .ops-row { display:flex; align-items:center; padding:12px 16px; border-bottom:1px solid #f3f4f6; gap:10px; flex-wrap:wrap; }
        .ops-row:last-child { border-bottom:none; }
        .ops-icon { font-size:18px; min-width:24px; flex-shrink:0; }
        .ops-text { flex:1 1 120px; min-width:0; }
        .ops-label { font-size:14px; font-weight:600; color:#111827; white-space:nowrap; }
        .ops-hint { font-size:11px; color:#9ca3af; margin-top:2px; word-break:keep-all; }
        .ops-right { display:flex; align-items:center; gap:8px; flex-shrink:0; }
        .ops-count { font-size:20px; font-weight:800; min-width:36px; text-align:right; font-variant-numeric:tabular-nums; }
        .ops-link-btn { padding:5px 11px; border-radius:6px; border:1.5px solid #1d4ed8; background:#eff6ff; color:#1d4ed8; font-size:12px; font-weight:700; cursor:pointer; white-space:nowrap; text-decoration:none; display:inline-block; }
        .ops-link-btn:hover { background:#dbeafe; }

        /* ── 출석 ── */
        .dir-att-row { display:flex; justify-content:space-between; align-items:center; padding:9px 20px; border-bottom:1px solid #f3f4f6; font-size:13px; }
        .dir-att-row:last-child { border-bottom:none; }
        .dir-branch-row { display:flex; justify-content:space-between; align-items:center; padding:11px 20px; border-bottom:1px solid #f3f4f6; }
        .dir-branch-row:last-child { border-bottom:none; }

        /* ── 바로가기 ── */
        .shortcut-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; padding:14px 16px; }
        @media(max-width:600px){ .shortcut-grid { grid-template-columns:1fr 1fr; } }
        .shortcut-btn { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; padding:14px 8px; border:1px solid #e2e5eb; border-radius:10px; background:#f8faff; cursor:pointer; text-decoration:none; color:#0f2044; transition:background .15s; }
        .shortcut-btn:hover { background:#eff6ff; border-color:#1d4ed8; }
        .shortcut-icon { font-size:22px; }
        .shortcut-label { font-size:12px; font-weight:700; text-align:center; white-space:nowrap; }

        /* ── 보조 KPI ── */
        .dir-sub-kpi { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:14px; }

        /* ── select 잘림 방지 ── */
        .dir-branch-select {
          box-sizing: border-box;
          height: 34px;
          padding: 0 10px;
          padding-right: 28px;
          font-size: 13px;
          border: 1px solid #e2e5eb;
          border-radius: 7px;
          background: #fff;
          appearance: auto;
          -webkit-appearance: auto;
        }
      `}</style>

      {/* ── 헤더 바 ── */}
      <div className="dir-header-bar">
        <span className="dir-branch-label">{headerBranch}</span>
        <span className="dir-date-label">{dateLabel()}</span>
        {isAdminOrOwner(user?.role) && (
          <select
            className="dir-branch-select"
            value={selBranch || "전체"}
            onChange={e => handleBranchChange(e.target.value)}
          >
            <option>전체</option>
            {branches.map(b => <option key={b.option_id}>{b.option_name}</option>)}
          </select>
        )}
        <button className="dir-refresh-btn" onClick={refresh}>↻ 새로고침</button>
      </div>

      {/* ── KPI ── */}
      <div className="dir-kpi-row">
        <div className="dir-kpi-main">
          <div className="dir-kpi-main-label">이번달 매출</div>
          <div className="dir-kpi-main-num">{loading ? "—" : money(summary?.month_sales)}</div>
          <div className="dir-kpi-main-sub">이번달 기준</div>
        </div>
        <div className="dir-kpi-side">
          <div className="dir-kpi-side-label">오늘 매출</div>
          <div className="dir-kpi-side-num">{loading ? "—" : money(summary?.today_sales)}</div>
          <div className="dir-kpi-side-sub">오늘 기준</div>
        </div>
        <div className="dir-kpi-side">
          <div className="dir-kpi-side-label">오늘 출석</div>
          <div className="dir-kpi-side-num">
            {loading ? "—" : (summary?.today_attendance ?? attendance.length)}
            <span style={{ fontSize: 14, fontWeight: 500, color: "#9ca3af" }}>명</span>
          </div>
          <div className="dir-kpi-side-sub">오늘 기준</div>
        </div>
        <div className="dir-kpi-side">
          <div className="dir-kpi-side-label">이용 가능</div>
          <div className="dir-kpi-side-num">
            {loading ? "—" : (summary?.active_members || 0)}
            <span style={{ fontSize: 14, fontWeight: 500, color: "#9ca3af" }}>명</span>
          </div>
          <div className="dir-kpi-side-sub">현재 기준</div>
        </div>
      </div>

      {/* ── 본문 2열: 오늘 예약 + 확인할 일 ── */}
      <div className="dir-body">

        {/* 오늘 예약 */}
        <div className="dir-card" style={{ marginBottom: 0 }}>
          <div className="dir-card-header" style={{ justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div className="dir-dot" style={{ background: "#0f2044" }} />
              <span className="dir-card-title">오늘 예약</span>
              {reservations !== null && (
                <span className="dir-card-sub">
                  전체 {reservations.length}건
                  {reservations.filter(r => !["CANCELLED","NOSHOW"].includes(r.status)).length !== reservations.length && (
                    <> · 취소·노쇼 {reservations.filter(r => ["CANCELLED","NOSHOW"].includes(r.status)).length}건 제외</>
                  )}
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <Link href="/naver-calendar?new=1" style={{ textDecoration: "none" }}>
                <button style={{ height: 28, padding: "0 10px", fontSize: 12, border: "1px solid #0f2044", borderRadius: 5, background: "#0f2044", color: "#fff", cursor: "pointer", fontWeight: 600 }}>
                  + 예약 등록
                </button>
              </Link>
              <Link href="/naver-calendar" style={{ textDecoration: "none" }}>
                <button style={{ height: 28, padding: "0 10px", fontSize: 12, border: "1px solid #e2e5eb", borderRadius: 5, background: "#fff", color: "#374151", cursor: "pointer" }}>
                  캘린더 보기
                </button>
              </Link>
            </div>
          </div>

          {reservations === null && reservErr ? (
            <div style={{ padding: "20px 16px", display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 13, color: "#dc2626" }}>예약 조회 실패</span>
              <button
                onClick={() => loadReservations(selBranch && selBranch !== "전체" ? selBranch : (isAdminOrOwner(user?.role) ? undefined : user?.branch_name))}
                style={{ height: 28, padding: "0 10px", fontSize: 12, border: "1px solid #e2e5eb", borderRadius: 5, background: "#fff", color: "#374151", cursor: "pointer" }}
              >
                재시도
              </button>
            </div>
          ) : reservations === null ? (
            <div style={{ padding: "20px 16px", color: "#9ca3af", fontSize: 13 }}>불러오는 중...</div>
          ) : reservations.length === 0 ? (
            <div style={{ padding: "24px 20px", color: "#9ca3af", fontSize: 13, textAlign: "center" }}>
              오늘 예정된 예약이 없습니다
            </div>
          ) : (
            <div>
              {reservations.map((r: any) => {
                const st = STATUS_STYLE[r.status] || { bg: "#f3f4f6", color: "#6b7280", label: r.status };
                const isClosed = r.status === "CANCELLED" || r.status === "NOSHOW";
                return (
                  <Link
                    key={r.reservation_id}
                    href={`/naver-calendar?id=${r.reservation_id}`}
                    style={{ textDecoration: "none" }}
                  >
                    <div className="dir-resv-row" style={{ opacity: isClosed ? 0.55 : 1 }}>
                      <span className="dir-resv-time">{fmtTime(r.reservation_time)}</span>
                      <span className="dir-resv-name">{r.customer_name}</span>
                      <span className="dir-resv-product">{r.reservation_product || "—"}</span>
                      {r.source_type && (
                        <span className="dir-resv-source">{r.source_type === "NAVER" ? "네이버" : r.source_type === "MANUAL" ? "수동" : r.source_type}</span>
                      )}
                      <span className="dir-status-badge" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* 확인할 일 */}
        <div className="dir-card" style={{ marginBottom: 0 }}>
          <div className="dir-card-header">
            <div className="dir-dot" style={{ background: "#dc2626" }} />
            <span className="dir-card-title">확인할 일</span>
          </div>
          {opsItems.map(item => (
            <div key={item.label} className="ops-row">
              <div className="ops-icon">{item.icon}</div>
              <div className="ops-text">
                <div className="ops-label">{item.label}</div>
                <div className="ops-hint">{item.hint}</div>
              </div>
              <div className="ops-right">
                <div className="ops-count" style={{ color: item.count !== null && item.count > 0 ? item.warnColor : "#9ca3af" }}>
                  {item.count === null ? "—" : item.count}
                </div>
                {item.count !== null && item.count > 0 && (
                  <Link href={item.href} className="ops-link-btn">보기</Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 업무 바로가기 ── */}
      <div className="dir-card">
        <div className="dir-card-header">
          <div className="dir-dot" style={{ background: "#6366f1" }} />
          <span className="dir-card-title">업무 바로가기</span>
        </div>
        <div className="shortcut-grid">
          {[
            { icon: "📋", label: "예약 등록", href: "/naver-calendar?new=1" },
            { icon: "👤", label: "회원 등록", href: "/members?action=add" },
            { icon: "💳", label: "결제", href: "/members" },
            { icon: "📊", label: "매출 조회", href: "/sales" },
          ].map(s => (
            <Link key={s.label} href={s.href} className="shortcut-btn">
              <span className="shortcut-icon">{s.icon}</span>
              <span className="shortcut-label">{s.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* ── 최근 출석 + 보조 KPI ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
        {/* 최근 출석 */}
        <div className="dir-card" style={{ marginBottom: 0 }}>
          <div className="dir-card-header" style={{ justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div className="dir-dot" style={{ background: "#0f2044" }} />
              <span className="dir-card-title">최근 출석</span>
              <span className="dir-card-sub">{attendance.length}명</span>
            </div>
            <Link href="/attendance" style={{ fontSize: 12, color: "#1d4ed8", textDecoration: "none", fontWeight: 600 }}>전체 보기 →</Link>
          </div>
          {loading ? (
            <div style={{ padding: "14px 20px", color: "#9ca3af", fontSize: 13 }}>로딩 중...</div>
          ) : attendance.length === 0 ? (
            <div style={{ padding: "14px 20px", color: "#9ca3af", fontSize: 13 }}>오늘 출석 없음</div>
          ) : (
            attendance.slice(0, 5).map((a: any, i: number) => (
              <div key={i} className="dir-att-row">
                <span style={{ fontWeight: 600, color: "#111827" }}>{a.name}</span>
                <span style={{ color: "#9ca3af", fontSize: 12 }}>
                  {a.checkin_time
                    ? new Date(a.checkin_time).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Seoul" })
                    : ""}
                </span>
              </div>
            ))
          )}
        </div>

        {/* 이번달 신규·재등록 */}
        <div className="dir-card" style={{ marginBottom: 0 }}>
          <div className="dir-card-header">
            <div className="dir-dot" style={{ background: "#6366f1" }} />
            <span className="dir-card-title">이번달 등록 현황</span>
          </div>
          <div style={{ padding: "14px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
            {[
              { label: "신규 등록", val: summary?.today_new ?? 0, sub: "오늘", color: "#0f2044" },
              { label: "이번달 신규", val: summary?.month_new ?? 0, sub: "이번달", color: "#1d4ed8" },
            ].map(k => (
              <div key={k.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 13, color: "#6b7280" }}>{k.sub}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{k.label}</div>
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, color: k.color, fontVariantNumeric: "tabular-nums" }}>
                  {loading ? "—" : k.val}<span style={{ fontSize: 13, fontWeight: 500, color: "#9ca3af" }}>명</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 전 지점 출석 (접기) ── */}
      <div className="dir-card">
        <button
          onClick={() => setShowAllBranch(v => !v)}
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", background: "none", border: "none", cursor: "pointer", padding: "13px 20px", textAlign: "left" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div className="dir-dot" style={{ background: "#6366f1" }} />
            <span style={{ fontWeight: 700, fontSize: 13, color: "#111827" }}>전체 지점 오늘 출석</span>
          </div>
          <span style={{ color: "#9ca3af", fontSize: 12 }}>{showAllBranch ? "▲" : "▼"}</span>
        </button>
        {showAllBranch && (
          <>
            <div style={{ height: 1, background: "#e2e5eb" }} />
            {allBranches.map(b => (
              <div key={b.branch_name} className="dir-branch-row">
                <span style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>{b.branch_name}</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: b.count > 0 ? "#0f2044" : "#9ca3af", fontVariantNumeric: "tabular-nums" }}>
                  {b.count}<span style={{ fontSize: 12, fontWeight: 400, color: "#9ca3af" }}>명</span>
                </span>
              </div>
            ))}
          </>
        )}
      </div>
    </AppShell>
  );
}
