"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

const DAYS = ["일", "월", "화", "수", "목", "금", "토"];
const METHOD_LABEL: Record<string, string> = { CASH: "현금", CARD: "카드", TRANSFER: "계좌" };
const METHOD_COLOR: Record<string, { bg: string; color: string }> = {
  CARD: { bg: "#dbeafe", color: "#1d4ed8" },
  CASH: { bg: "#dcfce7", color: "#15803d" },
  TRANSFER: { bg: "#ede9fe", color: "#7c3aed" },
};

const now = new Date();

export default function MobileMonthlySalesPage() {
  const [user, setUser] = useState<any>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [branch, setBranch] = useState("전체");
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const isAdminOrOwner = user?.role === "ADMIN" || user?.role === "OWNER";

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem("user") || "null");
    setUser(u);
    if (u && u.role !== "ADMIN" && u.role !== "OWNER") setBranch(u.branch_name || "전체");
    apiFetch("/api/settings?option_type=BRANCH").then(r => r.json()).then(d => setBranches(d.rows || []));
  }, []);

  const load = async () => {
    setLoading(true);
    let url = `/api/monthly-sales?year=${year}&month=${month}`;
    if (branch !== "전체") url += `&branch_name=${encodeURIComponent(branch)}`;
    const res = await apiFetch(url);
    const json = await res.json();
    setRows(json.rows || []);
    setLoading(false);
    setSelectedDate(null);
    setDetail(null);
  };

  useEffect(() => { if (user) load(); }, [branch, year, month, user]);

  const loadDetail = async (date: string) => {
    if (selectedDate === date) { setSelectedDate(null); setDetail(null); return; }
    setSelectedDate(date);
    setDetailLoading(true);
    let url = `/api/daily-sales-detail?date=${date}`;
    if (branch !== "전체") url += `&branch_name=${encodeURIComponent(branch)}`;
    const res = await apiFetch(url);
    const json = await res.json();
    setDetail(json);
    setDetailLoading(false);
  };

  const fmt = (n: number) => Number(n || 0).toLocaleString();
  const totalCash = rows.reduce((s, r) => s + Number(r.cash_amount || 0), 0);
  const totalCard = rows.reduce((s, r) => s + Number(r.card_amount || 0), 0);
  const totalTransfer = rows.reduce((s, r) => s + Number(r.transfer_amount || 0), 0);
  const totalAmount = rows.reduce((s, r) => s + Number(r.total_amount || 0), 0);

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", paddingBottom: 32 }}>
      {/* 헤더 */}
      <div style={{ background: "#1e293b", padding: "16px 20px", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => history.back()} style={{ background: "none", border: "none", color: "#94a3b8", fontSize: 20, cursor: "pointer", padding: 0 }}>←</button>
        <div style={{ color: "#fff", fontWeight: 700, fontSize: 17 }}>월별 매출</div>
      </div>

      {/* 필터 */}
      <div style={{ padding: "14px 16px", background: "#fff", borderBottom: "1px solid #e2e8f0" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {isAdminOrOwner && (
            <select value={branch} onChange={e => setBranch(e.target.value)}
              style={{ flex: 1, minWidth: 80, padding: "8px 10px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, background: "#f8fafc" }}>
              <option>전체</option>
              {branches.map(b => <option key={b.option_id}>{b.option_name}</option>)}
            </select>
          )}
          <select value={year} onChange={e => setYear(e.target.value)}
            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, background: "#f8fafc" }}>
            {[2024, 2025, 2026, 2027].map(y => <option key={y}>{y}</option>)}
          </select>
          <select value={month} onChange={e => setMonth(e.target.value)}
            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, background: "#f8fafc" }}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{m}월</option>)}
          </select>
          <button onClick={load}
            style={{ padding: "8px 18px", borderRadius: 8, background: "#2563eb", color: "#fff", border: "none", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
            조회
          </button>
        </div>
      </div>

      {/* 요약 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, padding: "14px 16px 0" }}>
        {[
          { label: "현금", value: fmt(totalCash), color: "#22c55e" },
          { label: "카드", value: fmt(totalCard), color: "#3b82f6" },
          { label: "계좌이체", value: fmt(totalTransfer), color: "#8b5cf6" },
          { label: "총매출", value: fmt(totalAmount), color: "#f59e0b" },
        ].map(c => (
          <div key={c.label} style={{ background: "#fff", borderRadius: 12, padding: "12px 14px", textAlign: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>{c.label}</div>
            <div style={{ fontWeight: 900, fontSize: 16, color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* 날짜 목록 */}
      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>로딩중...</div>
        ) : rows.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>결제 내역 없음</div>
        ) : rows.map(r => {
          const day = Number(r.sale_day);
          const dow = Number(r.dow) - 1;
          const dateStr = r.sale_date;
          const isSelected = selectedDate === dateStr;

          return (
            <div key={dateStr}>
              {/* 날짜 행 */}
              <div
                onClick={() => loadDetail(dateStr)}
                style={{
                  background: isSelected ? "#eff6ff" : "#fff",
                  borderRadius: isSelected ? "12px 12px 0 0" : 12,
                  padding: "14px 16px",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  cursor: "pointer",
                  border: isSelected ? "1px solid #bfdbfe" : "1px solid transparent",
                  borderBottom: isSelected ? "none" : "1px solid transparent",
                }}>
                <div style={{ textAlign: "center", minWidth: 36 }}>
                  <div style={{ fontWeight: 700, fontSize: 18, color: isSelected ? "#2563eb" : "#1e293b" }}>{day}</div>
                  <div style={{ fontSize: 11, color: dow === 0 ? "#ef4444" : dow === 6 ? "#3b82f6" : "#94a3b8" }}>{DAYS[dow]}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 900, fontSize: 16, color: "#f59e0b" }}>{fmt(r.total_amount)}원</div>
                  <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                    {Number(r.card_amount) > 0 && `카드 ${fmt(r.card_amount)}`}
                    {Number(r.cash_amount) > 0 && ` 현금 ${fmt(r.cash_amount)}`}
                    {Number(r.transfer_amount) > 0 && ` 계좌 ${fmt(r.transfer_amount)}`}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600 }}>{r.count}건</div>
                <div style={{ fontSize: 16, color: "#94a3b8" }}>{isSelected ? "▲" : "▼"}</div>
              </div>

              {/* 상세 (펼침) */}
              {isSelected && (
                <div style={{ background: "#f8fafc", border: "1px solid #bfdbfe", borderTop: "none", borderRadius: "0 0 12px 12px", overflow: "hidden" }}>
                  {detailLoading ? (
                    <div style={{ textAlign: "center", padding: 20, color: "#94a3b8" }}>로딩중...</div>
                  ) : detail?.rows?.length === 0 ? (
                    <div style={{ textAlign: "center", padding: 20, color: "#94a3b8" }}>내역 없음</div>
                  ) : detail?.rows?.map((p: any) => (
                    <div key={p.payment_id} style={{ padding: "12px 16px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                          {branch === "전체" && p.branch_name && (
                            <span style={{ fontSize: 10, color: "#94a3b8" }}>[{p.branch_name.replace("점", "")}]</span>
                          )}
                          <span style={{ fontWeight: 700, fontSize: 14, color: "#1e293b" }}>{p.member_name || "-"}</span>
                          {Number(p.payment_count || 0) >= 2 && (
                            <span style={{ fontSize: 10, color: "#2563eb", fontWeight: 700 }}>(재)</span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: "#64748b" }}>{p.product_name}</div>
                        {p.memo && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{p.memo}</div>}
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontWeight: 900, fontSize: 15, color: "#f59e0b" }}>{fmt(p.final_amount)}원</div>
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginTop: 4, alignItems: "center" }}>
                          <span style={{
                            padding: "2px 7px", borderRadius: 6, fontSize: 11, fontWeight: 700,
                            background: METHOD_COLOR[p.payment_method]?.bg || "#f1f5f9",
                            color: METHOD_COLOR[p.payment_method]?.color || "#64748b",
                          }}>{METHOD_LABEL[p.payment_method] || p.payment_method}</span>
                          {isAdminOrOwner && p.created_at && (
                            <span style={{ fontSize: 11, color: "#94a3b8" }}>{String(p.created_at).slice(11, 16)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
