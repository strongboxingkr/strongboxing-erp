"use client";

import "react-calendar/dist/Calendar.css";
import { useEffect, useState } from "react";
import Calendar from "react-calendar";
import Holidays from "date-holidays";

const holidays = new Holidays("KR");
const BRANCHES = ["철산점", "목동점", "개봉점", "신정점"];
const STATUS_OPTIONS = ["예약접수", "예약확정", "상담완료", "확인완료", "노쇼", "취소"];
const TYPE_OPTIONS = ["PHONE", "HOMEPAGE", "KAKAO"];

const getStatusColor = (s: string) => {
  if (s === "예약접수") return "#3b82f6";
  if (s === "예약확정") return "#22c55e";
  if (s === "확인완료") return "#8b5cf6";
  if (s === "상담완료") return "#f59e0b";
  if (s === "노쇼") return "#ef4444";
  return "#94a3b8";
};

const getTypeInfo = (t: string) => {
  if (String(t).includes("NAVER")) return { label: "네이버", color: "#03c75a" };
  if (String(t).includes("HOMEPAGE")) return { label: "홈페이지", color: "#3b82f6" };
  if (String(t).includes("KAKAO")) return { label: "카카오", color: "#f59e0b" };
  if (String(t).includes("PHONE")) return { label: "전화", color: "#f97316" };
  return { label: "기타", color: "#94a3b8" };
};

const isNaver = (r: any) => String(r.event_type || "").includes("NAVER");

const toDateKey = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const EMPTY_FORM = {
  branch_name: "철산점",
  customer_name: "",
  phone: "",
  start_datetime: "",
  title: "방문 상담",
  memo: "",
  status: "예약접수",
  event_type: "PHONE",
};

