"use client";

import "react-calendar/dist/Calendar.css";

import { useEffect, useState } from "react";
import Calendar from "react-calendar";
import Holidays from "date-holidays";
import { apiFetch } from "@/lib/api";
import AppShell from "@/components/AppShell";

const holidays = new Holidays("KR");

const getStatusColor = (s: string) => {
  if (s === "예약접수") return "#3b82f6";
  if (s === "예약확정") return "#16a34a";
  if (s === "확인완료") return "#7c3aed";
  if (s === "상담완료") return "#d97706";
  if (s === "노쇼") return "#dc2626";
  return "#6b7280";
};

const getSourceLabel = (r: any) => {
  const t = String(r.event_type || r.source_type || "");
  if (t.includes("NAVER")) return "네이버";
  if (t.includes("HOMEPAGE") || t === "홈페이지") return "홈페이지";
  if (t.includes("KAKAO") || t === "카카오톡") return "카카오";
  if (t === "전화문의") return "전화";
  if (t === "인스타그램") return "인스타";
  if (t === "지인소개") return "지인";
  if (t === "방문문의") return "방문";
  return t || "";
};

const getPurpose = (r: any) => {
  const t = String(r.title || "");
  if (!t) return "";
  if (/방문상담|상담예약|체험/.test(t)) return "방문상담";
  if (/일일권|원데이|1day/i.test(t)) return "일일권";
  const m = t.match(/\[([^\]]+)\]/);
  if (m) {
    const inner = m[1].replace(/[가-힣]+점[-·]/, "").trim();
    if (inner && inner.length <= 15) return inner;
  }
  if (/^(네이버예약|홈페이지예약|카카오톡)\s*[-–]/.test(t)) return "";
  return t.length <= 20 ? t : "";
};

const MAIL_SEP = "---MAIL---";
const parseMemo = (raw: string) => {
  const idx = raw.indexOf(MAIL_SEP);
  if (idx < 0) return { opsMemo: raw.trim(), mailPart: "" };
  return {
    opsMemo: raw.slice(0, idx).trim(),
    mailPart: raw.slice(idx + MAIL_SEP.length).trim(),
  };
};

const extractInquiry = (mailPart: string) => {
  if (!mailPart) return "";
  // "요청사항" 또는 "문의사항" — 같은 줄 또는 다음 줄에 내용이 있는 경우 모두 추출
  const patterns = [
    /(?:요청사항|문의사항)\s*[:：]?\s*([^\n]{2,})/,          // 같은 줄
    /(?:요청사항|문의사항)[^\n]*\n+([\s\S]*?)(?:\n{2,}|$)/,  // 다음 줄
  ];
  for (const pattern of patterns) {
    const m = mailPart.match(pattern);
    if (!m) continue;
    const text = m[1].trim();
    if (text.includes("고객센터") || text.includes("Copyright") || text.includes("이용약관")) continue;
    if (text.length < 2 || text === "-") continue;
    return text.slice(0, 300);
  }
  return "";
};

const formatDateHeader = (dateKey: string) => {
  const d = new Date(dateKey + "T00:00:00");
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
};

