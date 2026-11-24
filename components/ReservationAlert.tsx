"use client";

import { useEffect, useState } from "react";

const today = new Date().toISOString().slice(0, 10);

const SOURCE_LABEL: Record<string, string> = {
  NAVER: "네이버", naver: "네이버", "네이버예약": "네이버",
  HOMEPAGE: "홈페이지", homepage: "홈페이지",
};

const STATUS_COLOR: Record<string, string> = {
  예약확정: "#16a34a", 예약접수: "#2563eb", 취소: "#ef4444", 노쇼: "#6b7280",
};

export default function ReservationAlert() {
  const [rows, setRows] = useState<any[]>([]);
  const [visible, setVisible] = useState(true);

  const load = async () => {
    try {
      const savedUser = localStorage.getItem("user");
      const user = savedUser ? JSON.parse(savedUser) : null;
      let url = "/api/naver-reservations";
      if (user && user.role !== "ADMIN" && user.role !== "OWNER") {
        url += `?branch_name=${encodeURIComponent(user.branch_name)}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      const todayRows = (data.rows || []).filter((r: any) =>
        r.reservation_date?.slice(0, 10) === today &&
        r.status !== "취소" && r.status !== "노쇼"
      );
      setRows(todayRows);
    } catch {}
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 60000);
    return () => clearInterval(timer);
  }, []);

  if (!visible || rows.length === 0) return null;

  return (
    <div style={{
      position: "fixed", right: 20, bottom: 20, width: 340, zIndex: 9999,
      background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb",
      boxShadow: "0 8px 32px rgba(0,0,0,0.12)", overflow: "hidden",
    }}>
      {/* 헤더 */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "12px 16px", borderBottom: "1px solid #f3f4f6", background: "#f8fafc",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>📅</span>
          <span style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>
            {today} 예약 {rows.length}건
          </span>
        </div>
        <button onClick={() => setVisible(false)} style={{
          border: "none", background: "none", cursor: "pointer",
          fontSize: 18, color: "#9ca3af", lineHeight: 1, padding: "2px 4px",
        }}>×</button>
      </div>

      {/* 목록 */}
      <div style={{ maxHeight: 320, overflowY: "auto", padding: "8px 10px", display: "grid", gap: 6 }}>
        {rows.map((r) => (
          <div key={r.reservation_id} style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "8px 10px", borderRadius: 8, background: "#f8fafc",
            border: "1px solid #f3f4f6",
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>{r.customer_name}</div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 1 }}>
                {r.branch_name} · {r.reservation_time || "-"}
                {r.source && <> · {SOURCE_LABEL[r.source] || r.source}</>}
              </div>
            </div>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 99,
              color: STATUS_COLOR[r.status] || "#374151",
              background: (STATUS_COLOR[r.status] || "#374151") + "18",
              whiteSpace: "nowrap",
            }}>{r.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}