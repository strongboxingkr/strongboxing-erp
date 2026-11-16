"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { apiFetch } from "@/lib/api";
import Link from "next/link";

const money = (v: any) => `${Number(v || 0).toLocaleString()}원`;
const today = new Date().toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" });
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  PENDING:   { bg: "#fef3c7", color: "#92400e",  label: "대기" },
  CONFIRMED: { bg: "#dbeafe", color: "#1d4ed8",  label: "확정" },
  VISITED:   { bg: "#dcfce7", color: "#166534",  label: "방문" },
  CANCELLED: { bg: "#f3f4f6", color: "#9ca3af",  label: "취소" },
  NOSHOW:    { bg: "#fee2e2", color: "#dc2626",   label: "노쇼" },
};

export default function DirectorDashboardPage() {
  const [user, setUser]       = useState<any>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [selBranch, setSelBranch] = useState("전체");
  const [summary, setSummary] = useState<any>(null);
  const [attendance, setAttendance]     = useState<any[]>([]);
  const [allBranches, setAllBranches]   = useState<any[]>([]);
  const [expiring, setExpiring]         = useState<any[]>([]);
  const [reservations, setReservations] = useState<any[] | null>(null);
  const [reservErr, setReservErr]       = useState(false);
  const [loading, setLoading]     = useState(true);
  const [showExpiring, setShowExpiring] = useState(false);

  const isAdminOrOwner = (role?: string) => role === "ADMIN" || role === "OWNER";

  /* ── 핵심 데이터 로드 (기존 로직 그대로 유지) ── */
  const loadData = async (u: any, branch?: string) => {
    setLoading(true);

    // 관장은 담당 지점 고정, 대표·관리자는 선택 지점
    const branchParam = isAdminOrOwner(u.role)
      ? (branch && branch !== "전체" ? `?branch_name=${encodeURIComponent(branch)}` : "")
      : (u.branch_name ? `?branch_name=${encodeURIComponent(u.branch_name)}` : "");

    try {
      const [sumRes, attRes, allAttRes, expRes] = await Promise.all([
        apiFetch(`/api/dashboard/summary${branchParam}`),
        apiFetch(`/api/attendance/live${branchParam}`),
        apiFetch(`/api/attendance/live?all_branches=true`),
        apiFetch(`/api/members?status=ACTIVE&expiring=7${branchParam ? branchParam.replace("?", "&") : ""}`),
      ]);

      const [sumJson, attJson, allAttJson, expJson] = await Promise.all([
        sumRes.json(), attRes.json(), allAttRes.json(), expRes.json(),
      ]);

      setSummary(sumJson.data);
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
      }).sort((a: any, b: any) => new Date(a.end_date).getTime() - new Date(b.end_date).getTime());
      setExpiring(expRows.slice(0, 10));
    } catch (e) {
      console.error("dashboard load error", e);
    }

    setLoading(false);

    // 예약은 독립적으로 로드
    loadReservations(
      isAdminOrOwner(u.role)
        ? (branch && branch !== "전체" ? branch : undefined)
        : u.branch_name
    );
  };

  /* ── 예약 로드 ── */
  const loadReservations = async (branch?: string) => {
    setReservErr(false);
    try {
      const bp = branch ? `?branch_name=${encodeURIComponent(branch)}` : "";
      const res = await apiFetch(`/api/naver-reservations${bp}`);
      if (!res.ok) { setReservErr(true); return; }
      const json = await res.json();
      const tday = todayISO();
      const rows = (json.rows || [])
        .filter((r: any) => r.reservation_date === tday)
        .sort((a: any, b: any) => (a.reservation_time || "").localeCompare(b.reservation_time || ""));
      setReservations(rows);
    } catch {
      setReservErr(true);
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem("user");
    if (!saved) return;
    const u = JSON.parse(saved);
    setUser(u);
    if (isAdminOrOwner(u.role)) {
      apiFetch("/api/settings?option_type=BRANCH").then(r => r.json()).then(d => setBranches(d.rows || []));
    }
    loadData(u);
  }, []);

  const handleBranchChange = (b: string) => {
    setSelBranch(b);
    loadData(user, b);
  };

  const branchLabel = (() => {
    if (!user) return "";
    if (isAdminOrOwner(user.role)) return selBranch === "전체" ? "" : user.branch_name || "";
    return user.branch_name || "";
  })();

  return (
    <AppShell title="관장 대시보드">
      <style>{`
        /* ── 공통 (대표 대시보드 동일 계열) ── */
        .dir-card { background:#fff; border:1px solid #e2e5eb; border-radius:10px; overflow:hidden; box-shadow:0 1px 4px rgba(0,0,0,.06); margin-bottom:14px; }
        .dir-card-header { padding:13px 20px; border-bottom:1px solid #e2e5eb; display:flex; align-items:center; gap:8px; }
        .dir-dot { width:6px; height:6px; border-radius:50%; flex-shrink:0; }
        .dir-card-title { font-size:13px; font-weight:700; color:#111827; }
        .dir-card-sub { font-size:11px; color:#9ca3af; }

        /* ── 6 KPI ── */
        .dir-kpi6 { display:grid; grid-template-columns:repeat(6,1fr); gap:12px; margin-bottom:14px; }
        @media(max-width:1100px){ .dir-kpi6 { grid-template-columns:repeat(3,1fr); } }
        @media(max-width:640px){  .dir-kpi6 { grid-template-columns:repeat(2,1fr); } }
        .dir-kpi-card { background:#fff; border:1px solid #e2e5eb; border-radius:10px; padding:16px 18px; box-shadow:0 1px 4px rgba(0,0,0,.06); }
        .dir-kpi-card.main { border-top:3px solid #0f2044; }
        .dir-kpi-label { font-size:11px; font-weight:700; color:#9ca3af; letter-spacing:.06em; text-transform:uppercase; margin-bottom:6px; white-space:nowrap; }
        .dir-kpi-num { font-size:22px; font-weight:800; color:#0f2044; letter-spacing:-.01em; font-variant-numeric:tabular-nums; line-height:1.2; }
        .dir-kpi-num.lg { font-size:26px; }
        .dir-kpi-sub { font-size:11px; color:#9ca3af; margin-top:3px; }

        /* ── 필터 ── */
        .dir-filter { display:flex; align-items:center; gap:10px; margin-bottom:14px; flex-wrap:wrap; }
        .dir-branch-select { box-sizing:border-box; height:34px; padding:0 10px; padding-right:28px; font-size:13px; border:1px solid #e2e5eb; border-radius:7px; background:#fff; appearance:auto; -webkit-appearance:auto; cursor:pointer; }
        .dir-refresh-btn { height:34px; padding:0 14px; font-size:12px; border:1px solid #e2e5eb; border-radius:7px; background:#fff; color:#374151; cursor:pointer; font-weight:600; margin-left:auto; }
        .dir-refresh-btn:hover { background:#f4f5f7; }

        /* ── 오늘 예약 ── */
        .resv-row { display:flex; align-items:center; padding:10px 16px; border-bottom:1px solid #f1f3f5; gap:12px; text-decoration:none; cursor:pointer; }
        .resv-row:last-child { border-bottom:none; }
        .resv-row:hover { background:#f8faff; }
        .resv-time { font-size:14px; font-weight:800; color:#0f2044; min-width:40px; font-variant-numeric:tabular-nums; }
        .resv-name { font-size:14px; font-weight:700; color:#111827; min-width:56px; white-space:nowrap; }
        .resv-product { font-size:13px; color:#374151; flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .resv-source { font-size:11px; color:#9ca3af; white-space:nowrap; }
        .resv-badge { display:inline-block; padding:2px 8px; border-radius:999px; font-size:11px; font-weight:700; white-space:nowrap; flex-shrink:0; }

        /* ── 오늘 출석 / 지점 ── */
        .dir-two-col { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:14px; align-items:start; }
        @media(max-width:720px){ .dir-two-col { grid-template-columns:1fr; } }
        .dir-att-row { display:flex; justify-content:space-between; align-items:center; padding:9px 20px; border-bottom:1px solid #f3f4f6; font-size:13px; }
        .dir-att-row:last-child { border-bottom:none; }
        .dir-branch-row { display:flex; justify-content:space-between; align-items:center; padding:11px 20px; border-bottom:1px solid #f3f4f6; }
        .dir-branch-row:last-child { border-bottom:none; }

        /* ── 만료 임박 ── */
        .dir-expire-row { display:flex; align-items:center; padding:10px 20px; border-bottom:1px solid #f3f4f6; gap:12px; text-decoration:none; display:flex; }
        .dir-expire-row:last-child { border-bottom:none; }
        .dir-expire-row:hover { background:#fef9f9; }

        /* ── 헤더 액션 버튼 ── */
        .dir-hdr-btn { height:28px; padding:0 10px; font-size:12px; border-radius:5px; cursor:pointer; font-weight:600; white-space:nowrap; }
      `}</style>

      {/* ── 필터 / 날짜 헤더 ── */}
      <div className="dir-filter">
        <span style={{ fontSize: 13, color: "#6b7280" }}>{today}{branchLabel ? ` · ${branchLabel}` : ""}</span>
        {isAdminOrOwner(user?.role) && (
          <select
            className="dir-branch-select"
            value={selBranch}
            onChange={e => handleBranchChange(e.target.value)}
          >
            <option>전체</option>
            {branches.map(b => <option key={b.option_id}>{b.option_name}</option>)}
          </select>
        )}
        <button className="dir-refresh-btn" onClick={() => loadData(user, selBranch)}>↻ 새로고침</button>
      </div>

      {/* ── 6개 KPI ── */}
      <div className="dir-kpi6">
        <div className="dir-kpi-card main">
          <div className="dir-kpi-label">오늘 매출</div>
          <div className="dir-kpi-num lg">{loading ? "—" : money(summary?.today_sales)}</div>
          <div className="dir-kpi-sub">오늘 기준</div>
        </div>
        <div className="dir-kpi-card main">
          <div className="dir-kpi-label">이번달 매출</div>
          <div className="dir-kpi-num lg">{loading ? "—" : money(summary?.month_sales)}</div>
          <div className="dir-kpi-sub">이번달 기준</div>
        </div>
        <div className="dir-kpi-card">
          <div className="dir-kpi-label">활성 회원</div>
          <div className="dir-kpi-num">{loading ? "—" : (summary?.active_members || 0)}<span style={{ fontSize: 13, fontWeight: 500, color: "#9ca3af" }}>명</span></div>
          <div className="dir-kpi-sub">현재 기준</div>
        </div>
        <div className="dir-kpi-card">
          <div className="dir-kpi-label">오늘 출석</div>
          <div className="dir-kpi-num">{loading ? "—" : (summary?.today_attendance || 0)}<span style={{ fontSize: 13, fontWeight: 500, color: "#9ca3af" }}>명</span></div>
          <div className="dir-kpi-sub">오늘 기준</div>
        </div>
        <div className="dir-kpi-card">
          <div className="dir-kpi-label">오늘 신규 등록</div>
          <div className="dir-kpi-num">{loading ? "—" : (summary?.today_new || 0)}<span style={{ fontSize: 13, fontWeight: 500, color: "#9ca3af" }}>명</span></div>
          <div className="dir-kpi-sub">오늘</div>
        </div>
        <div className="dir-kpi-card">
          <div className="dir-kpi-label">이번달 신규 등록</div>
          <div className="dir-kpi-num">{loading ? "—" : (summary?.month_new || 0)}<span style={{ fontSize: 13, fontWeight: 500, color: "#9ca3af" }}>명</span></div>
          <div className="dir-kpi-sub">이번달</div>
        </div>
      </div>

      {/* ── 오늘 예약 ── */}
      <div className="dir-card">
        <div className="dir-card-header" style={{ justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div className="dir-dot" style={{ background: "#0f2044" }} />
            <span className="dir-card-title">오늘 예약</span>
            {reservations !== null && (
              <span className="dir-card-sub">
                {reservations.filter(r => !["CANCELLED","NOSHOW"].includes(r.status)).length}건 예정
                {reservations.filter(r => ["CANCELLED","NOSHOW"].includes(r.status)).length > 0 &&
                  ` · 취소/노쇼 ${reservations.filter(r => ["CANCELLED","NOSHOW"].includes(r.status)).length}건`}
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <Link href="/naver-calendar" style={{ textDecoration: "none" }}>
              <button className="dir-hdr-btn" style={{ border: "1px solid #0f2044", background: "#0f2044", color: "#fff" }}>
                + 예약 등록
              </button>
            </Link>
            <Link href="/naver-calendar" style={{ textDecoration: "none" }}>
              <button className="dir-hdr-btn" style={{ border: "1px solid #e2e5eb", background: "#fff", color: "#374151" }}>
                캘린더 보기
              </button>
            </Link>
          </div>
        </div>

        {reservErr ? (
          <div style={{ padding: "14px 20px", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 13, color: "#dc2626" }}>예약 조회 실패</span>
            <button
              onClick={() => loadReservations(
                isAdminOrOwner(user?.role)
                  ? (selBranch !== "전체" ? selBranch : undefined)
                  : user?.branch_name
              )}
              style={{ height: 28, padding: "0 10px", fontSize: 12, border: "1px solid #e2e5eb", borderRadius: 5, background: "#fff", cursor: "pointer" }}
            >재시도</button>
          </div>
        ) : reservations === null ? (
          <div style={{ padding: "14px 20px", color: "#9ca3af", fontSize: 13 }}>불러오는 중...</div>
        ) : reservations.length === 0 ? (
          <div style={{ padding: "14px 20px", color: "#9ca3af", fontSize: 13 }}>오늘 예정된 예약이 없습니다</div>
        ) : (
          reservations.map((r: any) => {
            const st = STATUS_STYLE[r.status] || { bg: "#f3f4f6", color: "#6b7280", label: r.status };
            const isClosed = r.status === "CANCELLED" || r.status === "NOSHOW";
            return (
              <Link key={r.reservation_id} href={`/naver-calendar?id=${r.reservation_id}`} style={{ textDecoration: "none" }}>
                <div className="resv-row" style={{ opacity: isClosed ? 0.5 : 1 }}>
                  <span className="resv-time">{(r.reservation_time || "").slice(0, 5)}</span>
                  <span className="resv-name">{r.customer_name}</span>
                  <span className="resv-product">{r.reservation_product || "—"}</span>
                  {r.source_type && (
                    <span className="resv-source">
                      {r.source_type === "NAVER" ? "네이버" : r.source_type === "MANUAL" ? "수동" : r.source_type}
                    </span>
                  )}
                  <span className="resv-badge" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                </div>
              </Link>
            );
          })
        )}
      </div>

      {/* ── 오늘 출석 + 전체 지점 출석 ── */}
      <div className="dir-two-col">
        <div className="dir-card" style={{ marginBottom: 0 }}>
          <div className="dir-card-header">
            <div className="dir-dot" style={{ background: "#0f2044" }} />
            <span className="dir-card-title">오늘 출석</span>
            <span className="dir-card-sub">{attendance.length}명</span>
          </div>
          {loading ? (
            <div style={{ padding: "14px 20px", color: "#9ca3af", fontSize: 13 }}>로딩 중...</div>
          ) : attendance.length === 0 ? (
            <div style={{ padding: "14px 20px", color: "#9ca3af", fontSize: 13 }}>오늘 출석 없음</div>
          ) : (
            <div style={{ maxHeight: 300, overflowY: "auto" }}>
              {attendance.map((a: any, i: number) => (
                <div key={i} className="dir-att-row">
                  <span style={{ fontWeight: 600, color: "#111827" }}>{a.name}</span>
                  <span style={{ color: "#9ca3af", fontSize: 12 }}>
                    {a.checkin_time
                      ? new Date(a.checkin_time).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Seoul" })
                      : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="dir-card" style={{ marginBottom: 0 }}>
          <div className="dir-card-header">
            <div className="dir-dot" style={{ background: "#6366f1" }} />
            <span className="dir-card-title">전체 지점 당일 출석</span>
          </div>
          {loading ? (
            <div style={{ padding: "14px 20px", color: "#9ca3af", fontSize: 13 }}>로딩 중...</div>
          ) : (
            allBranches.map(b => (
              <div key={b.branch_name} className="dir-branch-row">
                <span style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>{b.branch_name}</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: b.count > 0 ? "#0f2044" : "#9ca3af", fontVariantNumeric: "tabular-nums" }}>
                  {b.count}<span style={{ fontSize: 12, fontWeight: 400, color: "#9ca3af" }}>명</span>
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── 만료 임박 회원 (접기/펼치기) ── */}
      <div className="dir-card">
        <button
          onClick={() => setShowExpiring(v => !v)}
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", background: "none", border: "none", cursor: "pointer", padding: "13px 20px", textAlign: "left" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div className="dir-dot" style={{ background: "#dc2626" }} />
            <span style={{ fontWeight: 700, fontSize: 13, color: "#111827" }}>만료 임박 회원</span>
            <span style={{ fontSize: 12, color: "#9ca3af" }}>3일 이내</span>
            {!loading && expiring.length > 0 && (
              <span style={{ background: "#fee2e2", color: "#dc2626", borderRadius: 999, fontSize: 11, fontWeight: 700, padding: "1px 8px" }}>{expiring.length}</span>
            )}
          </div>
          <span style={{ color: "#9ca3af", fontSize: 12 }}>{showExpiring ? "▲" : "▼"}</span>
        </button>
        {showExpiring && (
          <>
            <div style={{ height: 1, background: "#e2e5eb" }} />
            {loading ? (
              <div style={{ padding: "14px 20px", color: "#9ca3af", fontSize: 13 }}>로딩 중...</div>
            ) : expiring.length === 0 ? (
              <div style={{ padding: "14px 20px", color: "#9ca3af", fontSize: 13 }}>만료 임박 회원 없음</div>
            ) : expiring.map((m: any) => (
              <Link key={m.member_id} href={`/members?member_id=${m.member_id}`} style={{ textDecoration: "none", display: "block" }}>
                <div className="dir-expire-row">
                  <div style={{ width: 3, alignSelf: "stretch", minHeight: 36, background: "#ef4444", borderRadius: 2, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>{m.name}</div>
                    <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 1 }}>{m.product_name}</div>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#ef4444", whiteSpace: "nowrap" }}>
                    ~{String(m.end_date || "").slice(5, 10)}
                  </div>
                </div>
              </Link>
            ))}
          </>
        )}
      </div>
    </AppShell>
  );
}
