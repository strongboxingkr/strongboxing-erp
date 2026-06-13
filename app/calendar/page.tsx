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
  const [selected, setSelected] = useState<any>(null);

  const [form, setForm] = useState({
    branch_name: "",
    customer_name: "",
    phone: "",
    start_datetime: "",
    memo: "",
    source_type: "전화문의",
  });

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
    <AppShell title="예약 등록 캘린더">
      <div className="card" style={{ borderRadius: 24, marginBottom: 18 }}>
        <h1 style={{ marginTop: 0 }}>예약 등록 캘린더</h1>

        <div
            style={{
                display: "grid",
                gridTemplateColumns: "repeat(6,1fr)",
                gap: 12,
                marginBottom: 18,
            }}
            >
            <select
                className="input"
                value={form.branch_name}
                onChange={(e) =>
                setForm({ ...form, branch_name: e.target.value })
                }
            >
                <option value="">지점선택</option>
                {branches.map((b) => (
                <option key={b.option_id} value={b.option_name}>
                    {b.option_name}
                </option>
                ))}
            </select>

            <input
                className="input"
                placeholder="이름"
                value={form.customer_name}
                onChange={(e) =>
                setForm({ ...form, customer_name: e.target.value })
                }
            />

            <input
                className="input"
                placeholder="전화번호"
                value={form.phone}
                onChange={(e) =>
                setForm({ ...form, phone: e.target.value })
                }
            />

            <select
              className="input"
              value={form.source_type}
              onChange={(e) =>
                setForm({ ...form, source_type: e.target.value })
              }
            >
              <option value="전화문의">전화문의</option>
              <option value="인스타그램">인스타그램</option>
              <option value="홈페이지">홈페이지</option>
              <option value="카카오톡">카카오톡</option>
              <option value="지인소개">지인소개</option>
              <option value="방문문의">방문문의</option>
              <option value="기타">기타</option>
            </select>

            <input
                className="input"
                type="datetime-local"
                value={form.start_datetime}
                onChange={(e) =>
                setForm({ ...form, start_datetime: e.target.value })
                }
            />

            <button
                className="btn"
                onClick={async () => {
                const res = await apiFetch("/api/calendar-events/add", {
                    method: "POST",
                    body: JSON.stringify({
                    ...form,
                    event_type: form.source_type,
                  }),
                });

                const json = await res.json();

                if (json.success) {
                    alert("예약 등록 완료");

                    setForm({
                      branch_name: "",
                      customer_name: "",
                      phone: "",
                      start_datetime: "",
                      memo: "",
                      source_type: "전화문의",
                    });

                    load();
                } else {
                    alert(json.message || "등록 실패");
                }
                }}
            >
                예약등록
            </button>
            </div>

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
              onClick={() => setSelected(r)}
              style={{
                background: "#111827",
                borderRadius: 18,
                padding: 16,
                borderLeft: `6px solid ${
                  r.event_type === "NAVER"
                    ? "#22c55e"
                    : r.event_type === "전화문의"
                    ? "#3b82f6"
                    : r.event_type === "인스타그램"
                    ? "#ec4899"
                    : r.event_type === "카카오톡"
                    ? "#facc15"
                    : r.event_type === "홈페이지"
                    ? "#8b5cf6"
                    : "#94a3b8"
                }`,
              }}
            >
              <div style={{ fontSize: 22, fontWeight: 900 }}>
                {r.start_datetime?.slice(11, 16)} {r.customer_name || r.title}
              </div>

              <div style={{ color: "#aaa", marginTop: 6 }}>
                {r.branch_name} /{" "}
                  <span
                    style={{
                      padding: "4px 8px",
                      borderRadius: 999,
                      background: "rgba(255,255,255,0.08)",
                      fontWeight: 900,
                    }}
                  >
                    {r.event_type}
                  </span>{" "}
                  / {r.status}
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
      {selected && (
        <div
          onClick={() => setSelected(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            display: "grid",
            placeItems: "center",
            zIndex: 9999,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="card"
            style={{
              width: 500,
              borderRadius: 24,
            }}
          >
            <h2>{selected.customer_name}</h2>

            <div style={{ marginTop: 16 }}>
              <div>지점 : {selected.branch_name}</div>
              <div>연락처 : {selected.phone || "-"}</div>
              <div>예약일시 : {selected.start_datetime?.slice(0,16)}</div>
              <div>출처 : {selected.event_type}</div>
              <div>상태 : {selected.status}</div>
            </div>

            <div style={{ marginTop: 20 }}>
              <div style={{ marginBottom: 8 }}>메모</div>

              <textarea
                className="input"
                value={selected.memo || ""}
                onChange={(e) =>
                  setSelected({
                    ...selected,
                    memo: e.target.value,
                  })
                }
                style={{
                  width: "100%",
                  minHeight: 120,
                  resize: "none",
                }}
              />
            </div>

            <div style={{ marginTop: 20 }}>
              <div>연락처 : {selected.phone || "-"}</div>

              <div style={{ marginTop: 10 }}>
                메모
              </div>

              <textarea
                className="input"
                value={selected.memo || ""}
                readOnly
                style={{
                  width: "100%",
                  minHeight: 120,
                  resize: "none",
                  marginTop: 8,
                }}
              />
            </div>

            <div
                style={{
                  marginTop: 20,
                  display: "flex",
                  gap: 10,
                  justifyContent: "space-between",
                }}
              >
                <button
                  className="btn secondary"
                  onClick={() => setSelected(null)}
                >
                  닫기
                </button>

                <button
                  className="btn"
                  onClick={async () => {
                    const res = await apiFetch("/api/calendar-events/update", {
                      method: "POST",
                      body: JSON.stringify({
                        event_id: selected.event_id,
                        memo: selected.memo,
                      }),
                    });

                    const json = await res.json();

                    if (json.success) {
                      alert("저장 완료");
                      load();
                      setSelected(null);
                    }
                  }}
                >
                  저장
                </button>
              </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}