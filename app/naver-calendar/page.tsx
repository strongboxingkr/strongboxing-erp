"use client";

import "react-calendar/dist/Calendar.css";

import { useEffect, useState } from "react";
import Calendar from "react-calendar";
import Holidays from "date-holidays";
import { apiFetch } from "@/lib/api";
import AppShell from "@/components/AppShell";

const holidays = new Holidays("KR");

const getStatusColor = (status: string) => {
  if (status === "예약접수") return "#3b82f6";
  if (status === "예약확정") return "#22c55e";
  if (status === "확인완료") return "#8b5cf6";
  if (status === "상담완료") return "#f59e0b";
  if (status === "노쇼") return "#ef4444";
  if (status === "취소") return "#9ca3af";
  return "#aaa";
};

const getTypeInfo = (r: any) => {
  const type = String(r.event_type || r.source_type || "");
  if (type.includes("NAVER")) return { label: "네이버", color: "#22c55e" };
  if (type.includes("HOMEPAGE")) return { label: "홈페이지", color: "#3b82f6" };
  if (type.includes("KAKAO")) return { label: "카카오", color: "#f59e0b" };
  if (type.includes("PHONE")) return { label: "전화", color: "#f97316" };
  return { label: "", color: "#94a3b8" };
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

  const toDateKey = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const selectedDate = toDateKey(Array.isArray(value) ? value[0] : value);
  const todayKey = toDateKey(new Date());

  const isHoliday = (date: Date) => !!holidays.isHoliday(date);
  const isCancelled = (r: any) => ["취소", "예약취소"].includes(r.status);

  const isAdminOrOwner = user?.role === "ADMIN" || user?.role === "OWNER";

  const loadBranches = async () => {
    const res = await apiFetch("/api/settings?option_type=BRANCH");
    const data = await res.json();
    setBranches(data.rows || []);
  };

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

  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) setUser(JSON.parse(savedUser));
    const check = () => setMobile(window.innerWidth < 900);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => { loadBranches(); }, []);
  useEffect(() => { if (user) loadReservations(); }, [branch, user]);

  const getDateRows = (date: Date) =>
    rows.filter((r) => r.start_datetime?.slice(0, 10) === toDateKey(date) && !isCancelled(r));

  const selectedRows = rows
    .filter((r) => r.start_datetime?.slice(0, 10) === selectedDate)
    .sort((a, b) => String(a.start_datetime || "").localeCompare(String(b.start_datetime || "")));

  return (
    <AppShell title="예약 캘린더">
      <style>{`
        /* ── 도구 줄 ── */
        .cal-toolbar { display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-bottom:12px; }

        /* ── 레이아웃 ── */
        .cal-layout { display:grid; grid-template-columns:1fr 320px; gap:14px; align-items:start; }
        @media(max-width:900px){ .cal-layout { grid-template-columns:1fr; } }

        /* ── react-calendar 오버라이드 (얇은 격자형) ── */
        .cal-wrap .react-calendar { width:100%; border:1px solid #e5e7eb; border-radius:10px; background:#fff; font-family:inherit; }
        .cal-wrap .react-calendar__navigation { height:40px; margin-bottom:0; border-bottom:1px solid #f3f4f6; }
        .cal-wrap .react-calendar__navigation button { min-width:36px; font-size:13px; font-weight:600; color:#374151; background:none; border:none; border-radius:6px; }
        .cal-wrap .react-calendar__navigation button:hover { background:#f3f4f6; }
        .cal-wrap .react-calendar__navigation button:disabled { opacity:.3; }
        .cal-wrap .react-calendar__month-view__weekdays { border-bottom:1px solid #f3f4f6; }
        .cal-wrap .react-calendar__month-view__weekdays__weekday { padding:6px 0; font-size:11px; font-weight:600; color:#9CA3AF; text-align:center; }
        .cal-wrap .react-calendar__month-view__weekdays__weekday abbr { text-decoration:none; }
        .cal-wrap .react-calendar__month-view__days__day { padding:0; }
        .cal-wrap .react-calendar__tile {
          height:72px; padding:6px 4px 4px; display:flex; flex-direction:column; align-items:center;
          border:none; background:none; border-right:1px solid #f3f4f6; border-bottom:1px solid #f3f4f6;
          font-size:13px; color:#374151; cursor:pointer; position:relative;
        }
        .cal-wrap .react-calendar__tile:hover { background:#f8faff; }
        .cal-wrap .react-calendar__tile abbr { font-size:13px; font-weight:500; line-height:1; }
        /* 오늘 */
        .cal-wrap .react-calendar__tile--now { background:#eff6ff !important; }
        .cal-wrap .react-calendar__tile--now abbr { color:#2563eb; font-weight:700; }
        /* 선택 날짜 */
        .cal-wrap .react-calendar__tile--active,
        .cal-wrap .react-calendar__tile--active:hover { background:#2563eb !important; border-radius:0; }
        .cal-wrap .react-calendar__tile--active abbr { color:#fff !important; font-weight:700; }
        /* 주말·공휴일 */
        .cal-wrap .react-calendar__month-view__days__day--weekend abbr { color:#ef4444; }
        .cal-wrap .react-calendar__tile.holiday abbr { color:#ef4444; }
        /* 이웃 달 날짜 */
        .cal-wrap .react-calendar__month-view__days__day--neighboringMonth { opacity:.35; }

        /* ── 예약 목록 ── */
        .res-list-item { display:flex; align-items:flex-start; gap:10px; padding:10px 12px; border-bottom:1px solid #f3f4f6; cursor:pointer; }
        .res-list-item:hover { background:#f8faff; }
        .res-list-item:last-child { border-bottom:none; }
        .badge { display:inline-block; padding:1px 7px; border-radius:999px; font-size:11px; font-weight:600; }

        /* ── 상세 모달 ── */
        .modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; z-index:9999; padding:16px; }
        .modal-box { width:100%; max-width:560px; max-height:90vh; background:#fff; border-radius:14px; display:flex; flex-direction:column; box-shadow:0 20px 60px rgba(0,0,0,.15); overflow:hidden; }
        .modal-header { padding:18px 20px 14px; border-bottom:1px solid #f3f4f6; flex-shrink:0; }
        .modal-body { flex:1; overflow-y:auto; padding:14px 20px; }
        .modal-footer { padding:12px 20px; border-top:1px solid #f3f4f6; flex-shrink:0; display:flex; gap:8px; justify-content:flex-end; }
      `}</style>

      {/* 도구 줄 */}
      <div className="cal-toolbar">
        {isAdminOrOwner ? (
          <select className="input" style={{ height:34, fontSize:13, minWidth:120 }} value={branch} onChange={(e) => setBranch(e.target.value)}>
            <option>전체</option>
            {branches.map((b) => <option key={b.option_id}>{b.option_name}</option>)}
          </select>
        ) : (
          <span style={{ fontSize:13, fontWeight:600, color:"#374151" }}>{user?.branch_name}</span>
        )}
        <button className="btn secondary" style={{ height:34, fontSize:13 }} onClick={() => setValue(new Date())}>오늘</button>
        <button className="btn secondary" style={{ height:34, fontSize:13 }} onClick={loadReservations}>새로고침</button>
        <span style={{ fontSize:12, color:"#9CA3AF", marginLeft:"auto" }}>
          {selectedDate} · {selectedRows.length}건
        </span>
      </div>

      {/* 메인 레이아웃 */}
      <div className="cal-layout">
        {/* 달력 */}
        <div className="cal-wrap" style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:10, overflow:"hidden" }}>
          <Calendar
            onChange={(v) => setValue(v)}
            value={value}
            locale="ko-KR"
            calendarType="gregory"
            formatDay={(_, date) => `${date.getDate()}`}
            formatMonthYear={(_, date) => `${date.getFullYear()}년 ${date.getMonth()+1}월`}
            tileClassName={({ date, view }) => {
              if (view !== "month") return "";
              if (isHoliday(date)) return "holiday";
              return "";
            }}
            tileContent={({ date, view }) => {
              if (view !== "month") return null;
              const dayRows = getDateRows(date);
              const count = dayRows.length;
              if (count === 0) return null;
              const isSelected = toDateKey(date) === selectedDate;
              return (
                <div style={{ marginTop:3, display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
                  <div style={{ display:"flex", gap:2 }}>
                    {["NAVER","HOMEPAGE","KAKAO","PHONE"].map((type) => {
                      const n = dayRows.filter((r) => String(r.event_type||"").includes(type)).length;
                      if (!n) return null;
                      const colors: Record<string,string> = { NAVER:"#22c55e", HOMEPAGE:"#3b82f6", KAKAO:"#f59e0b", PHONE:"#f97316" };
                      return <span key={type} style={{ width:5, height:5, borderRadius:999, background: isSelected ? "rgba(255,255,255,0.8)" : colors[type], display:"inline-block" }} />;
                    })}
                  </div>
                  <span style={{ fontSize:10, fontWeight:700, color: isSelected ? "rgba(255,255,255,0.9)" : (count >= 5 ? "#ef4444" : "#2563eb"), lineHeight:1 }}>
                    {count}건
                  </span>
                </div>
              );
            }}
          />
        </div>

        {/* 오른쪽 예약 목록 */}
        <div style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:10, overflow:"hidden" }}>
          {/* 날짜 헤더 */}
          <div style={{ padding:"12px 14px 10px", borderBottom:"1px solid #f3f4f6" }}>
            <div style={{ fontSize:14, fontWeight:700, color:"#111827" }}>{selectedDate}</div>
            <div style={{ fontSize:12, color:"#9CA3AF", marginTop:2 }}>예약 {selectedRows.length}건</div>
          </div>

          {selectedRows.length === 0 ? (
            <div style={{ padding:"32px 0", textAlign:"center", color:"#9CA3AF", fontSize:13 }}>예약이 없습니다.</div>
          ) : (
            <div>
              {selectedRows.map((r) => {
                const type = getTypeInfo(r);
                const cancelled = isCancelled(r);
                return (
                  <div key={r.event_id} className="res-list-item" onClick={() => setSelected(r)}
                    style={{ opacity: cancelled ? 0.5 : 1, background: cancelled ? "#fafafa" : undefined }}>
                    {/* 시간 */}
                    <div style={{ minWidth:38, fontSize:13, fontWeight:700, color:"#374151", paddingTop:1 }}>
                      {r.start_datetime?.slice(11,16) || "-"}
                    </div>
                    {/* 메인 정보 */}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                        <span style={{ fontSize:14, fontWeight:700, color: cancelled ? "#9CA3AF" : "#111827", textDecoration: cancelled ? "line-through" : "none" }}>
                          {r.customer_name || "-"}
                        </span>
                        {type.label && (
                          <span className="badge" style={{ background:`${type.color}18`, color:type.color }}>{type.label}</span>
                        )}
                        <span className="badge" style={{ background:`${getStatusColor(r.status)}18`, color:getStatusColor(r.status) }}>
                          {r.status}
                        </span>
                      </div>
                      <div style={{ fontSize:12, color:"#374151", marginTop:3, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                        {r.title || r.reservation_product || "-"}
                      </div>
                      <div style={{ fontSize:11, color:"#9CA3AF", marginTop:2 }}>
                        {r.branch_name}{r.phone ? ` · ${r.phone}` : ""}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 상세 모달 */}
      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div>
                  <div style={{ fontSize:18, fontWeight:800, color:"#111827" }}>{selected.customer_name || "-"}</div>
                  <div style={{ fontSize:12, color:"#6B7280", marginTop:4 }}>
                    {selected.branch_name} · {selected.start_datetime?.slice(0,16).replace("T"," ")}
                    {(() => { const t = getTypeInfo(selected); return t.label ? <span style={{ marginLeft:6, color:t.color }}>{t.label}</span> : null; })()}
                  </div>
                </div>
                <button onClick={() => setSelected(null)} style={{ background:"none", border:"none", fontSize:18, color:"#9CA3AF", cursor:"pointer" }}>✕</button>
              </div>
            </div>
            <div className="modal-body">
              {/* 고객 요청사항 */}
              {(() => {
                const memo = selected.memo || "";
                const reqMatch = memo.match(/요청사항[^\n]*[\n\s]*([\s\S]*?)(?:\n[가-힣]+\s*[-:ㅡ]|$)/);
                const inquiry = reqMatch ? reqMatch[1].trim() : "";
                if (!inquiry || inquiry === "-") return null;
                return (
                  <div style={{ background:"#fefce8", border:"1px solid #fde68a", borderRadius:8, padding:"10px 12px", marginBottom:12, fontSize:13, color:"#92400e" }}>
                    <div style={{ fontSize:11, fontWeight:700, color:"#b45309", marginBottom:4 }}>고객 요청사항</div>
                    {inquiry}
                  </div>
                );
              })()}

              <input className="input" value={selected.customer_name || ""} onChange={(e) => setSelected({ ...selected, customer_name: e.target.value })} placeholder="이름" style={{ marginBottom:8 }} />
              <input className="input" value={selected.phone || ""} onChange={(e) => setSelected({ ...selected, phone: e.target.value })} placeholder="전화번호" style={{ marginBottom:8 }} />
              <input className="input" type="datetime-local" value={selected.start_datetime?.slice(0,16) || ""} onChange={(e) => setSelected({ ...selected, start_datetime: e.target.value })} style={{ marginBottom:8 }} />

              <div style={{ fontSize:12, color:"#9CA3AF", marginBottom:10 }}>
                예약 목적: {selected.title || "-"} · 생성: {selected.created_at?.slice(0,16).replace("T"," ") || "-"}
              </div>

              <textarea className="input" value={selected.memo || ""} onChange={(e) => setSelected({ ...selected, memo: e.target.value })}
                placeholder="메모" style={{ width:"100%", minHeight:70, resize:"none", marginBottom:10, fontSize:13 }} />

              <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:14 }}>
                {["예약접수","예약확정","상담완료","노쇼","취소"].map((s) => (
                  <button key={s}
                    style={{ height:30, padding:"0 11px", borderRadius:6, fontSize:12, fontWeight:600, cursor:"pointer", border:"none",
                      background: selected.status === s ? getStatusColor(s) : "#f3f4f6",
                      color: selected.status === s ? "#fff" : "#374151" }}
                    onClick={async () => {
                      if (s === "예약확정") {
                        const dt = selected.start_datetime || "";
                        setSmsModal({
                          pendingStatus: s,
                          msg: `[스트롱복싱 ${selected.branch_name}]\n\n${selected.customer_name}님 예약이 확정되었습니다.\n\n방문일시 : ${dt.slice(0,10)} ${dt.slice(11,16)}\n예약내용 : ${selected.title || "방문 상담"}\n\n예약하신 시간에 뵙겠습니다.\n\n감사합니다 🥊\n스트롱복싱 ${selected.branch_name}`,
                        });
                        return;
                      }
                      const res = await apiFetch("/api/calendar-events/edit", {
                        method:"POST",
                        body: JSON.stringify({ event_id:selected.event_id, customer_name:selected.customer_name, phone:selected.phone, start_datetime:selected.start_datetime, event_type:selected.event_type, title:selected.title, status:s, memo:selected.memo }),
                      });
                      const json = await res.json();
                      if (json.success) { alert(`${s} 처리 완료`); setSelected(null); loadReservations(); }
                      else alert(json.message || "처리 실패");
                    }}>{s}</button>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn secondary" style={{ height:34, fontSize:13 }} onClick={() => location.href="/crm"}>CRM</button>
              <button className="btn secondary" style={{ height:34, fontSize:13 }} onClick={() => setSelected(null)}>닫기</button>
              <button className="btn" style={{ height:34, fontSize:13 }} onClick={async () => {
                const res = await apiFetch("/api/calendar-events/edit", {
                  method:"POST",
                  body: JSON.stringify({ event_id:selected.event_id, customer_name:selected.customer_name, phone:selected.phone, start_datetime:selected.start_datetime, event_type:selected.event_type, title:selected.title, status:selected.status, memo:selected.memo }),
                });
                const json = await res.json();
                if (json.success) { alert("저장 완료"); setSelected(null); loadReservations(); }
                else alert(json.message || "저장 실패");
              }}>저장</button>
            </div>
          </div>
        </div>
      )}

      {/* 문자 모달 */}
      {smsModal && selected && (
        <div className="modal-overlay" onClick={() => setSmsModal(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ width:"100%", maxWidth:500, background:"#fff", borderRadius:14, padding:22, boxShadow:"0 20px 60px rgba(0,0,0,.15)" }}>
            <div style={{ fontSize:15, fontWeight:700, marginBottom:4 }}>예약확정 문자 미리보기</div>
            <div style={{ fontSize:12, color:"#6B7280", marginBottom:12 }}>{selected.customer_name} · {selected.phone || "연락처 없음"}</div>
            <textarea className="input" value={smsModal.msg} onChange={(e) => setSmsModal({ ...smsModal, msg:e.target.value })}
              rows={10} style={{ fontSize:13, resize:"vertical", marginBottom:14 }} />
            <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
              <button className="btn secondary" style={{ height:34, fontSize:13 }} onClick={() => setSmsModal(null)}>닫기 (변경 없음)</button>
              <button className="btn secondary" style={{ height:34, fontSize:13 }} onClick={async () => {
                const res = await apiFetch("/api/calendar-events/edit", {
                  method:"POST",
                  body: JSON.stringify({ event_id:selected.event_id, customer_name:selected.customer_name, phone:selected.phone, start_datetime:selected.start_datetime, event_type:selected.event_type, title:selected.title, status:smsModal.pendingStatus, memo:selected.memo }),
                });
                const json = await res.json();
                setSmsModal(null);
                setSelected(null);
                loadReservations();
                alert(json.success ? "예약확정 완료 (문자 미발송)" : json.message || "처리 실패");
              }}>문자 없이 확정</button>
              <button className="btn" style={{ height:34, fontSize:13 }} disabled={!selected.phone} onClick={async () => {
                const res = await apiFetch("/api/calendar-events/edit", {
                  method:"POST",
                  body: JSON.stringify({ event_id:selected.event_id, customer_name:selected.customer_name, phone:selected.phone, start_datetime:selected.start_datetime, event_type:selected.event_type, title:selected.title, status:smsModal.pendingStatus, memo:selected.memo }),
                });
                const json = await res.json();
                if (!json.success) { alert(json.message || "처리 실패"); return; }
                const smsRes = await apiFetch("/api/sms/send-reservation", {
                  method:"POST",
                  body: JSON.stringify({ phone:selected.phone, branch_name:selected.branch_name, message:smsModal.msg, receiver_name:selected.customer_name }),
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
