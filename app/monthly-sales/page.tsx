"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { apiFetch } from "@/lib/api";

const DAYS = ["일", "월", "화", "수", "목", "금", "토"];
const METHOD_LABEL: Record<string, string> = { CASH: "현금", CARD: "카드", TRANSFER: "계좌이체" };

const now = new Date();

export default function MonthlySalesPage() {
  const [user, setUser] = useState<any>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [branch, setBranch] = useState("전체");
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [rows, setRows] = useState<any[]>([]);
  const [loadErr, setLoadErr] = useState("");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const isAdminOrOwner = user?.role === "ADMIN" || user?.role === "OWNER";

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem("user") || "null");
    setUser(u);
    if (u && !isAdminOrOwnerRole(u.role)) setBranch(u.branch_name || "전체");
    apiFetch("/api/settings?option_type=BRANCH").then(r => r.json()).then(d => {
      setBranches(d.rows || []);
    });
  }, []);

  const isAdminOrOwnerRole = (role: string) => role === "ADMIN" || role === "OWNER";

  const load = async () => {
    setLoading(true);
    setLoadErr("");
    try {
      let url = `/api/monthly-sales?year=${year}&month=${month}`;
      if (branch !== "전체") url += `&branch_name=${encodeURIComponent(branch)}`;
      const res = await apiFetch(url);
      const json = await res.json();
      if (!json.success) {
        setLoadErr(JSON.stringify(json.error || json.message || "API 오류"));
        setRows([]);
      } else {
        setRows(json.rows || []);
      }
    } catch (e: any) {
      setLoadErr(String(e));
      setRows([]);
    }
    setLoading(false);
    setSelectedDate(null);
    setDetail(null);
  };

  useEffect(() => {
    if (user) load();
  }, [branch, year, month, user]);

  const loadDetail = async (date: string) => {
    setSelectedDate(date);
    let url = `/api/daily-sales-detail?date=${date}`;
    if (branch !== "전체") url += `&branch_name=${encodeURIComponent(branch)}`;
    const res = await apiFetch(url);
    const json = await res.json();
    setDetail(json);
  };

  const fmt = (n: number) => Number(n || 0).toLocaleString();
  const totalCash = rows.reduce((s, r) => s + Number(r.cash_amount || 0), 0);
  const totalCard = rows.reduce((s, r) => s + Number(r.card_amount || 0), 0);
  const totalTransfer = rows.reduce((s, r) => s + Number(r.transfer_amount || 0), 0);
  const totalAmount = rows.reduce((s, r) => s + Number(r.total_amount || 0), 0);

  return (
    <AppShell title="월별매출">
      {/* 필터 */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          {isAdminOrOwner ? (
            <select className="input" value={branch} onChange={e => setBranch(e.target.value)} style={{ width: 140 }}>
              <option>전체</option>
              {branches.map(b => <option key={b.option_id}>{b.option_name}</option>)}
            </select>
          ) : (
            <div className="input" style={{ width: 140, color: "#94a3b8" }}>{user?.branch_name}</div>
          )}
          <select className="input" value={year} onChange={e => setYear(e.target.value)} style={{ width: 100 }}>
            {[2024, 2025, 2026, 2027].map(y => <option key={y}>{y}</option>)}
          </select>
          <select className="input" value={month} onChange={e => setMonth(e.target.value)} style={{ width: 80 }}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <option key={m} value={m}>{m}월</option>
            ))}
          </select>
          <button className="btn" onClick={load}>조회</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: selectedDate ? "1fr 1fr" : "1fr", gap: 16 }}>
        {/* 월별 테이블 */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", fontWeight: 700, fontSize: 15 }}>
            {year}년 {month}월 매출
          </div>

          {/* 요약 */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 0, borderBottom: "1px solid var(--border)" }}>
            {[
              { label: "현금", value: fmt(totalCash), color: "#22c55e" },
              { label: "카드", value: fmt(totalCard), color: "#3b82f6" },
              { label: "계좌이체", value: fmt(totalTransfer), color: "#8b5cf6" },
              { label: "총매출", value: fmt(totalAmount), color: "#f59e0b" },
            ].map(c => (
              <div key={c.label} style={{ padding: "10px 14px", borderRight: "1px solid var(--border)", textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>{c.label}</div>
                <div style={{ fontWeight: 900, fontSize: 15, color: c.color }}>{c.value}</div>
              </div>
            ))}
          </div>

          {/* 테이블 */}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ background: "var(--panel2)" }}>
                  <th style={th}>일</th>
                  <th style={th}>요일</th>
                  <th style={th}>현금</th>
                  <th style={th}>카드</th>
                  <th style={th}>계좌</th>
                  <th style={th}>총매출</th>
                  <th style={th}>건수</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} style={{ textAlign: "center", padding: 24, color: "var(--muted)" }}>로딩중...</td></tr>
                ) : loadErr ? (
                  <tr><td colSpan={7} style={{ textAlign: "center", padding: 24, color: "#ef4444", fontSize: 13 }}>조회 실패: {loadErr}</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: "center", padding: 24, color: "var(--muted)" }}>해당 월에 결제 내역이 없습니다.</td></tr>
                ) : rows.map(r => {
                  const day = Number(r.sale_day);
                  const dow = Number(r.dow) - 1; // MySQL: 1=일,2=월... → 0=일,1=월...
                  const dateStr = r.sale_date;
                  const isSelected = selectedDate === dateStr;
                  return (
                    <tr
                      key={dateStr}
                      onClick={() => loadDetail(dateStr)}
                      style={{
                        cursor: "pointer",
                        background: isSelected ? "rgba(59,130,246,0.12)" : undefined,
                        borderBottom: "1px solid var(--border)",
                      }}
                      onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = "var(--panel2)"; }}
                      onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = ""; }}
                    >
                      <td style={{ ...td, fontWeight: 700, color: isSelected ? "#3b82f6" : undefined }}>{day}일</td>
                      <td style={{ ...td, color: dow === 0 ? "#ef4444" : dow === 6 ? "#3b82f6" : undefined }}>{DAYS[dow] ?? ""}</td>
                      <td style={td}>{Number(r.cash_amount) > 0 ? fmt(r.cash_amount) : "-"}</td>
                      <td style={td}>{Number(r.card_amount) > 0 ? fmt(r.card_amount) : "-"}</td>
                      <td style={td}>{Number(r.transfer_amount) > 0 ? fmt(r.transfer_amount) : "-"}</td>
                      <td style={{ ...td, fontWeight: 900, color: "#f59e0b" }}>{fmt(r.total_amount)}</td>
                      <td style={{ ...td, color: "var(--muted)" }}>{r.count}건</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 일별 상세 */}
        {selectedDate && detail && (
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", fontWeight: 700, fontSize: 15, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>{selectedDate} 일별 상세</span>
              <button onClick={() => { setSelectedDate(null); setDetail(null); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 18 }}>✕</button>
            </div>

            {/* 요약 */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 0, borderBottom: "1px solid var(--border)" }}>
              {[
                { label: "현금", value: fmt(detail.summary?.cash), color: "#22c55e" },
                { label: "카드", value: fmt(detail.summary?.card), color: "#3b82f6" },
                { label: "계좌", value: fmt(detail.summary?.transfer), color: "#8b5cf6" },
                { label: "총매출", value: fmt(detail.summary?.total), color: "#f59e0b" },
              ].map(c => (
                <div key={c.label} style={{ padding: "10px 14px", borderRight: "1px solid var(--border)", textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>{c.label}</div>
                  <div style={{ fontWeight: 900, fontSize: 15, color: c.color }}>{c.value}</div>
                </div>
              ))}
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "var(--panel2)" }}>
                    <th style={th}>회원</th>
                    <th style={th}>상품</th>
                    <th style={th}>결제</th>
                    <th style={th}>금액</th>
                    {isAdminOrOwner && <th style={th}>시각</th>}
                    <th style={th}>메모</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.rows?.length === 0 ? (
                    <tr><td colSpan={isAdminOrOwner ? 6 : 5} style={{ textAlign: "center", padding: 24, color: "var(--muted)" }}>내역 없음</td></tr>
                  ) : detail.rows?.map((r: any) => (
                    <tr key={r.payment_id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ ...td, fontWeight: 700 }}>
                      {branch === "전체" && r.branch_name && (
                        <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 500, marginRight: 4 }}>
                          [{r.branch_name.replace("점", "")}]
                        </span>
                      )}
                      {r.member_name || "-"}
                      {Number(r.payment_count || 0) >= 2 && (
                        <span style={{ marginLeft: 4, fontSize: 10, color: "#2563eb", fontWeight: 700 }}>(재)</span>
                      )}
                    </td>
                      <td style={td}>{r.product_name || "-"}</td>
                      <td style={td}>
                        <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 12, fontWeight: 700,
                          background: r.payment_method === "CARD" ? "#dbeafe" : r.payment_method === "CASH" ? "#dcfce7" : "#ede9fe",
                          color: r.payment_method === "CARD" ? "#1d4ed8" : r.payment_method === "CASH" ? "#15803d" : "#7c3aed",
                        }}>
                          {METHOD_LABEL[r.payment_method] || r.payment_method}
                        </span>
                      </td>
                      <td style={{ ...td, fontWeight: 900, color: "#f59e0b" }}>{fmt(r.final_amount)}</td>
                      {isAdminOrOwner && (
                        <td style={{ ...td, color: "#475569", fontSize: 12, whiteSpace: "nowrap" as const }}>
                          {r.created_at ? String(r.created_at).slice(11, 16) : "-"}
                        </td>
                      )}
                      <td style={{ ...td, color: "var(--muted)", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.memo || ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

const th: React.CSSProperties = {
  padding: "10px 12px",
  textAlign: "left",
  fontSize: 12,
  fontWeight: 600,
  color: "var(--muted)",
  borderBottom: "1px solid var(--border)",
};

const td: React.CSSProperties = {
  padding: "10px 12px",
  verticalAlign: "middle",
};
