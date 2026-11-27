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
  const [expiring, setExpiring]         = useState<any[]>([]);
  const [reservations, setReservations] = useState<any[] | null>(null);
  const [reservErr, setReservErr]       = useState(false);
  const [loading, setLoading]     = useState(true);
  const [showExpiring, setShowExpiring] = useState(false);
  const [pinnedMember, setPinnedMember] = useState<any>(null);

  // 공지·일정
  const [notices, setNotices]     = useState<any[]>([]);
  const [events, setEvents]       = useState<any[] | null>(null);
  const [noticeDetail, setNoticeDetail] = useState<any>(null);

  // 자동문자 현황
  const [smsLogs, setSmsLogs]       = useState<any[]>([]);
  const [showSms, setShowSms]       = useState(false);
  const [smsLoading, setSmsLoading] = useState(false);

  const isAdminOrOwner = (role?: string) => role === "ADMIN" || role === "OWNER";

  /* ── 핵심 데이터 로드 (기존 로직 그대로 유지) ── */
  const loadData = async (u: any, branch?: string) => {
    setLoading(true);

    // 관장은 담당 지점 고정, 대표·관리자는 선택 지점
    const branchParam = isAdminOrOwner(u.role)
      ? (branch && branch !== "전체" ? `?branch_name=${encodeURIComponent(branch)}` : "")
      : (u.branch_name ? `?branch_name=${encodeURIComponent(u.branch_name)}` : "");

    try {
      const [sumRes, attRes, expRes] = await Promise.all([
        apiFetch(`/api/dashboard/summary${branchParam}`),
        apiFetch(`/api/attendance/live${branchParam}`),
        apiFetch(`/api/members?status=ACTIVE&expiring=7${branchParam ? branchParam.replace("?", "&") : ""}`),
      ]);

      const [sumJson, attJson, expJson] = await Promise.all([
        sumRes.json(), attRes.json(), expRes.json(),
      ]);

      setSummary(sumJson.data);
      setAttendance(attJson.rows || []);


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

    // 공지·일정 로드
    loadNoticesAndEvents(
      isAdminOrOwner(u.role)
        ? (branch && branch !== "전체" ? branch : undefined)
        : u.branch_name
    );

    // 예약은 독립적으로 로드
    loadReservations(
      isAdminOrOwner(u.role)
        ? (branch && branch !== "전체" ? branch : undefined)
        : u.branch_name
    );
  };

  /* ── 공지·일정 로드 ── */
  const loadNoticesAndEvents = async (branch?: string) => {
    try {
      const bp = branch ? `?branch_name=${encodeURIComponent(branch)}` : "";
      const nRes = await apiFetch(`/api/notices${bp}`);
      const nJson = await nRes.json();
      const today = new Date().toISOString().slice(0, 10);
      const filtered = (nJson.rows || []).filter((n: any) => {
        if (n.use_yn === "N") return false;
        const st = n.status || "PUBLISHED";
        if (st !== "PUBLISHED") return false;
        if (n.start_date && n.start_date.slice(0, 10) > today) return false;
        if (n.end_date && n.end_date.slice(0, 10) < today) return false;
        return true;
      }).sort((a: any, b: any) => (b.is_important || 0) - (a.is_important || 0));
      setNotices(filtered);
    } catch { setNotices([]); }

    try {
      const bp = branch ? `?branch_name=${encodeURIComponent(branch)}&status=PUBLISHED&upcoming=1` : "?status=PUBLISHED&upcoming=1";
      const eRes = await apiFetch(`/api/events${bp}`);
      const eJson = await eRes.json();
      setEvents(eJson.success ? (eJson.rows || []) : []);
    } catch { setEvents([]); }
  };

  /* ── SMS 로그 로드 ── */
  const loadSmsLogs = async (branch?: string) => {
    setSmsLoading(true);
    try {
      const bp = branch ? `?branch_name=${encodeURIComponent(branch)}` : "";
      const res = await apiFetch(`/api/sms/logs${bp}`);
      const data = await res.json();
      setSmsLogs(data.rows || []);
    } catch { setSmsLogs([]); }
    setSmsLoading(false);
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

  // 최근 입장 10초 자동 갱신
  useEffect(() => {
    if (!user) return;
    const refreshAttendance = async () => {
      const branchParam = isAdminOrOwner(user.role)
        ? (selBranch && selBranch !== "전체" ? `?branch_name=${encodeURIComponent(selBranch)}` : "")
        : (user.branch_name ? `?branch_name=${encodeURIComponent(user.branch_name)}` : "");
      try {
        const res = await apiFetch(`/api/attendance/live${branchParam}`);
        const data = await res.json();
        if (data.rows) setAttendance(data.rows);
      } catch {}
    };
    const timer = setInterval(refreshAttendance, 10000);
    return () => clearInterval(timer);
  }, [user, selBranch]);

  const handleBranchChange = (b: string) => {
    setSelBranch(b);
    loadData(user, b);
    if (showSms) {
      loadSmsLogs(b !== "전체" ? b : undefined);
    } else {
      setSmsLogs([]);
    }
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

        /* ── 5 KPI ── */
        .dir-kpi6 { display:grid; grid-template-columns:minmax(0,2fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr); gap:12px; margin-bottom:14px; }
        @media(max-width:1100px){ .dir-kpi6 { grid-template-columns:repeat(3,1fr); } }
        @media(max-width:640px){  .dir-kpi6 { grid-template-columns:repeat(2,1fr); } }
        .dir-kpi-card { background:#fff; border:1px solid #e2e5eb; border-radius:10px; padding:16px 18px; box-shadow:0 1px 4px rgba(0,0,0,.06); min-width:0; }
        .dir-kpi-card.main { border-top:3px solid #0f2044; }
        .dir-kpi-label { font-size:11px; font-weight:700; color:#9ca3af; letter-spacing:.06em; text-transform:uppercase; margin-bottom:6px; white-space:nowrap; }
        /* white-space:nowrap으로 금액+원 줄바꿈 방지, 넘칠 경우 font-size 축소 */
        .dir-kpi-num { font-size:22px; font-weight:800; color:#0f2044; letter-spacing:-.01em; font-variant-numeric:tabular-nums; line-height:1.2; white-space:nowrap; overflow:hidden; }
        .dir-kpi-num.lg { font-size:clamp(18px,2.2vw,26px); }
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

        /* ── 2열 그리드 ── */
        .dir-two-col { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:14px; align-items:start; }
        @media(max-width:720px){ .dir-two-col { grid-template-columns:1fr; } }
        /* 출석 섹션: 최근입장(좁음) + 출석목록(넓음) */
        .dir-att-col { display:grid; grid-template-columns:3fr 2fr; gap:14px; margin-bottom:14px; align-items:stretch; }
        .dir-att-col > .dir-card { display:flex; flex-direction:column; }
        @media(max-width:720px){ .dir-att-col { grid-template-columns:1fr; } }
        /* 최근 입장 회원 카드 */
        .dir-latest-name { font-size:28px; font-weight:800; color:#0f2044; margin:4px 0; }
        .dir-latest-time { font-size:14px; color:#9ca3af; }
        .dir-latest-product { font-size:13px; color:#374151; margin-top:6px; }
        .dir-att-row { display:flex; justify-content:space-between; align-items:center; padding:9px 20px; border-bottom:1px solid #f3f4f6; font-size:13px; }
        .dir-att-row:last-child { border-bottom:none; }
        /* 공지·일정 카드 */
        .dir-ni-row { padding:10px 20px; border-bottom:1px solid #f3f4f6; cursor:pointer; }
        .dir-ni-row:last-child { border-bottom:none; }
        .dir-ni-row:hover { background:#f8faff; }
        .dir-ni-title { font-size:13px; font-weight:700; color:#111827; margin-bottom:2px; }
        .dir-ni-meta { font-size:11px; color:#9ca3af; display:flex; gap:6px; align-items:center; flex-wrap:wrap; }
        .dir-ni-badge { display:inline-block; padding:1px 7px; border-radius:999px; font-size:10px; font-weight:700; white-space:nowrap; }

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

      {/* ── 5개 KPI (이번달 매출 제거) ── */}
      <div className="dir-kpi6">
        <div className="dir-kpi-card main">
          <div className="dir-kpi-label">오늘 매출</div>
          <div className="dir-kpi-num lg">{loading ? "—" : money(summary?.today_sales)}</div>
          <div className="dir-kpi-sub">오늘 기준</div>
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
          <div className="dir-kpi-label">오늘 신규</div>
          <div className="dir-kpi-num">{loading ? "—" : (summary?.today_new || 0)}<span style={{ fontSize: 13, fontWeight: 500, color: "#9ca3af" }}>명</span></div>
          <div className="dir-kpi-sub">가입일 기준</div>
        </div>
        <div className="dir-kpi-card">
          <div className="dir-kpi-label">이번달 신규</div>
          <div className="dir-kpi-num">{loading ? "—" : (summary?.month_new || 0)}<span style={{ fontSize: 13, fontWeight: 500, color: "#9ca3af" }}>명</span></div>
          <div className="dir-kpi-sub">가입일 기준</div>
        </div>
      </div>

      {/* ── 예약 현황 + 공지·일정 나란히 ── */}
      <div className="dir-two-col">
        {/* 예약 현황 */}
        <div className="dir-card" style={{ marginBottom: 0 }}>
          <div className="dir-card-header" style={{ justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div className="dir-dot" style={{ background: "#0f2044" }} />
              <span className="dir-card-title">오늘 예약</span>
              {reservations !== null && (
                <span className="dir-card-sub">
                  {reservations.filter(r => !["CANCELLED","NOSHOW"].includes(r.status)).length}건 예정
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <Link href="/naver-calendar" style={{ textDecoration: "none" }}>
                <button className="dir-hdr-btn" style={{ border: "1px solid #0f2044", background: "#0f2044", color: "#fff" }}>+ 예약 등록</button>
              </Link>
              <Link href="/naver-calendar" style={{ textDecoration: "none" }}>
                <button className="dir-hdr-btn" style={{ border: "1px solid #e2e5eb", background: "#fff", color: "#374151" }}>캘린더</button>
              </Link>
            </div>
          </div>
          {reservErr ? (
            <div style={{ padding: "14px 20px", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 13, color: "#dc2626" }}>예약 조회 실패</span>
              <button onClick={() => loadReservations(isAdminOrOwner(user?.role) ? (selBranch !== "전체" ? selBranch : undefined) : user?.branch_name)}
                style={{ height: 28, padding: "0 10px", fontSize: 12, border: "1px solid #e2e5eb", borderRadius: 5, background: "#fff", cursor: "pointer" }}>재시도</button>
            </div>
          ) : reservations === null ? (
            <div style={{ padding: "14px 20px", color: "#9ca3af", fontSize: 13 }}>불러오는 중...</div>
          ) : reservations.length === 0 ? (
            <div style={{ padding: "14px 20px", color: "#9ca3af", fontSize: 13 }}>오늘 예정된 예약이 없습니다</div>
          ) : (
            reservations.slice(0, 5).map((r: any) => {
              const st = STATUS_STYLE[r.status] || { bg: "#f3f4f6", color: "#6b7280", label: r.status };
              const isClosed = r.status === "CANCELLED" || r.status === "NOSHOW";
              return (
                <Link key={r.reservation_id} href={`/naver-calendar?id=${r.reservation_id}`} style={{ textDecoration: "none" }}>
                  <div className="resv-row" style={{ opacity: isClosed ? 0.5 : 1 }}>
                    <span className="resv-time">{(r.reservation_time || "").slice(0, 5)}</span>
                    <span className="resv-name">{r.customer_name}</span>
                    <span className="resv-product">{r.reservation_product || "—"}</span>
                    <span className="resv-badge" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                  </div>
                </Link>
              );
            })
          )}
        </div>

        {/* 공지·일정 */}
        <div className="dir-card" style={{ marginBottom: 0 }}>
          <div className="dir-card-header" style={{ justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div className="dir-dot" style={{ background: "#6366f1" }} />
              <span className="dir-card-title">공지·일정</span>
              {(notices.length + (events?.length || 0)) > 0 && (
                <span className="dir-card-sub">{notices.length + (events?.length || 0)}건</span>
              )}
            </div>
            <Link href="/notice-management" style={{ fontSize: 12, color: "#1d4ed8", textDecoration: "none", fontWeight: 600, whiteSpace: "nowrap" }}>관리 →</Link>
          </div>
          {loading ? (
            <div style={{ padding: "14px 20px", color: "#9ca3af", fontSize: 13 }}>로딩 중...</div>
          ) : notices.length === 0 && (events === null || events.length === 0) ? (
            <div style={{ padding: "14px 20px", color: "#9ca3af", fontSize: 13 }}>공지·일정 없음</div>
          ) : (
            <>
              {notices.slice(0, 3).map((n: any) => (
                <div key={n.notice_id} className="dir-ni-row" onClick={() => setNoticeDetail(n)}>
                  <div className="dir-ni-title">
                    {n.is_important ? <span style={{ color: "#dc2626", marginRight: 4 }}>★</span> : null}
                    {n.title}
                  </div>
                  <div className="dir-ni-meta">
                    <span className="dir-ni-badge" style={{ background: n.branch_name === "전체" ? "#dcfce7" : "#dbeafe", color: n.branch_name === "전체" ? "#166534" : "#1d4ed8" }}>{n.branch_name}</span>
                    <span>공지</span>
                  </div>
                </div>
              ))}
              {(events || []).slice(0, 3).map((e: any) => {
                const today = new Date().toISOString().slice(0, 10);
                const isRecruitClose = e.recruit_end && e.recruit_end.slice(0, 10) >= today;
                return (
                  <div key={e.event_id} className="dir-ni-row">
                    <div className="dir-ni-title">{e.title}</div>
                    <div className="dir-ni-meta">
                      <span className="dir-ni-badge" style={{ background: "#f3f4f6", color: "#374151" }}>
                        {({"SPORTS_CONTEST": "생활체육 대회", "BELT_TEST": "단증 심사", "HOLIDAY": "휴무", "EVENT": "행사", "ETC": "기타"} as any)[e.event_type] || e.event_type}
                      </span>
                      {e.date_tbd ? <span>날짜 미정</span> : e.event_start ? <span>행사 {String(e.event_start).slice(0, 10)}</span> : null}
                      {isRecruitClose && <span style={{ color: "#dc2626", fontWeight: 700 }}>모집마감 {e.recruit_end.slice(0, 10)}</span>}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>

      {/* ── 최근 입장 회원 (좁음) + 오늘 출석 목록 (넓음) ── */}
      <div className="dir-att-col">
        {/* 최근 입장 회원 */}
        <div className="dir-card" style={{ marginBottom: 0 }}>
          <div className="dir-card-header">
            <div className="dir-dot" style={{ background: "#10b981" }} />
            <span className="dir-card-title">최근 입장</span>
          </div>
          {loading ? (
            <div style={{ padding: "24px 20px", color: "#9ca3af", fontSize: 13 }}>로딩 중...</div>
          ) : attendance.length === 0 ? (
            <div style={{ padding: "24px 20px", color: "#9ca3af", fontSize: 13, textAlign: "center" }}>아직 입장 없음</div>
          ) : (() => {
            const display = pinnedMember || attendance[0];
            const isPinned = !!pinnedMember;
            const time = display.checkin_time
              ? new Date(display.checkin_time).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Seoul" })
              : "";
            const remaining = display.pass_type === "COUNT"
              ? (display.remaining_count != null ? `잔여 ${display.remaining_count}회` : null)
              : display.end_date
                ? `${display.end_date.slice(0, 10)} 까지`
                : null;
            return (
              <div style={{ padding: "20px 20px 22px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div style={{ fontSize: 10, color: isPinned ? "#6366f1" : "#10b981", fontWeight: 700, letterSpacing: ".08em" }}>
                    {isPinned ? "선택한 회원" : "최근 입장"}
                  </div>
                  {isPinned && (
                    <button onClick={() => setPinnedMember(null)} style={{ fontSize: 10, color: "#9ca3af", background: "none", border: "none", cursor: "pointer", padding: "2px 6px" }}>✕ 해제</button>
                  )}
                </div>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 26, fontWeight: 800, color: "#111827", lineHeight: 1.15, marginBottom: 4 }}>{display.name}</div>
                  <div style={{ fontSize: 13, color: "#9ca3af" }}>
                    {time}{isAdminOrOwner(user?.role) && display.branch_name ? ` · ${display.branch_name}` : ""}
                  </div>
                </div>
                <div style={{ background: "#f8fafc", borderRadius: 10, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
                  {display.product_name && (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 11, color: "#9ca3af" }}>이용권</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{display.product_name}</span>
                    </div>
                  )}
                  {remaining && (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 11, color: "#9ca3af" }}>{display.pass_type === "COUNT" ? "잔여" : "만료일"}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: display.pass_type === "COUNT" && (display.remaining_count ?? 0) <= 2 ? "#ef4444" : "#111827" }}>{remaining}</span>
                    </div>
                  )}
                  {display.phone && (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 11, color: "#9ca3af" }}>연락처</span>
                      <span style={{ fontSize: 13, color: "#374151" }}>{display.phone}</span>
                    </div>
                  )}
                </div>
                {display.member_id && (
                  <a href={`/member-detail?member_id=${display.member_id}`}
                    style={{ display: "block", marginTop: 12, padding: "8px 0", textAlign: "center", background: "#f3f4f6", borderRadius: 8, fontSize: 12, color: "#374151", fontWeight: 600, textDecoration: "none" }}>
                    상세보기 →
                  </a>
                )}
              </div>
            );
          })()}
        </div>

        {/* 오늘 출석 전체 목록 */}
        <div className="dir-card" style={{ marginBottom: 0 }}>
          <div className="dir-card-header" style={{ justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div className="dir-dot" style={{ background: "#0f2044" }} />
              <span className="dir-card-title">오늘 출석</span>
              <span className="dir-card-sub">총 {attendance.length}명</span>
            </div>
            <button className="dir-hdr-btn" style={{ border: "1px solid #e2e5eb", background: "#fff", color: "#374151" }}
              onClick={() => loadData(user, selBranch)}>↻ 갱신</button>
          </div>
          {loading ? (
            <div style={{ padding: "14px 20px", color: "#9ca3af", fontSize: 13 }}>로딩 중...</div>
          ) : attendance.length === 0 ? (
            <div style={{ padding: "14px 20px", color: "#9ca3af", fontSize: 13 }}>오늘 출석 없음</div>
          ) : (
            <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
              {attendance.map((a: any, i: number) => {
                const time = a.checkin_time
                  ? new Date(a.checkin_time).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Seoul" })
                  : "";
                const today = new Date().toISOString().slice(0, 10);
                const isExpired = a.end_date && a.end_date.slice(0, 10) < today && a.pass_type === "PERIOD";
                const noCount = a.pass_type === "COUNT" && (a.remaining_count ?? 1) <= 0;
                const isAlert = isExpired || noCount;
                return (
                  <div key={i} className="dir-att-row" style={{ ...(isAlert ? { background: "#fef2f2" } : undefined), cursor: "pointer" }}
                    onClick={() => setPinnedMember(a)}>
                    <span style={{ fontSize: 11, color: isAlert ? "#ef4444" : "#9ca3af", minWidth: 18, textAlign: "right", marginRight: 10 }}>{attendance.length - i}</span>
                    <span style={{ fontWeight: 600, color: isAlert ? "#dc2626" : "#111827", flex: 1, marginRight: 6 }}>{a.name}</span>
                    {isAlert && (
                      <span style={{ fontSize: 10, color: "#ef4444", fontWeight: 700, background: "#fee2e2", padding: "1px 5px", borderRadius: 4, whiteSpace: "nowrap" }}>
                        {isExpired ? "만료" : "잔여없음"}
                      </span>
                    )}
                    {isAdminOrOwner(user?.role) && a.branch_name && <span style={{ fontSize: 11, color: "#9ca3af", marginLeft: 4 }}>{a.branch_name}</span>}
                    <span style={{ color: isAlert ? "#ef4444" : "#6b7280", fontSize: 12, minWidth: 44, textAlign: "right" }}>{time}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── 공지 상세 모달 ── */}
      {noticeDetail && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) setNoticeDetail(null); }}
        >
          <div style={{ background: "#fff", borderRadius: 12, width: "100%", maxWidth: 540, maxHeight: "80vh", overflow: "auto", boxShadow: "0 8px 40px rgba(0,0,0,.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid #e2e5eb" }}>
              <span style={{ fontWeight: 800, fontSize: 15, color: "#111827" }}>
                {noticeDetail.is_important ? <span style={{ color: "#dc2626", marginRight: 4 }}>★</span> : null}
                {noticeDetail.title}
              </span>
              <button onClick={() => setNoticeDetail(null)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9ca3af" }}>×</button>
            </div>
            <div style={{ padding: "16px 20px" }}>
              <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 12 }}>
                대상: {noticeDetail.branch_name} · {String(noticeDetail.created_at || "").slice(0, 10)}
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.7, whiteSpace: "pre-wrap", color: "#374151" }}>{noticeDetail.content || "(내용 없음)"}</div>
            </div>
          </div>
        </div>
      )}

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

      {/* ── 자동문자 발송 현황 (접기/펼치기) ── */}
      {/* ── 자동문자 발송 현황 (접기/펼치기) ── */}
      <div className="dir-card">
        <button
          onClick={() => {
            if (!showSms && smsLogs.length === 0) {
              loadSmsLogs(
                isAdminOrOwner(user?.role)
                  ? (selBranch !== "전체" ? selBranch : undefined)
                  : user?.branch_name
              );
            }
            setShowSms(v => !v);
          }}
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", background: "none", border: "none", cursor: "pointer", padding: "13px 20px", textAlign: "left" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div className="dir-dot" style={{ background: "#0891b2" }} />
            <span style={{ fontWeight: 700, fontSize: 13, color: "#111827" }}>자동문자 발송 현황</span>
            <span style={{ fontSize: 12, color: "#9ca3af" }}>오늘 기준</span>
            {showSms && !smsLoading && smsLogs.length > 0 && (() => {
              const ok  = smsLogs.filter((s: any) => s.send_status === "SUCCESS" || s.send_status === "SENT").length;
              const fail = smsLogs.filter((s: any) => s.send_status === "FAIL" || s.send_status === "FAILED").length;
              return (
                <span style={{ fontSize: 12, color: "#374151" }}>
                  총 {smsLogs.length}건
                  {ok > 0 && <span style={{ color: "#166534", marginLeft: 4 }}>성공 {ok}</span>}
                  {fail > 0 && <span style={{ color: "#dc2626", marginLeft: 4 }}>실패 {fail}</span>}
                </span>
              );
            })()}
          </div>
          <span style={{ color: "#9ca3af", fontSize: 12 }}>{showSms ? "▲" : "▼"}</span>
        </button>
        {showSms && (
          <>
            <div style={{ height: 1, background: "#e2e5eb" }} />
            {smsLoading ? (
              <div style={{ padding: "14px 20px", color: "#9ca3af", fontSize: 13 }}>로딩 중...</div>
            ) : smsLogs.length === 0 ? (
              <div style={{ padding: "14px 20px", color: "#9ca3af", fontSize: 13 }}>오늘 발송된 자동문자 없음</div>
            ) : (
              <>
                {/* 요약 헤더 */}
                {(() => {
                  const ok   = smsLogs.filter((s: any) => s.send_status === "SUCCESS" || s.send_status === "SENT").length;
                  const fail = smsLogs.filter((s: any) => s.send_status === "FAIL" || s.send_status === "FAILED").length;
                  const etc  = smsLogs.length - ok - fail;
                  return (
                    <div style={{ display: "flex", gap: 16, padding: "10px 20px", background: "#f9fafb", borderBottom: "1px solid #f1f3f5" }}>
                      <span style={{ fontSize: 13 }}>총 <strong>{smsLogs.length}</strong>건</span>
                      <span style={{ fontSize: 13, color: "#166534" }}>성공 <strong>{ok}</strong></span>
                      <span style={{ fontSize: 13, color: "#dc2626" }}>실패 <strong>{fail}</strong></span>
                      {etc > 0 && <span style={{ fontSize: 13, color: "#9ca3af" }}>기타 <strong>{etc}</strong></span>}
                    </div>
                  );
                })()}
                {smsLogs.slice(0, 20).map((s: any) => {
                  const isOk = s.send_status === "SUCCESS" || s.send_status === "SENT";
                  const isFail = s.send_status === "FAIL" || s.send_status === "FAILED";
                  const typeLabel: Record<string, string> = {
                    CHECKOUT: "퇴실", ATTENDANCE: "출석", EXPIRING_3DAYS: "만료3일",
                    EXPIRING_2DAYS: "만료2일", EXPIRING_TODAY: "만료당일",
                    LOW_COUNT: "횟수부족", CRM_TODAY: "CRM",
                  };
                  const tLabel = typeLabel[s.target_type] || s.target_type || "";
                  return (
                    <div key={s.sms_id} style={{ display: "flex", alignItems: "center", padding: "9px 20px", borderBottom: "1px solid #f3f4f6", gap: 10 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: isOk ? "#16a34a" : isFail ? "#dc2626" : "#9ca3af", flexShrink: 0, display: "inline-block" }} />
                      <span style={{ fontSize: 11, color: "#fff", background: s.target_type === "CHECKOUT" ? "#0891b2" : "#6b7280", borderRadius: 4, padding: "1px 5px", whiteSpace: "nowrap" }}>{tLabel}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#374151", minWidth: 50 }}>{s.receiver_name || "—"}</span>
                      <span style={{ fontSize: 12, color: "#6b7280", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.message || "—"}</span>
                      <span style={{ fontSize: 11, color: "#9ca3af", whiteSpace: "nowrap" }}>{String(s.created_at || "").slice(11, 16)}</span>
                    </div>
                  );
                })}
                {smsLogs.length > 20 && (
                  <div style={{ padding: "8px 20px", fontSize: 12, color: "#9ca3af", borderTop: "1px solid #f3f4f6" }}>
                    외 {smsLogs.length - 20}건 —{" "}
                    <Link href="/sms" style={{ color: "#1d4ed8", fontWeight: 600 }}>전체 보기</Link>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