export default function PublicCalendarPage() {
  const [value, setValue] = useState<any>(new Date());
  const [rows, setRows] = useState<any[]>([]);
  const [branch, setBranch] = useState("전체");
  const [mobile, setMobile] = useState(false);
  const [modal, setModal] = useState<{ mode: "add" | "edit"; data: any } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const check = () => setMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => { load(); }, [branch]);

  const load = async () => {
    const q = branch !== "전체" ? `?branch_name=${encodeURIComponent(branch)}` : "";
    const res = await fetch(`/api/public-calendar-events${q}`);
    const data = await res.json();
    setRows(data.rows || []);
  };

  const selectedDate = toDateKey(Array.isArray(value) ? value[0] : value);
  const todayKey = toDateKey(new Date());

  const selectedRows = rows
    .filter((r) => r.start_datetime?.slice(0, 10) === selectedDate)
    .sort((a, b) => String(a.start_datetime).localeCompare(String(b.start_datetime)));

  const getRowsByDate = (date: Date) =>
    rows.filter((r) => r.start_datetime?.slice(0, 10) === toDateKey(date));

  const getTypeCounts = (rs: any[]) => ({
    naver: rs.filter((r) => String(r.event_type || "").includes("NAVER")).length,
    kakao: rs.filter((r) => String(r.event_type || "").includes("KAKAO")).length,
    homepage: rs.filter((r) => String(r.event_type || "").includes("HOMEPAGE")).length,
    phone: rs.filter((r) => String(r.event_type || "").includes("PHONE")).length,
  });

  const openAdd = () => {
    const dt = selectedDate + "T10:00";
    setModal({ mode: "add", data: { ...EMPTY_FORM, branch_name: branch !== "전체" ? branch : "철산점", start_datetime: dt } });
  };

  const openEdit = (r: any) => {
    if (isNaver(r)) return;
    setModal({
      mode: "edit",
      data: {
        event_id: r.event_id,
        branch_name: r.branch_name,
        customer_name: r.customer_name,
        phone: r.phone || "",
        start_datetime: String(r.start_datetime || "").slice(0, 16).replace(" ", "T"),
        title: r.title || "",
        memo: r.memo || "",
        status: r.status,
        event_type: r.event_type,
      },
    });
  };

  const save = async () => {
    if (!modal) return;
    setSaving(true);
    try {
      await fetch("/api/public-calendar-events", {
        method: modal.mode === "add" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(modal.data),
      });
      setModal(null);
      load();
    } finally {
      setSaving(false);
    }
  };

  const upd = (k: string, v: string) => setModal((m) => m ? { ...m, data: { ...m.data, [k]: v } } : m);

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #f8fafc; }

        .public-cal .react-calendar {
          width: 100%; border: none; background: transparent;
          font-family: -apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif;
        }
        .public-cal .react-calendar__navigation { display: flex; align-items: center; margin-bottom: 12px; gap: 4px; }
        .public-cal .react-calendar__navigation button {
          background: none; border: none; font-size: 15px; font-weight: 700; color: #1e293b;
          cursor: pointer; padding: 6px 10px; border-radius: 8px; min-width: 36px;
        }
        .public-cal .react-calendar__navigation button:hover { background: #f1f5f9; }
        .public-cal .react-calendar__navigation__label { font-size: 17px !important; font-weight: 900 !important; color: #0f172a !important; flex: 1; }
        .public-cal .react-calendar__month-view__weekdays { text-align: center; margin-bottom: 4px; }
        .public-cal .react-calendar__month-view__weekdays__weekday { font-size: 12px; font-weight: 700; color: #94a3b8; padding: 6px 0; }
        .public-cal .react-calendar__month-view__weekdays__weekday abbr { text-decoration: none; }
        .public-cal .react-calendar__tile {
          background: none; border: none; border-radius: 12px; padding: 8px 4px;
          cursor: pointer; font-size: 14px; font-weight: 600; color: #1e293b;
          transition: background 0.15s; min-height: 72px; display: flex; flex-direction: column; align-items: center;
        }
        .public-cal .react-calendar__tile:hover { background: #f1f5f9; }
        .public-cal .react-calendar__tile--active { background: #0f172a !important; color: white !important; }
        .public-cal .react-calendar__tile--active:hover { background: #1e293b !important; }
        .public-cal .react-calendar__tile.today { background: #eff6ff; color: #3b82f6; font-weight: 900; }
        .public-cal .react-calendar__tile.today.react-calendar__tile--active { background: #0f172a !important; color: white !important; }
        .public-cal .react-calendar__tile.sunday abbr, .public-cal .react-calendar__tile.holiday abbr { color: #ef4444; }
        .public-cal .react-calendar__tile.saturday abbr { color: #3b82f6; }
        .public-cal .react-calendar__month-view__days__day--neighboringMonth { opacity: 0.3; }
        .inp { width: 100%; border: 1px solid #e2e8f0; border-radius: 10px; padding: 9px 12px; font-size: 14px; background: #fff; outline: none; font-family: inherit; color: #0f172a; }
        .inp:focus { border-color: #0f172a; }
        .btn-pri { background: #0f172a; color: white; border: none; border-radius: 10px; padding: 9px 20px; font-size: 13px; font-weight: 700; cursor: pointer; }
        .btn-sec { background: #f1f5f9; color: #1e293b; border: none; border-radius: 10px; padding: 9px 20px; font-size: 13px; font-weight: 700; cursor: pointer; }
      `}</style>

      <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "-apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif", color: "#0f172a" }}>
        {/* 헤더 */}
        <div style={{ background: "white", borderBottom: "1px solid #e2e8f0", padding: mobile ? "16px 20px" : "20px 40px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#0f172a", letterSpacing: -0.5 }}>스트롱복싱 예약 캘린더</div>
            <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 2 }}>예약 현황을 확인하세요</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {/* 지점 탭 */}
            {["전체", ...BRANCHES].map((b) => (
              <button key={b} onClick={() => setBranch(b)} style={{
                padding: "7px 16px", borderRadius: 999, border: "none", cursor: "pointer",
                fontSize: 13, fontWeight: 700,
                background: branch === b ? "#0f172a" : "#f1f5f9",
                color: branch === b ? "white" : "#64748b",
                transition: "all 0.15s",
              }}>{b}</button>
            ))}
          </div>
        </div>

        {/* 본문 */}
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: mobile ? "16px 12px" : "32px 40px", display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 400px", gap: 24, alignItems: "start" }}>
          {/* 캘린더 */}
          <div className="public-cal" style={{ background: "white", borderRadius: 20, padding: mobile ? 16 : 24, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <Calendar
              onChange={(v) => setValue(v)}
              value={value}
              locale="ko-KR"
              calendarType="gregory"
              formatDay={(_, date) => `${date.getDate()}`}
              tileClassName={({ date, view }) => {
                if (view !== "month") return "";
                const key = toDateKey(date);
                if (key === todayKey) return "today";
                if (holidays.isHoliday(date)) return "holiday";
                if (date.getDay() === 0) return "sunday";
                if (date.getDay() === 6) return "saturday";
                return "";
              }}
              tileContent={({ date }) => {
                const dayRows = getRowsByDate(date);
                const count = dayRows.length;
                if (count === 0) return null;
                const tc = getTypeCounts(dayRows);
                const dots = [
                  ...Array(tc.naver).fill("#03c75a"),
                  ...Array(tc.homepage).fill("#3b82f6"),
                  ...Array(tc.kakao).fill("#f59e0b"),
                  ...Array(tc.phone).fill("#f97316"),
                ].slice(0, 6);
                return (
                  <div style={{ marginTop: 4, width: "100%" }}>
                    <div style={{ display: "flex", justifyContent: "center", gap: 2, marginBottom: 3 }}>
                      {dots.map((color, i) => (
                        <span key={i} style={{ width: 5, height: 5, borderRadius: 999, background: color, display: "inline-block" }} />
                      ))}
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 800, color: count >= 5 ? "#ef4444" : "#3b82f6" }}>{count}건</div>
                  </div>
                );
              }}
            />
          </div>

          {/* 예약 목록 */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 900, color: "#0f172a" }}>{selectedDate.replace(/-/g, ".")}</div>
                <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 4 }}>
                  {selectedRows.length > 0 ? `총 ${selectedRows.length}건 예약` : "예약 없음"}
                </div>
              </div>
              <button className="btn-pri" onClick={openAdd}>+ 추가</button>
            </div>

            {selectedRows.length === 0 ? (
              <div style={{ background: "white", borderRadius: 16, padding: "40px 20px", textAlign: "center", color: "#cbd5e1", fontSize: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                이 날은 예약이 없습니다
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {selectedRows.map((r) => {
                  const type = getTypeInfo(r.event_type);
                  const statusColor = getStatusColor(r.status);
                  const naver = isNaver(r);
                  return (
                    <div
                      key={r.event_id}
                      onClick={() => openEdit(r)}
                      style={{
                        background: "white", borderRadius: 16, padding: "16px 18px",
                        boxShadow: "0 1px 4px rgba(0,0,0,0.06)", borderLeft: `4px solid ${statusColor}`,
                        display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
                        cursor: naver ? "default" : "pointer",
                        opacity: naver ? 0.75 : 1,
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 18, fontWeight: 900, color: "#0f172a" }}>{r.start_datetime?.slice(11, 16) || "-"}</span>
                          <span style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>
                            {naver && <span style={{ fontSize: 11, marginRight: 3 }}>🔒</span>}
                            {r.customer_name || "-"}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: "#94a3b8" }}>{r.branch_name} · {r.phone || "-"}</div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end", flexShrink: 0 }}>
                        <span style={{ padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: `${type.color}18`, color: type.color }}>{type.label}</span>
                        <span style={{ padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: `${statusColor}18`, color: statusColor }}>{r.status}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 모달 */}
      {modal && (
        <div onClick={() => setModal(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "grid", placeItems: "center", zIndex: 9999, padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "white", borderRadius: 20, padding: 28, width: "100%", maxWidth: 460, display: "flex", flexDirection: "column", gap: 12 }}>
            <h3 style={{ fontSize: 18, fontWeight: 900, color: "#0f172a" }}>{modal.mode === "add" ? "예약 추가" : "예약 수정"}</h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 4 }}>지점</label>
                <select className="inp" value={modal.data.branch_name} onChange={(e) => upd("branch_name", e.target.value)}>
                  {BRANCHES.map((b) => <option key={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 4 }}>출처</label>
                <select className="inp" value={modal.data.event_type} onChange={(e) => upd("event_type", e.target.value)}>
                  {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{getTypeInfo(t).label}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 4 }}>이름 *</label>
              <input className="inp" value={modal.data.customer_name} onChange={(e) => upd("customer_name", e.target.value)} placeholder="고객 이름" />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 4 }}>연락처</label>
              <input className="inp" value={modal.data.phone} onChange={(e) => upd("phone", e.target.value)} placeholder="010-0000-0000" />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 4 }}>방문 일시 *</label>
              <input className="inp" type="datetime-local" value={modal.data.start_datetime} onChange={(e) => upd("start_datetime", e.target.value)} />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 4 }}>예약내용</label>
              <input className="inp" value={modal.data.title} onChange={(e) => upd("title", e.target.value)} placeholder="방문 상담" />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 4 }}>상태</label>
              <select className="inp" value={modal.data.status} onChange={(e) => upd("status", e.target.value)}>
                {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 4 }}>메모</label>
              <textarea className="inp" value={modal.data.memo} onChange={(e) => upd("memo", e.target.value)} rows={3} style={{ resize: "none" }} />
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <button className="btn-sec" style={{ flex: 1 }} onClick={() => setModal(null)}>취소</button>
              <button className="btn-pri" style={{ flex: 1 }} onClick={save} disabled={saving}>{saving ? "저장 중..." : "저장"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
