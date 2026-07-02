"use client";

import "react-calendar/dist/Calendar.css";
import { useEffect, useState } from "react";
import Calendar from "react-calendar";
import Holidays from "date-holidays";

const holidays = new Holidays("KR");

const BRANCHES = ["철산점", "목동점", "개봉점", "신정점"];

const getStatusColor = (status: string) => {
  if (status === "예약접수") return "#3b82f6";
  if (status === "예약확정") return "#22c55e";
  if (status === "확인완료") return "#8b5cf6";
  if (status === "상담완료") return "#f59e0b";
  if (status === "노쇼") return "#ef4444";
  return "#aaa";
};

const getTypeInfo = (r: any) => {
  const type = String(r.event_type || "");
  if (type.includes("NAVER")) return { label: "네이버", color: "#22c55e" };
  if (type.includes("HOMEPAGE")) return { label: "홈페이지", color: "#3b82f6" };
  if (type.includes("KAKAO")) return { label: "카카오", color: "#facc15" };
  if (type.includes("PHONE")) return { label: "전화예약", color: "#f97316" };
  return { label: "예약", color: "#94a3b8" };
};

const toDateKey = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export default function PublicCalendarPage() {
  const [value, setValue] = useState<any>(new Date());
  const [rows, setRows] = useState<any[]>([]);
  const [branch, setBranch] = useState("전체");
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setMobile(window.innerWidth < 900);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    load();
  }, [branch]);

  const load = async () => {
    const branchQ = branch !== "전체" ? `?branch_name=${encodeURIComponent(branch)}` : "";
    const res = await fetch(`/api/public-calendar-events${branchQ}`);
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

  const getTypeCounts = (targetRows: any[]) => ({
    naver: targetRows.filter((r) => String(r.event_type || "").includes("NAVER")).length,
    kakao: targetRows.filter((r) => String(r.event_type || "").includes("KAKAO")).length,
    homepage: targetRows.filter((r) => String(r.event_type || "").includes("HOMEPAGE")).length,
    phone: targetRows.filter((r) => String(r.event_type || "").includes("PHONE")).length,
  });

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg, #0f172a)",
      color: "var(--text, #f8fafc)",
      fontFamily: "-apple-system, 'Apple SD Gothic Neo', sans-serif",
      padding: mobile ? 12 : 24,
    }}>
      {/* 헤더 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 900 }}>📅 예약 캘린더</div>
          <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>스트롱복싱 예약 현황</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            style={{
              background: "#1e293b", color: "#f8fafc", border: "1px solid #334155",
              borderRadius: 8, padding: "8px 12px", fontSize: 14,
            }}
          >
            <option value="전체">전체 지점</option>
            {BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          <button
            onClick={load}
            style={{ background: "#1e293b", color: "#f8fafc", border: "1px solid #334155", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 14 }}
          >
            새로고침
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1.2fr 1fr", gap: 16, alignItems: "start" }}>
        {/* 캘린더 */}
        <div style={{ background: "#1e293b", borderRadius: 20, overflow: "hidden", padding: 4 }}>
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
                ...Array(tc.naver).fill("#22c55e"),
                ...Array(tc.kakao).fill("#facc15"),
                ...Array(tc.homepage).fill("#3b82f6"),
                ...Array(tc.phone).fill("#f97316"),
              ].slice(0, 8);
              return (
                <div style={{ marginTop: 4 }}>
                  <div style={{ display: "flex", justifyContent: "center", gap: 2, flexWrap: "wrap", marginBottom: 2 }}>
                    {dots.map((color, i) => (
                      <span key={i} style={{ width: 5, height: 5, borderRadius: 999, background: color, display: "inline-block" }} />
                    ))}
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 900, color: count >= 5 ? "#ff4d6d" : "#2ee59d" }}>
                    {count >= 5 ? `🔥${count}건` : `${count}건`}
                  </div>
                </div>
              );
            }}
          />
        </div>

        {/* 예약 목록 */}
        <div style={{ background: "#1e293b", borderRadius: 20, padding: 20 }}>
          <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 4 }}>{selectedDate}</div>
          <div style={{ color: "#64748b", marginBottom: 16 }}>총 {selectedRows.length}건 예약</div>

          {selectedRows.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: "#334155", borderRadius: 12, background: "#0f172a" }}>
              예약이 없습니다.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {selectedRows.map((r) => {
                const type = getTypeInfo(r);
                return (
                  <div key={r.event_id} style={{
                    padding: 16,
                    borderRadius: 14,
                    background: "#0f172a",
                    borderLeft: `6px solid ${getStatusColor(r.status)}`,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 22, fontWeight: 900 }}>{r.start_datetime?.slice(11, 16) || "-"}</div>
                        <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>{r.customer_name || "-"}</div>
                        <div style={{ color: "#64748b", marginTop: 4, fontSize: 13 }}>{r.branch_name} · 📞 {r.phone || "-"}</div>
                        {r.title && <div style={{ color: "#94a3b8", marginTop: 4, fontSize: 13 }}>{r.title}</div>}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                        <span style={{ padding: "4px 10px", borderRadius: 999, background: `${type.color}22`, color: type.color, fontSize: 12, fontWeight: 700, textAlign: "center" }}>
                          {type.label}
                        </span>
                        <span style={{ padding: "4px 10px", borderRadius: 999, background: `${getStatusColor(r.status)}22`, color: getStatusColor(r.status), fontSize: 12, fontWeight: 700, textAlign: "center" }}>
                          {r.status}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
