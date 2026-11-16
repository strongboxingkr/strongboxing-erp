"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { apiFetch } from "@/lib/api";

const EVENT_TYPE_LABELS: Record<string, string> = {
  SPORTS_CONTEST: "생활체육 대회",
  BELT_TEST: "단증 심사",
  HOLIDAY: "휴무",
  EVENT: "행사",
  ETC: "기타",
};

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  DRAFT:     { label: "초안",     color: "#92400e", bg: "#fef3c7" },
  PUBLISHED: { label: "게시중",   color: "#166534", bg: "#dcfce7" },
  ENDED:     { label: "게시종료", color: "#6b7280", bg: "#f3f4f6" },
};

const fmtDate = (v?: string | null) => (!v ? "-" : String(v).slice(0, 10));
const fmtDT   = (v?: string | null) => (!v ? "-" : String(v).slice(0, 16).replace("T", " "));

function eventStatus(e: any): { label: string; color: string; bg: string } {
  const today = new Date().toISOString().slice(0, 10);
  if (e.status === "DRAFT") return STATUS_LABEL.DRAFT;
  if (e.status === "ENDED") return STATUS_LABEL.ENDED;
  if (e.date_tbd) return { label: "날짜 미정", color: "#1d4ed8", bg: "#dbeafe" };
  const rs = e.recruit_start?.slice(0, 10);
  const re = e.recruit_end?.slice(0, 10);
  const es = e.event_start?.slice(0, 10);
  const ee = e.event_end?.slice(0, 10);
  if (rs && re && rs <= today && re >= today) return { label: "모집중",   color: "#166534", bg: "#dcfce7" };
  if (re && re < today && (!es || es > today))  return { label: "접수마감", color: "#92400e", bg: "#fef3c7" };
  if (ee && ee < today)                          return { label: "행사종료", color: "#6b7280", bg: "#f3f4f6" };
  if (es && es > today)                          return { label: "예정",    color: "#1d4ed8", bg: "#dbeafe" };
  return { label: "진행중", color: "#0f2044", bg: "#e0e7ff" };
}

const EMPTY_NOTICE = { branch_name: "전체", title: "", content: "", status: "PUBLISHED", start_date: "", end_date: "", is_important: false };
const EMPTY_EVENT  = { branch_name: "전체", title: "", content: "", location: "", event_type: "ETC", event_start: "", event_end: "", recruit_start: "", recruit_end: "", date_tbd: false, status: "DRAFT" };

