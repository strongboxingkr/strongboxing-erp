"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { apiFetch } from "@/lib/api";

const today = new Date().toISOString().slice(0, 10);

export default function CalendarPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [branch, setBranch] = useState("전체");
  const [date, setDate] = useState(today);

  const loadBranches = async () => {
    const res = await apiFetch("/api/settings?option_type=BRANCH");
    const json = await res.json();
    setBranches(json.rows || []);
  };

  const load = async () => {
    let url = `/api/calendar-events?start_date=${date}&end_date=${date}`;

    if (branch !== "전체") {
      url += `&branch_name=${encodeURIComponent(branch)}`;
    }

    const res = await apiFetch(url);
    const json = await res.json();

    setRows(json.rows || []);
  };

  useEffect(() => {
    loadBranches();
  }, []);

  useEffect(() => {
    load();
  }, [branch, date]);

  return (
    <AppShell title="통합 예약 캘린더">
      <div className="card" style={{ borderRadius: 24, marginBottom: 18 }}>
        <h1 style={{ marginTop: 0 }}>통합 예약 캘린더</h1>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "180px 180px auto",
            gap: 12,
          }}
        >
          <select
            className="input"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
          >
            <option>전체</option>
            {branches.map((b) => (
              <option key={b.option_id}>{b.option_name}</option>
            ))}
          </select>

          <input
            className="input"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />

          <button className="btn" onClick={load}>
            새로고침
          </button>
        </div>
      </div>

      <div className="card" style={{ borderRadius: 24 }}>
        <h2 style={{ marginTop: 0 }}>{date} 예약</h2>

        <div style={{ display: "grid", gap: 12 }}>
          {rows.map((r) => (
            <div
              key={r.event_id}
              style={{
                background: "#111827",
                borderRadius: 18,
                padding: 16,
                borderLeft: `6px solid ${
                  r.event_type === "NAVER" ? "#2ee59d" : "#5da9ff"
                }`,
              }}
            >
              <div style={{ fontSize: 22, fontWeight: 900 }}>
                {r.start_datetime?.slice(11, 16)} {r.customer_name || r.title}
              </div>

              <div style={{ color: "#aaa", marginTop: 6 }}>
                {r.branch_name} / {r.event_type} / {r.status}
              </div>

              <div style={{ color: "#888", marginTop: 6 }}>
                {r.phone || "-"}
              </div>

              {r.memo && (
                <div
                  style={{
                    marginTop: 10,
                    color: "#777",
                    fontSize: 13,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {String(r.memo).slice(0, 300)}
                </div>
              )}
            </div>
          ))}

          {rows.length === 0 && (
            <div style={{ color: "#888" }}>
              예약이 없습니다.
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}