export default function NaverCalendarPage() {
  const [value, setValue] = useState<any>(new Date());
  const [rows, setRows] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [branch, setBranch] = useState("전체");
  const [user, setUser] = useState<any>(null);
  const [mobile, setMobile] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [smsModal, setSmsModal] = useState<{ msg: string; pendingStatus: string } | null>(null);
  const [editOpsMemo, setEditOpsMemo] = useState("");
  const [mailCollapsed, setMailCollapsed] = useState(true);
  const [notifyModal, setNotifyModal] = useState<{ alertPhone: string; msg: string } | null>(null);
  const [notifyInfo, setNotifyInfo] = useState<{ alertPhone: string | null; lastLog: any } | null>(null);
  const [notifySending, setNotifySending] = useState(false);
  const [dirtyFields, setDirtyFields] = useState(false);

  const toDateKey = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const selectedDate = toDateKey(Array.isArray(value) ? value[0] : value);
  const isHoliday = (date: Date) => !!holidays.isHoliday(date);
  const isCancelled = (r: any) => ["취소", "예약취소"].includes(r.status);
  const isAdminOrOwner = user?.role === "ADMIN" || user?.role === "OWNER";

  useEffect(() => {
    const check = () => setMobile(window.innerWidth < 900);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) setUser(JSON.parse(savedUser));
    apiFetch("/api/settings?option_type=BRANCH").then(r => r.json()).then(d => setBranches(d.rows || []));
  }, []);

  useEffect(() => { if (user) loadReservations(); }, [branch, user]);

  useEffect(() => {
    if (selected) {
      const { opsMemo } = parseMemo(selected.memo || "");
      setEditOpsMemo(opsMemo);
      setMailCollapsed(true);
      setDirtyFields(false);
      setNotifyInfo(null);
      if (isAdminOrOwner) {
        apiFetch(`/api/reservations/notify-director?branch_name=${encodeURIComponent(selected.branch_name)}&event_id=${selected.event_id}`)
          .then(r => r.json())
          .then(d => { if (d.success) setNotifyInfo({ alertPhone: d.alertPhone, lastLog: d.lastLog }); })
          .catch(() => {});
      }
    }
  }, [selected?.event_id]);

  const loadReservations = async () => {
    let url = "/api/calendar-events";
    if (!isAdminOrOwner && user?.branch_name) {
      url += `?branch_name=${encodeURIComponent(user.branch_name)}`;
    } else if (branch !== "전체") {
      url += `?branch_name=${encodeURIComponent(branch)}`;
    }
    const res = await apiFetch(url);
    const data = await res.json();
    setRows(data.rows || []);
  };

  const getDateRows = (date: Date) =>
    rows.filter((r) => r.start_datetime?.slice(0, 10) === toDateKey(date) && !isCancelled(r));

  const selectedRows = rows
    .filter((r) => r.start_datetime?.slice(0, 10) === selectedDate)
    .sort((a, b) => String(a.start_datetime || "").localeCompare(String(b.start_datetime || "")));

  const saveEvent = async (overrides: Record<string, any> = {}) => {
    const { mailPart } = parseMemo(selected.memo || "");
    const newMemo = mailPart
      ? `${editOpsMemo}\n${MAIL_SEP}\n${mailPart}`
      : editOpsMemo;
    const res = await apiFetch("/api/calendar-events/edit", {
      method: "POST",
      body: JSON.stringify({
        event_id: selected.event_id,
        customer_name: selected.customer_name,
        phone: selected.phone,
        start_datetime: selected.start_datetime,
        event_type: selected.event_type,
        title: selected.title,
        status: selected.status,
        memo: newMemo,
        ...overrides,
      }),
    });
    return res.json();
  };

  return (
    <AppShell title="예약 캘린더">
      <style>{`
        /* ── 레이아웃 ── */
        .cal-toolbar { display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-bottom:10px; }
        .cal-outer { background:#fff; border:1px solid #e2e5eb; border-radius:10px; overflow:hidden; box-shadow:0 1px 4px rgba(0,0,0,.06); }
        .cal-layout { display:grid; grid-template-columns:minmax(0,3fr) 2fr; align-items:start; }
        @media(max-width:860px){ .cal-layout { grid-template-columns:1fr; } }

        /* ── 달력 (react-calendar) ── */
        .cal-wrap .react-calendar { width:100%; border:none; background:#fff; font-family:inherit; }
        .cal-wrap .react-calendar__navigation {
          height:52px; margin-bottom:0; border-bottom:1px solid #e2e5eb; background:#fff;
          display:flex; align-items:center; padding:0 16px; gap:4px;
        }
        .cal-wrap .react-calendar__navigation button {
          min-width:36px; height:36px; font-size:14px; font-weight:600; color:#374151;
          background:none; border:1px solid #e2e5eb; border-radius:7px; cursor:pointer;
          display:flex; align-items:center; justify-content:center;
        }
        .cal-wrap .react-calendar__navigation button:hover { background:#f4f5f7; }
        .cal-wrap .react-calendar__navigation button:disabled { opacity:.25; cursor:default; }
        .cal-wrap .react-calendar__navigation__label {
          flex:1 !important; font-size:17px !important; font-weight:800 !important; color:#111827 !important;
          background:none !important; border:none !important; cursor:default !important; pointer-events:none;
          text-align:left !important; padding-left:4px !important;
        }
        .cal-wrap .react-calendar__month-view__weekdays { background:#f8f9fb; border-bottom:1px solid #e2e5eb; }
        .cal-wrap .react-calendar__month-view__weekdays__weekday { padding:8px 0; font-size:11px; font-weight:700; color:#9ca3af; text-align:center; letter-spacing:.04em; }
        .cal-wrap .react-calendar__month-view__weekdays__weekday abbr { text-decoration:none; }
        .cal-wrap .react-calendar__month-view__days__day { padding:0; }
        .cal-wrap .react-calendar__tile {
          height:72px; padding:6px 8px 5px; display:flex; flex-direction:column; align-items:flex-start;
          border:none; background:none;
          border-right:1px solid #e2e5eb; border-bottom:1px solid #e2e5eb;
          cursor:pointer; position:relative; transition:background .1s;
        }
        .cal-wrap .react-calendar__tile:hover { background:#f4f8ff; }
        .cal-wrap .react-calendar__tile abbr { font-size:13px; font-weight:600; color:#374151; line-height:1.3; }
        .cal-wrap .react-calendar__tile--now abbr {
          display:inline-flex; align-items:center; justify-content:center;
          width:24px; height:24px; border-radius:50%;
          border:2px solid #1d4ed8; color:#1d4ed8; font-weight:800;
        }
        .cal-wrap .react-calendar__tile--active { background:#eff6ff !important; }
        .cal-wrap .react-calendar__tile--active abbr { color:#1d4ed8 !important; font-weight:800; }
        .cal-wrap .react-calendar__tile--active.react-calendar__tile--now abbr { border-color:#1d4ed8; }
        .cal-wrap .react-calendar__month-view__days__day--weekend abbr { color:#ef4444; }
        .cal-wrap .react-calendar__tile.holiday abbr { color:#ef4444; }
        .cal-wrap .react-calendar__month-view__days__day--neighboringMonth { opacity:.35; }
        .cal-count-badge {
          margin-top:auto; font-size:11px; font-weight:700; line-height:1;
          background:#0f2044; color:#fff; padding:2px 6px; border-radius:4px;
        }
        .cal-count-badge.high { background:#dc2626; }
        .cal-count-badge.selected { background:#1d4ed8; }

        /* ── 오른쪽 예약 목록 ── */
        .res-panel { border-left:1px solid #e2e5eb; }
        @media(max-width:860px){ .res-panel { border-left:none; border-top:1px solid #e2e5eb; } }
        .res-panel-header { padding:14px 16px 12px; border-bottom:2px solid #0f2044; background:#fff; }
        .res-panel-date { font-size:16px; font-weight:800; color:#111827; }
        .res-panel-count { font-size:12px; color:#6b7280; margin-top:2px; }
        .res-list { display:flex; flex-direction:column; gap:8px; padding:12px; }
        .res-card { background:#fff; border:1px solid #e2e5eb; border-radius:8px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,.06); cursor:pointer; transition:box-shadow .1s; }
        .res-card:hover { box-shadow:0 2px 8px rgba(0,0,0,.1); }
        .res-card-top { display:flex; align-items:center; gap:10px; padding:11px 14px; border-bottom:1px solid #f0f1f3; }
        .res-card-bot { display:flex; align-items:center; gap:8px; padding:8px 14px; }
        .res-time { font-size:16px; font-weight:800; color:#0f2044; min-width:48px; flex-shrink:0; font-variant-numeric:tabular-nums; }
        .res-name { font-size:14px; font-weight:700; color:#111827; flex:1; }
        .res-purpose { display:inline-block; font-size:11px; font-weight:700; color:#1d4ed8; background:#eff6ff; padding:2px 8px; border-radius:999px; flex-shrink:0; }
        .res-meta { font-size:12px; color:#6b7280; }
        .res-status { flex-shrink:0; font-size:12px; font-weight:700; padding:2px 8px; border-radius:999px; }

        /* ── 모달 ── */
        .modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.45); display:flex; align-items:center; justify-content:center; z-index:9999; padding:16px; }
        .modal-box { width:100%; max-width:540px; max-height:92vh; background:#fff; border-radius:10px; display:flex; flex-direction:column; box-shadow:0 8px 40px rgba(0,0,0,.18); overflow:hidden; }
        .modal-header { padding:16px 18px 12px; border-bottom:1px solid #e5e7eb; flex-shrink:0; }
        .modal-body { flex:1; overflow-y:auto; padding:14px 18px; }
        .modal-footer { padding:11px 18px; border-top:1px solid #e5e7eb; flex-shrink:0; display:flex; gap:8px; justify-content:flex-end; }
        .field-row { margin-bottom:10px; }
        .field-label { font-size:11px; font-weight:600; color:#6b7280; margin-bottom:3px; }
        .field-val { font-size:14px; color:#111827; }
        .status-btn { height:32px; padding:0 12px; border-radius:5px; font-size:12px; font-weight:600; cursor:pointer; border:1px solid #e5e7eb; background:#f9fafb; color:#374151; }
        .status-btn.active { border-color:transparent; color:#fff; }
        .mail-toggle { background:none; border:none; font-size:12px; color:#6b7280; cursor:pointer; padding:4px 0; text-decoration:underline; }
      `}</style>

      {/* 도구 줄 */}
      <div className="cal-toolbar">
        {isAdminOrOwner ? (
          <select className="input" style={{ height: 36, fontSize: 13, width: 130 }} value={branch} onChange={(e) => setBranch(e.target.value)}>
            <option>전체</option>
            {branches.map((b) => <option key={b.option_id}>{b.option_name}</option>)}
          </select>
        ) : (
          <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>{user?.branch_name}</span>
        )}
        <button className="btn secondary" style={{ height: 36, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setValue(new Date())}>오늘</button>
        <button className="btn secondary" style={{ height: 36, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", marginLeft: "auto" }} onClick={loadReservations}>새로고침</button>
      </div>

      {/* 메인 레이아웃 */}
      <div className="cal-outer">
        <div className="cal-layout">
          {/* 달력 */}
          <div className="cal-wrap">
            <Calendar
              onChange={(v) => setValue(v)}
              value={value}
              locale="ko-KR"
              calendarType="gregory"
              formatDay={(_, date) => `${date.getDate()}`}
              formatMonthYear={(_, date) => `${date.getFullYear()}년 ${date.getMonth() + 1}월`}
              tileClassName={({ date, view }) => {
                if (view !== "month") return "";
                return isHoliday(date) ? "holiday" : "";
              }}
              tileContent={({ date, view }) => {
                if (view !== "month") return null;
                const count = getDateRows(date).length;
                if (count === 0) return null;
                const isSelected = toDateKey(date) === selectedDate;
                const cls = isSelected ? "cal-count-badge selected" : count >= 5 ? "cal-count-badge high" : "cal-count-badge";
                return <span className={cls}>{count}건</span>;
              }}
            />
          </div>

          {/* 오른쪽 예약 목록 */}
          <div className="res-panel">
            <div className="res-panel-header">
              <div className="res-panel-date">{formatDateHeader(selectedDate)}</div>
              <div className="res-panel-count">
                {selectedRows.length === 0 ? "예약 없음" : `예약 ${selectedRows.length}건`}
              </div>
            </div>

            {selectedRows.length === 0 ? (
              <div style={{ padding: "32px 16px", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
                이 날짜에 예약이 없습니다.
              </div>
            ) : (
              <div className="res-list">
                {selectedRows.map((r) => {
                  const cancelled = isCancelled(r);
                  const purpose = getPurpose(r);
                  const source = getSourceLabel(r);
                  const statusColor = getStatusColor(r.status);
                  const statusBg: Record<string, string> = {
                    "예약접수": "#eff6ff", "예약확정": "#dcfce7", "확인완료": "#f3e8ff",
                    "상담완료": "#fef3c7", "노쇼": "#fee2e2", "취소": "#f3f4f6",
                  };
                  return (
                    <div key={r.event_id} className="res-card" onClick={() => setSelected(r)}
                      style={{ opacity: cancelled ? 0.55 : 1 }}>
                      <div className="res-card-top">
                        <div className="res-time">{r.start_datetime?.slice(11, 16) || "-"}</div>
                        <div className="res-name" style={{ textDecoration: cancelled ? "line-through" : "none", color: cancelled ? "#9ca3af" : "#111827" }}>
                          {r.customer_name || "-"}
                        </div>
                        <div className="res-status" style={{ color: statusColor, background: statusBg[r.status] || "#f3f4f6" }}>
                          {r.status === "취소" ? "예약취소" : r.status}
                        </div>
                      </div>
                      <div className="res-card-bot">
                        {purpose && <span className="res-purpose">{purpose}</span>}
                        <span className="res-meta">
                          {r.branch_name}{source ? ` · ${source}` : ""}
                          {r.phone ? ` · ${r.phone}` : <span style={{ color: "#dc2626" }}> · 연락처 미입력</span>}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 상세 모달 */}
      {selected && (() => {
        const { mailPart } = parseMemo(selected.memo || "");
        const inquiry = extractInquiry(mailPart);
        const purpose = getPurpose(selected);
        const source = getSourceLabel(selected);

        return (
          <div className="modal-overlay" onClick={() => setSelected(null)}>
            <div className="modal-box" onClick={(e) => e.stopPropagation()}>

              {/* 헤더 */}
              <div className="modal-header">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>
                      {selected.customer_name || "-"}
                    </div>
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 3 }}>
                      {selected.branch_name}
                      {source ? ` · ${source}` : ""}
                    </div>
                  </div>
                  <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", fontSize: 18, color: "#9ca3af", cursor: "pointer", padding: "0 4px" }}>✕</button>
                </div>
              </div>

              {/* 본문 */}
              <div className="modal-body">

                {/* 고객 요청사항 - 추출 가능한 경우만 */}
                {inquiry && (
                  <div style={{ background: "#fefce8", border: "1px solid #fde68a", borderRadius: 6, padding: "9px 12px", marginBottom: 12, fontSize: 13, color: "#92400e" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#b45309", marginBottom: 4 }}>고객 요청사항</div>
                    {inquiry}
                  </div>
                )}

                {/* 기본 정보 */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
                  <div className="field-row">
                    <div className="field-label">이름</div>
                    <input className="input" style={{ height: 36, fontSize: 14 }}
                      value={selected.customer_name || ""}
                      onChange={(e) => { setSelected({ ...selected, customer_name: e.target.value }); setDirtyFields(true); }}
                    />
                  </div>
                  <div className="field-row">
                    <div className="field-label">방문일시</div>
                    <input className="input" type="datetime-local" style={{ height: 36, fontSize: 13 }}
                      value={selected.start_datetime?.slice(0, 16) || ""}
                      onChange={(e) => { setSelected({ ...selected, start_datetime: e.target.value }); setDirtyFields(true); }}
                    />
                  </div>
                </div>

                <div className="field-row">
                  <div className="field-label">전화번호</div>
                  <input className="input" style={{ height: 36, fontSize: 14 }}
                    value={selected.phone || ""}
                    placeholder="전화번호 미입력"
                    onChange={(e) => { setSelected({ ...selected, phone: e.target.value }); setDirtyFields(true); }}
                  />
                  {!selected.phone && (
                    <div style={{ fontSize: 11, color: "#dc2626", marginTop: 3 }}>연락처를 입력하고 저장하면 보완됩니다.</div>
                  )}
                </div>

                {purpose && (
                  <div className="field-row">
                    <div className="field-label">예약 목적</div>
                    <div className="field-val">{purpose}</div>
                  </div>
                )}

                {/* 운영 메모 */}
                <div className="field-row">
                  <div className="field-label">운영 메모</div>
                  <textarea className="input"
                    value={editOpsMemo}
                    onChange={(e) => { setEditOpsMemo(e.target.value); setDirtyFields(true); }}
                    placeholder="운영 메모 (선택)"
                    style={{ width: "100%", minHeight: 120, resize: "vertical", fontSize: 13 }}
                  />
                </div>

                {/* 원본 메일 접기 */}
                {mailPart && (
                  <div style={{ marginBottom: 12 }}>
                    <button className="mail-toggle" onClick={() => setMailCollapsed(!mailCollapsed)}>
                      {mailCollapsed ? "▶ 원본 메일 보기" : "▲ 원본 메일 접기"}
                    </button>
                    {!mailCollapsed && (
                      <pre style={{ marginTop: 6, padding: "10px 12px", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 6, fontSize: 12, color: "#374151", whiteSpace: "pre-wrap", maxHeight: 200, overflowY: "auto" }}>
                        {mailPart}
                      </pre>
                    )}
                  </div>
                )}

                {/* 상태 버튼 */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 6 }}>상태</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {(["예약접수", "예약확정", "상담완료", "노쇼", "취소"] as const).map((s) => {
                      const label = s === "취소" ? "예약 취소" : s;
                      const active = selected.status === s;
                      return (
                        <button key={s}
                          className={`status-btn${active ? " active" : ""}`}
                          style={active ? { background: getStatusColor(s) } : {}}
                          onClick={async () => {
                            if (s === "예약확정") {
                              const dt = selected.start_datetime || "";
                              setSmsModal({
                                pendingStatus: s,
                                msg: `[스트롱복싱 ${selected.branch_name}]\n\n${selected.customer_name}님 예약이 확정되었습니다.\n\n방문일시 : ${dt.slice(0, 10)} ${dt.slice(11, 16)}\n예약내용 : ${purpose || "방문 상담"}\n\n예약하신 시간에 뵙겠습니다.\n\n감사합니다 🥊`,
                              });
                              return;
                            }
                            const json = await saveEvent({ status: s });
                            if (json.success) { setSelected(null); loadReservations(); }
                            else alert(json.message || "처리 실패");
                          }}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {/* 관장에게 예약 알림 — ADMIN/OWNER만 표시 */}
                {isAdminOrOwner && (
                  <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #f0f1f3" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", marginBottom: 8 }}>관장 알림</div>

                    {/* 마지막 발송 로그 */}
                    {notifyInfo?.lastLog && (() => {
                      const log = notifyInfo.lastLog;
                      const isOk = log.send_status === "SENT" || log.send_status === "SUCCESS";
                      const sentAt = String(log.created_at || "").slice(0, 16).replace("T", " ");
                      return (
                        <div style={{ fontSize: 12, color: isOk ? "#166534" : "#dc2626", background: isOk ? "#f0fdf4" : "#fef2f2", border: `1px solid ${isOk ? "#bbf7d0" : "#fecaca"}`, borderRadius: 6, padding: "6px 10px", marginBottom: 8, display: "flex", gap: 8, alignItems: "center" }}>
                          <span>{isOk ? "✓" : "✗"}</span>
                          <span>{isOk ? "발송 완료" : "발송 실패"} · {sentAt} · {log.receiver_phone}</span>
                        </div>
                      );
                    })()}

                    {/* 발송 버튼 */}
                    <button
                      style={{ height: 34, padding: "0 14px", fontSize: 13, fontWeight: 700, border: "1px solid #0891b2", borderRadius: 6, background: "#ecfeff", color: "#0e7490", cursor: "pointer", width: "100%" }}
                      onClick={async () => {
                        if (dirtyFields) {
                          alert("저장되지 않은 수정 사항이 있습니다. 먼저 저장해주세요.");
                          return;
                        }
                        if (!selected.phone) {
                          alert("고객 연락처가 없습니다. 전화번호를 입력하고 저장한 뒤 발송하세요.");
                          return;
                        }
                        if (!notifyInfo?.alertPhone) {
                          alert("이 지점의 예약 알림 수신 번호가 설정되지 않았습니다.\n설정관리 → 예약 알림 수신 번호에서 추가하세요.");
                          return;
                        }
                        const dt = selected.start_datetime || "";
                        const statusLabel = selected.status === "예약접수" ? "예약접수 — 확정 필요" : selected.status || "";
                        const msg = `[스트롱복싱 ${selected.branch_name} 예약 알림]\n상태: ${statusLabel}\n방문일시: ${dt.slice(0, 10)} ${dt.slice(11, 16)}\n예약자: ${selected.customer_name || "-"}\n연락처: ${selected.phone || "-"}\n예약 목적: ${purpose || "-"}\n유입경로: ${source || "-"}`;
                        setNotifyModal({ alertPhone: notifyInfo.alertPhone, msg });
                      }}
                    >
                      📢 관장에게 예약 알림 {notifyInfo?.lastLog ? "(재발송)" : ""}
                    </button>
                  </div>
                )}
              </div>

              {/* 푸터 */}
              <div className="modal-footer">
                <button className="btn secondary" style={{ height: 36, fontSize: 13 }} onClick={() => location.href = "/crm"}>CRM 보기</button>
                <button className="btn secondary" style={{ height: 36, fontSize: 13 }} onClick={() => setSelected(null)}>닫기</button>
                <button className="btn" style={{ height: 36, fontSize: 13 }} onClick={async () => {
                  const json = await saveEvent();
                  if (json.success) { setDirtyFields(false); setSelected(null); loadReservations(); }
                  else alert(json.message || "저장 실패");
                }}>저장</button>
              </div>

            </div>
          </div>
        );
      })()}

      {/* 관장 알림 미리보기 모달 */}
      {notifyModal && selected && (
        <div className="modal-overlay" onClick={() => { if (!notifySending) setNotifyModal(null); }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, background: "#fff", borderRadius: 10, overflow: "hidden", boxShadow: "0 8px 40px rgba(0,0,0,.18)" }}>
            <div style={{ padding: "14px 18px 12px", borderBottom: "1px solid #e5e7eb" }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>관장에게 예약 알림 미리보기</div>
              {notifyInfo?.lastLog && (
                <div style={{ fontSize: 12, color: "#b45309", marginTop: 3 }}>⚠ 이미 발송된 알림입니다. 재발송 시 확인 후 발송하세요.</div>
              )}
            </div>
            <div style={{ padding: "14px 18px" }}>
              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>
                <strong>수신 지점:</strong> {selected.branch_name} &nbsp;|&nbsp;
                <strong>수신 번호:</strong> {notifyModal.alertPhone}
              </div>
              <textarea className="input" value={notifyModal.msg}
                onChange={(e) => setNotifyModal({ ...notifyModal, msg: e.target.value })}
                rows={10} style={{ fontSize: 13, resize: "vertical" }} />
            </div>
            <div style={{ padding: "10px 18px 14px", display: "flex", gap: 8, justifyContent: "flex-end", borderTop: "1px solid #e5e7eb" }}>
              <button className="btn secondary" style={{ height: 36, fontSize: 13 }} disabled={notifySending} onClick={() => setNotifyModal(null)}>닫기</button>
              <button className="btn" style={{ height: 36, fontSize: 13, background: "#0891b2", borderColor: "#0891b2" }} disabled={notifySending}
                onClick={async () => {
                  setNotifySending(true);
                  const isResend = !!notifyInfo?.lastLog;
                  const res = await apiFetch("/api/reservations/notify-director", {
                    method: "POST",
                    body: JSON.stringify({
                      event_id: selected.event_id,
                      branch_name: selected.branch_name,
                      customer_name: selected.customer_name,
                      phone: selected.phone,
                      start_datetime: selected.start_datetime,
                      message: notifyModal.msg,
                      is_resend: isResend,
                    }),
                  });
                  const json = await res.json();
                  setNotifySending(false);
                  if (json.success) {
                    setNotifyModal(null);
                    // 로그 갱신
                    apiFetch(`/api/reservations/notify-director?branch_name=${encodeURIComponent(selected.branch_name)}&event_id=${selected.event_id}`)
                      .then(r => r.json()).then(d => { if (d.success) setNotifyInfo({ alertPhone: d.alertPhone, lastLog: d.lastLog }); });
                    alert(json.message || "발송 완료");
                  } else {
                    alert(json.message || "발송 실패");
                  }
                }}
              >{notifySending ? "발송 중..." : "발송"}</button>
            </div>
          </div>
        </div>
      )}

      {/* 문자 모달 */}
      {smsModal && selected && (
        <div className="modal-overlay" onClick={() => setSmsModal(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, background: "#fff", borderRadius: 10, overflow: "hidden", boxShadow: "0 8px 40px rgba(0,0,0,.18)" }}>
            <div style={{ padding: "14px 18px 12px", borderBottom: "1px solid #e5e7eb" }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>예약확정 안내문자</div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{selected.customer_name} · {selected.phone || "연락처 없음"}</div>
            </div>
            <div style={{ padding: "14px 18px" }}>
              <textarea className="input" value={smsModal.msg}
                onChange={(e) => setSmsModal({ ...smsModal, msg: e.target.value })}
                rows={10} style={{ fontSize: 13, resize: "vertical" }} />
            </div>
            <div style={{ padding: "10px 18px 14px", display: "flex", gap: 8, justifyContent: "flex-end", borderTop: "1px solid #e5e7eb" }}>
              <button className="btn secondary" style={{ height: 36, fontSize: 13 }} onClick={() => setSmsModal(null)}>닫기 (변경 없음)</button>
              <button className="btn secondary" style={{ height: 36, fontSize: 13 }} onClick={async () => {
                const json = await saveEvent({ status: smsModal.pendingStatus });
                setSmsModal(null);
                setSelected(null);
                loadReservations();
                alert(json.success ? "예약확정 완료 (문자 미발송)" : json.message || "처리 실패");
              }}>문자 없이 확정</button>
              <button className="btn" style={{ height: 36, fontSize: 13 }} disabled={!selected.phone}
                onClick={async () => {
                  const json = await saveEvent({ status: smsModal.pendingStatus });
                  if (!json.success) { alert(json.message || "처리 실패"); return; }
                  const smsRes = await apiFetch("/api/sms/send-reservation", {
                    method: "POST",
                    body: JSON.stringify({ phone: selected.phone, branch_name: selected.branch_name, message: smsModal.msg, receiver_name: selected.customer_name }),
                  });
                  const smsJson = await smsRes.json();
                  setSmsModal(null);
                  setSelected(null);
                  loadReservations();
                  alert(smsJson.skipped ? "예약확정 완료 (5분 이내 중복 방지)" : "예약확정 및 안내문자 발송 완료");
                }}>발송 후 확정</button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