export default function NoticeManagementPage() {
  const [tab, setTab]           = useState<"notice" | "event">("notice");
  const [user, setUser]         = useState<any>(null);
  const [branches, setBranches] = useState<any[]>([]);

  const [notices, setNotices]       = useState<any[]>([]);
  const [nFilter, setNFilter]       = useState({ status: "", branch: "", q: "" });
  const [noticeModal, setNoticeModal] = useState<any>(null);
  const [nForm, setNForm]           = useState<any>({ ...EMPTY_NOTICE });
  const [nSaving, setNSaving]       = useState(false);
  const [nErr, setNErr]             = useState("");

  const [events, setEvents]         = useState<any[]>([]);
  const [evFilter, setEvFilter]     = useState({ status: "", branch: "", type: "" });
  const [eventModal, setEventModal] = useState<any>(null);
  const [eForm, setEForm]           = useState<any>({ ...EMPTY_EVENT });
  const [eSaving, setESaving]       = useState(false);
  const [eErr, setEErr]             = useState("");
  const [evDbErr, setEvDbErr]       = useState(false);

  const canEdit = (role?: string) => role === "ADMIN" || role === "OWNER";

  useEffect(() => {
    const saved = localStorage.getItem("user");
    if (saved) setUser(JSON.parse(saved));
    apiFetch("/api/settings?option_type=BRANCH").then(r => r.json()).then(d => setBranches(d.rows || []));
    loadNotices();
    loadEvents();
  }, []);

  const loadNotices = async () => {
    const res = await apiFetch("/api/notices");
    const data = await res.json();
    setNotices(data.rows || []);
  };

  const loadEvents = async () => {
    setEvDbErr(false);
    const res = await apiFetch("/api/events");
    const data = await res.json();
    if (!data.success) { setEvDbErr(true); return; }
    setEvents(data.rows || []);
  };

  const saveNotice = async () => {
    if (!nForm.title.trim()) { setNErr("제목을 입력하세요."); return; }
    setNSaving(true); setNErr("");
    try {
      const isEdit = noticeModal !== "new";
      const url    = isEdit ? "/api/notices/update" : "/api/notices/add";
      const method = isEdit ? "PATCH" : "POST";
      const body   = isEdit ? { ...nForm, notice_id: noticeModal.notice_id } : nForm;
      const res    = await apiFetch(url, { method, body: JSON.stringify(body) });
      const data   = await res.json();
      if (data.success) { setNoticeModal(null); loadNotices(); }
      else setNErr(data.error || data.message || "저장 실패");
    } finally { setNSaving(false); }
  };

  const deleteNotice = async (notice_id: number) => {
    if (!confirm("공지를 삭제할까요?")) return;
    const res = await apiFetch("/api/notices/delete", { method: "POST", body: JSON.stringify({ notice_id }) });
    const data = await res.json();
    if (data.success) loadNotices(); else alert(data.message || "삭제 실패");
  };

  const saveEvent = async () => {
    if (!eForm.title.trim()) { setEErr("제목을 입력하세요."); return; }
    if (!eForm.date_tbd && !eForm.event_start) { setEErr("행사 시작일을 입력하거나 날짜 미정을 체크하세요."); return; }
    setESaving(true); setEErr("");
    try {
      const isEdit = eventModal !== "new";
      const url    = isEdit ? "/api/events/update" : "/api/events/add";
      const method = isEdit ? "PATCH" : "POST";
      const body   = isEdit ? { ...eForm, event_id: eventModal.event_id } : eForm;
      const res    = await apiFetch(url, { method, body: JSON.stringify(body) });
      const data   = await res.json();
      if (data.success) { setEventModal(null); loadEvents(); }
      else setEErr(data.error || data.message || "저장 실패");
    } finally { setESaving(false); }
  };

  const deleteEvent = async (event_id: number) => {
    if (!confirm("일정을 삭제할까요?")) return;
    const res = await apiFetch("/api/events/delete", { method: "POST", body: JSON.stringify({ event_id }) });
    const data = await res.json();
    if (data.success) loadEvents(); else alert(data.message || "삭제 실패");
  };

  const filteredNotices = notices.filter(n => {
    if (nFilter.status && (n.status || "PUBLISHED") !== nFilter.status) return false;
    if (nFilter.branch && n.branch_name !== nFilter.branch) return false;
    if (nFilter.q && !n.title.includes(nFilter.q) && !(n.content || "").includes(nFilter.q)) return false;
    return true;
  });

  const filteredEvents = events.filter(e => {
    if (evFilter.status && e.status !== evFilter.status) return false;
    if (evFilter.branch && e.branch_name !== evFilter.branch) return false;
    if (evFilter.type && e.event_type !== evFilter.type) return false;
    return true;
  });

  const edit = canEdit(user?.role);

  return (
    <AppShell title="공지·일정 관리">
      <style>{`
        .nm-tabs{display:flex;border-bottom:2px solid #e2e5eb;margin-bottom:20px}
        .nm-tab{padding:10px 22px;font-size:14px;font-weight:700;border:none;background:none;cursor:pointer;color:#9ca3af;border-bottom:2px solid transparent;margin-bottom:-2px}
        .nm-tab.active{color:#0f2044;border-bottom-color:#0f2044}
        .nm-toolbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:14px}
        .nm-sel{box-sizing:border-box;height:34px;padding:0 10px;font-size:13px;border:1px solid #e2e5eb;border-radius:7px;background:#fff;appearance:auto;-webkit-appearance:auto;cursor:pointer}
        .nm-sinput{box-sizing:border-box;height:34px;padding:0 10px;font-size:13px;border:1px solid #e2e5eb;border-radius:7px;background:#fff;width:160px}
        .nm-btn{height:34px;padding:0 14px;font-size:13px;font-weight:700;border-radius:7px;cursor:pointer;border:none;white-space:nowrap}
        .nm-btn-p{background:#0f2044;color:#fff}.nm-btn-p:hover{background:#1a3060}.nm-btn-p:disabled{opacity:.5;cursor:not-allowed}
        .nm-btn-s{background:#fff;color:#374151;border:1px solid #e2e5eb}.nm-btn-s:hover{background:#f4f5f7}
        .nm-btn-d{background:#fff;color:#dc2626;border:1px solid #fecaca;height:28px;padding:0 8px;font-size:12px}
        .nm-btn-d:hover{background:#fef2f2}
        .nm-tbl{width:100%;border-collapse:collapse;font-size:13px}
        .nm-tbl th{padding:9px 12px;text-align:left;font-weight:700;color:#6b7280;border-bottom:2px solid #e2e5eb;white-space:nowrap;background:#fafafa}
        .nm-tbl td{padding:9px 12px;border-bottom:1px solid #f1f3f5;vertical-align:middle}
        .nm-tbl tr:hover td{background:#f8faff}
        .nm-badge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;white-space:nowrap}
        .nm-title-btn{background:none;border:none;cursor:pointer;font-size:13px;font-weight:700;color:#0f2044;text-align:left;padding:0}
        .nm-title-btn:hover{text-decoration:underline}
        .nm-modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px}
        .nm-modal{background:#fff;border-radius:12px;width:100%;max-width:640px;max-height:90vh;overflow-y:auto;box-shadow:0 8px 40px rgba(0,0,0,.2)}
        .nm-modal-hdr{display:flex;justify-content:space-between;align-items:center;padding:18px 24px;border-bottom:1px solid #e2e5eb}
        .nm-modal-title{font-size:16px;font-weight:800;color:#111827}
        .nm-modal-close{background:none;border:none;font-size:20px;cursor:pointer;color:#9ca3af;padding:0}
        .nm-modal-body{padding:20px 24px;display:flex;flex-direction:column;gap:14px}
        .nm-field{display:flex;flex-direction:column;gap:5px}
        .nm-label{font-size:12px;font-weight:700;color:#374151}
        .nm-input{box-sizing:border-box;width:100%;padding:8px 12px;font-size:13px;border:1px solid #e2e5eb;border-radius:7px}
        .nm-input:focus{outline:none;border-color:#0f2044}
        .nm-textarea{box-sizing:border-box;width:100%;padding:8px 12px;font-size:13px;border:1px solid #e2e5eb;border-radius:7px;min-height:100px;resize:vertical}
        .nm-row{display:flex;gap:10px;flex-wrap:wrap}
        .nm-row .nm-field{flex:1;min-width:120px}
        .nm-modal-foot{display:flex;justify-content:flex-end;gap:8px;padding:14px 24px;border-top:1px solid #e2e5eb}
        .nm-err{color:#dc2626;font-size:12px;margin:0}
        .nm-warn{background:#fff3cd;border:1px solid #ffc107;border-radius:8px;padding:12px 16px;font-size:13px;color:#856404;margin-bottom:14px}
        @media(max-width:640px){.nm-tbl{display:block;overflow-x:auto}}
      `}</style>

      <div className="nm-tabs">
        <button className={`nm-tab${tab === "notice" ? " active" : ""}`} onClick={() => setTab("notice")}>공지사항</button>
        <button className={`nm-tab${tab === "event" ? " active" : ""}`} onClick={() => setTab("event")}>일정</button>
      </div>

      {/* ── 공지사항 탭 ── */}
      {tab === "notice" && (
        <>
          <div className="nm-toolbar">
            <select className="nm-sel" value={nFilter.status} onChange={e => setNFilter(f => ({ ...f, status: e.target.value }))}>
              <option value="">전체 상태</option>
              <option value="DRAFT">초안</option>
              <option value="PUBLISHED">게시중</option>
              <option value="ENDED">게시종료</option>
            </select>
            <select className="nm-sel" value={nFilter.branch} onChange={e => setNFilter(f => ({ ...f, branch: e.target.value }))}>
              <option value="">전체 지점</option>
              <option value="전체">공통</option>
              {branches.map(b => <option key={b.option_id}>{b.option_name}</option>)}
            </select>
            <input className="nm-sinput" placeholder="제목 검색..." value={nFilter.q} onChange={e => setNFilter(f => ({ ...f, q: e.target.value }))} />
            <div style={{ marginLeft: "auto" }}>
              {edit && <button className="nm-btn nm-btn-p" onClick={() => { setNForm({ ...EMPTY_NOTICE }); setNErr(""); setNoticeModal("new"); }}>+ 공지 등록</button>}
            </div>
          </div>
          <div style={{ background: "#fff", border: "1px solid #e2e5eb", borderRadius: 10, overflow: "hidden" }}>
            <table className="nm-tbl">
              <thead>
                <tr>
                  <th style={{ width: 28 }}>중요</th>
                  <th>제목</th>
                  <th>대상</th>
                  <th>상태</th>
                  <th>게시 시작</th>
                  <th>게시 종료</th>
                  <th>등록일</th>
                  {edit && <th style={{ width: 60 }}>관리</th>}
                </tr>
              </thead>
              <tbody>
                {filteredNotices.length === 0 ? (
                  <tr><td colSpan={edit ? 8 : 7} style={{ color: "#9ca3af", textAlign: "center", padding: "24px 0" }}>공지사항이 없습니다.</td></tr>
                ) : filteredNotices.map(n => {
                  const st = STATUS_LABEL[n.status || "PUBLISHED"] || STATUS_LABEL.PUBLISHED;
                  return (
                    <tr key={n.notice_id}>
                      <td style={{ textAlign: "center" }}>{n.is_important ? <span style={{ color: "#dc2626", fontWeight: 900 }}>★</span> : ""}</td>
                      <td>
                        <button className="nm-title-btn" onClick={() => { setNForm({ ...EMPTY_NOTICE, ...n, is_important: !!n.is_important, start_date: n.start_date?.slice(0, 10) || "", end_date: n.end_date?.slice(0, 10) || "" }); setNErr(""); setNoticeModal(n); }}>
                          {n.title}
                        </button>
                      </td>
                      <td><span className="nm-badge" style={{ background: n.branch_name === "전체" ? "#dcfce7" : "#dbeafe", color: n.branch_name === "전체" ? "#166534" : "#1d4ed8" }}>{n.branch_name}</span></td>
                      <td><span className="nm-badge" style={{ background: st.bg, color: st.color }}>{st.label}</span></td>
                      <td style={{ color: "#6b7280", fontSize: 12 }}>{fmtDate(n.start_date)}</td>
                      <td style={{ color: "#6b7280", fontSize: 12 }}>{fmtDate(n.end_date)}</td>
                      <td style={{ color: "#9ca3af", fontSize: 12 }}>{String(n.created_at || "").slice(0, 10)}</td>
                      {edit && <td><button className="nm-btn nm-btn-d" onClick={() => deleteNotice(n.notice_id)}>삭제</button></td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── 일정 탭 ── */}
      {tab === "event" && (
        <>
          {evDbErr && (
            <div className="nm-warn">
              ⚠️ <strong>events 테이블이 없습니다.</strong> DB 마이그레이션 후 사용 가능합니다.
              <button className="nm-btn nm-btn-s" style={{ marginLeft: 10, height: 28, padding: "0 10px", fontSize: 12 }} onClick={loadEvents}>재시도</button>
            </div>
          )}
          <div className="nm-toolbar">
            <select className="nm-sel" value={evFilter.status} onChange={e => setEvFilter(f => ({ ...f, status: e.target.value }))}>
              <option value="">전체 상태</option>
              <option value="DRAFT">초안</option>
              <option value="PUBLISHED">게시중</option>
              <option value="ENDED">게시종료</option>
            </select>
            <select className="nm-sel" value={evFilter.type} onChange={e => setEvFilter(f => ({ ...f, type: e.target.value }))}>
              <option value="">전체 종류</option>
              {Object.entries(EVENT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select className="nm-sel" value={evFilter.branch} onChange={e => setEvFilter(f => ({ ...f, branch: e.target.value }))}>
              <option value="">전체 지점</option>
              <option value="전체">공통</option>
              {branches.map(b => <option key={b.option_id}>{b.option_name}</option>)}
            </select>
            <div style={{ marginLeft: "auto" }}>
              {edit && <button className="nm-btn nm-btn-p" disabled={evDbErr} onClick={() => { setEForm({ ...EMPTY_EVENT }); setEErr(""); setEventModal("new"); }}>+ 일정 등록</button>}
            </div>
          </div>
          <div style={{ background: "#fff", border: "1px solid #e2e5eb", borderRadius: 10, overflow: "hidden" }}>
            <table className="nm-tbl">
              <thead>
                <tr>
                  <th>제목</th>
                  <th>종류</th>
                  <th>대상</th>
                  <th>행사 시작</th>
                  <th>모집 마감</th>
                  <th>상태</th>
                  {edit && <th style={{ width: 60 }}>관리</th>}
                </tr>
              </thead>
              <tbody>
                {filteredEvents.length === 0 ? (
                  <tr><td colSpan={edit ? 7 : 6} style={{ color: "#9ca3af", textAlign: "center", padding: "24px 0" }}>{evDbErr ? "DB 마이그레이션 후 사용 가능합니다." : "등록된 일정이 없습니다."}</td></tr>
                ) : filteredEvents.map(e => {
                  const st = eventStatus(e);
                  return (
                    <tr key={e.event_id}>
                      <td>
                        <button className="nm-title-btn" onClick={() => { setEForm({ ...EMPTY_EVENT, ...e, event_start: e.event_start?.slice(0, 16) || "", event_end: e.event_end?.slice(0, 16) || "", recruit_start: e.recruit_start?.slice(0, 10) || "", recruit_end: e.recruit_end?.slice(0, 10) || "", date_tbd: !!e.date_tbd }); setEErr(""); setEventModal(e); }}>{e.title}</button>
                        {e.location && <span style={{ fontSize: 11, color: "#9ca3af", marginLeft: 6 }}>📍{e.location}</span>}
                      </td>
                      <td><span className="nm-badge" style={{ background: "#f3f4f6", color: "#374151" }}>{EVENT_TYPE_LABELS[e.event_type] || e.event_type}</span></td>
                      <td><span className="nm-badge" style={{ background: e.branch_name === "전체" ? "#dcfce7" : "#dbeafe", color: e.branch_name === "전체" ? "#166534" : "#1d4ed8" }}>{e.branch_name}</span></td>
                      <td style={{ color: "#374151", fontSize: 12 }}>{e.date_tbd ? <span style={{ color: "#9ca3af" }}>미정</span> : fmtDT(e.event_start)}</td>
                      <td style={{ color: "#374151", fontSize: 12 }}>{fmtDate(e.recruit_end)}</td>
                      <td><span className="nm-badge" style={{ background: st.bg, color: st.color }}>{st.label}</span></td>
                      {edit && <td><button className="nm-btn nm-btn-d" onClick={() => deleteEvent(e.event_id)}>삭제</button></td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── 공지 모달 ── */}
      {noticeModal !== null && (
        <div className="nm-modal-bg" onClick={e => { if (e.target === e.currentTarget) setNoticeModal(null); }}>
          <div className="nm-modal">
            <div className="nm-modal-hdr">
              <span className="nm-modal-title">{noticeModal === "new" ? "공지 등록" : "공지 상세 / 수정"}</span>
              <button className="nm-modal-close" onClick={() => setNoticeModal(null)}>×</button>
            </div>
            <div className="nm-modal-body">
              <div className="nm-row">
                <div className="nm-field">
                  <label className="nm-label">대상 지점</label>
                  <select className="nm-input" disabled={!edit} value={nForm.branch_name} onChange={e => setNForm((f: any) => ({ ...f, branch_name: e.target.value }))}>
                    <option value="전체">전체 공통</option>
                    {branches.map(b => <option key={b.option_id}>{b.option_name}</option>)}
                  </select>
                </div>
                <div className="nm-field">
                  <label className="nm-label">게시 상태</label>
                  <select className="nm-input" disabled={!edit} value={nForm.status} onChange={e => setNForm((f: any) => ({ ...f, status: e.target.value }))}>
                    <option value="DRAFT">초안</option>
                    <option value="PUBLISHED">게시중</option>
                    <option value="ENDED">게시 종료</option>
                  </select>
                </div>
              </div>
              <div className="nm-field">
                <label className="nm-label">제목</label>
                <input className="nm-input" disabled={!edit} placeholder="공지 제목" value={nForm.title} onChange={e => setNForm((f: any) => ({ ...f, title: e.target.value }))} />
              </div>
              <div className="nm-field">
                <label className="nm-label">내용</label>
                <textarea className="nm-textarea" disabled={!edit} placeholder="공지 내용" value={nForm.content} onChange={e => setNForm((f: any) => ({ ...f, content: e.target.value }))} />
              </div>
              <div className="nm-row">
                <div className="nm-field">
                  <label className="nm-label">게시 시작일</label>
                  <input type="date" className="nm-input" disabled={!edit} value={nForm.start_date} onChange={e => setNForm((f: any) => ({ ...f, start_date: e.target.value }))} />
                </div>
                <div className="nm-field">
                  <label className="nm-label">게시 종료일</label>
                  <input type="date" className="nm-input" disabled={!edit} value={nForm.end_date} onChange={e => setNForm((f: any) => ({ ...f, end_date: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="checkbox" id="n_imp" disabled={!edit} checked={!!nForm.is_important} onChange={e => setNForm((f: any) => ({ ...f, is_important: e.target.checked }))} />
                <label htmlFor="n_imp" style={{ fontSize: 13, fontWeight: 600, color: "#374151", cursor: edit ? "pointer" : "default" }}>중요 공지로 표시</label>
              </div>
              {nErr && <p className="nm-err">⚠️ {nErr}</p>}
            </div>
            <div className="nm-modal-foot">
              <button className="nm-btn nm-btn-s" onClick={() => setNoticeModal(null)}>닫기</button>
              {edit && <button className="nm-btn nm-btn-p" disabled={nSaving} onClick={saveNotice}>{nSaving ? "저장 중..." : noticeModal === "new" ? "등록" : "수정"}</button>}
            </div>
          </div>
        </div>
      )}

      {/* ── 일정 모달 ── */}
      {eventModal !== null && (
        <div className="nm-modal-bg" onClick={e => { if (e.target === e.currentTarget) setEventModal(null); }}>
          <div className="nm-modal">
            <div className="nm-modal-hdr">
              <span className="nm-modal-title">{eventModal === "new" ? "일정 등록" : "일정 상세 / 수정"}</span>
              <button className="nm-modal-close" onClick={() => setEventModal(null)}>×</button>
            </div>
            <div className="nm-modal-body">
              <div className="nm-row">
                <div className="nm-field">
                  <label className="nm-label">대상 지점</label>
                  <select className="nm-input" disabled={!edit} value={eForm.branch_name} onChange={e => setEForm((f: any) => ({ ...f, branch_name: e.target.value }))}>
                    <option value="전체">전체 공통</option>
                    {branches.map(b => <option key={b.option_id}>{b.option_name}</option>)}
                  </select>
                </div>
                <div className="nm-field">
                  <label className="nm-label">일정 종류</label>
                  <select className="nm-input" disabled={!edit} value={eForm.event_type} onChange={e => setEForm((f: any) => ({ ...f, event_type: e.target.value }))}>
                    {Object.entries(EVENT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div className="nm-field">
                  <label className="nm-label">게시 상태</label>
                  <select className="nm-input" disabled={!edit} value={eForm.status} onChange={e => setEForm((f: any) => ({ ...f, status: e.target.value }))}>
                    <option value="DRAFT">초안</option>
                    <option value="PUBLISHED">게시중</option>
                    <option value="ENDED">게시 종료</option>
                  </select>
                </div>
              </div>
              <div className="nm-field">
                <label className="nm-label">제목</label>
                <input className="nm-input" disabled={!edit} placeholder="일정 제목" value={eForm.title} onChange={e => setEForm((f: any) => ({ ...f, title: e.target.value }))} />
              </div>
              <div className="nm-field">
                <label className="nm-label">내용</label>
                <textarea className="nm-textarea" disabled={!edit} placeholder="일정 상세 내용" value={eForm.content} onChange={e => setEForm((f: any) => ({ ...f, content: e.target.value }))} />
              </div>
              <div className="nm-field">
                <label className="nm-label">장소 <span style={{ fontWeight: 400, color: "#9ca3af" }}>(선택)</span></label>
                <input className="nm-input" disabled={!edit} placeholder="장소" value={eForm.location} onChange={e => setEForm((f: any) => ({ ...f, location: e.target.value }))} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="checkbox" id="e_tbd" disabled={!edit} checked={!!eForm.date_tbd} onChange={e => setEForm((f: any) => ({ ...f, date_tbd: e.target.checked }))} />
                <label htmlFor="e_tbd" style={{ fontSize: 13, fontWeight: 600, color: "#374151", cursor: edit ? "pointer" : "default" }}>날짜 미정</label>
              </div>
              {!eForm.date_tbd && (
                <>
                  <div className="nm-row">
                    <div className="nm-field">
                      <label className="nm-label">행사 시작 일시</label>
                      <input type="datetime-local" className="nm-input" disabled={!edit} value={eForm.event_start} onChange={e => setEForm((f: any) => ({ ...f, event_start: e.target.value }))} />
                    </div>
                    <div className="nm-field">
                      <label className="nm-label">행사 종료 일시</label>
                      <input type="datetime-local" className="nm-input" disabled={!edit} value={eForm.event_end} onChange={e => setEForm((f: any) => ({ ...f, event_end: e.target.value }))} />
                    </div>
                  </div>
                  <div className="nm-row">
                    <div className="nm-field">
                      <label className="nm-label">모집 시작일 <span style={{ fontWeight: 400, color: "#9ca3af" }}>(선택)</span></label>
                      <input type="date" className="nm-input" disabled={!edit} value={eForm.recruit_start} onChange={e => setEForm((f: any) => ({ ...f, recruit_start: e.target.value }))} />
                    </div>
                    <div className="nm-field">
                      <label className="nm-label">접수 마감일 <span style={{ fontWeight: 400, color: "#9ca3af" }}>(선택)</span></label>
                      <input type="date" className="nm-input" disabled={!edit} value={eForm.recruit_end} onChange={e => setEForm((f: any) => ({ ...f, recruit_end: e.target.value }))} />
                    </div>
                  </div>
                </>
              )}
              {eErr && <p className="nm-err">⚠️ {eErr}</p>}
            </div>
            <div className="nm-modal-foot">
              <button className="nm-btn nm-btn-s" onClick={() => setEventModal(null)}>닫기</button>
              {edit && <button className="nm-btn nm-btn-p" disabled={eSaving} onClick={saveEvent}>{eSaving ? "저장 중..." : eventModal === "new" ? "등록" : "수정"}</button>}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
