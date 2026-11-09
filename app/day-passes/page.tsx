"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { apiFetch } from "@/lib/api";

const STATUS_LABEL: Record<string, string> = { PENDING: "미사용", USED: "사용됨", CANCELLED: "취소됨" };
const STATUS_COLOR: Record<string, string> = { PENDING: "#16a34a", USED: "#6B7280", CANCELLED: "#dc2626" };

export default function DayPassesPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState(() => new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10));
  const [filterBranch, setFilterBranch] = useState("");
  const [branches, setBranches] = useState<any[]>([]);

  useEffect(() => {
    apiFetch("/api/settings?option_type=BRANCH")
      .then(r => r.json())
      .then(d => setBranches(d.rows || []));
  }, []);

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterDate) params.set("use_date", filterDate);
    if (filterBranch) params.set("branch_name", filterBranch);
    const res = await apiFetch(`/api/day-passes?${params.toString()}`);
    const data = await res.json();
    setRows(data.rows || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [filterDate, filterBranch]);

  const pending = rows.filter(r => r.status === "PENDING" && !r.is_expired);
  const used = rows.filter(r => r.status === "USED");
  const cancelled = rows.filter(r => r.status === "CANCELLED");
  const expired = rows.filter(r => r.is_expired);

  return (
    <AppShell title="회원 일일권 현황">
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 0 32px" }}>
        <div style={{ background: "var(--panel2)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 16px", marginBottom: 16, fontSize: 13, color: "var(--muted)" }}>
          이 화면은 <strong>회원</strong>의 일일권 사용 현황입니다. 비회원 결제는 <strong>결제관리</strong> 목록에서 확인하세요.
        </div>
        <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
          <input
            type="date"
            className="input"
            style={{ width: 160 }}
            value={filterDate}
            onChange={e => setFilterDate(e.target.value)}
          />
          <select
            className="input"
            style={{ width: 160 }}
            value={filterBranch}
            onChange={e => setFilterBranch(e.target.value)}
          >
            <option value="">전체 지점</option>
            {branches.map((b: any) => (
              <option key={b.option_id} value={b.option_name}>{b.option_name}</option>
            ))}
          </select>
          <button className="btn secondary" onClick={load}>새로고침</button>
        </div>

        {/* 요약 */}
        <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          {[
            { label: "미사용", count: pending.length, color: "#16a34a" },
            { label: "사용됨", count: used.length, color: "#6B7280" },
            { label: "취소됨", count: cancelled.length, color: "#dc2626" },
            { label: "기간만료", count: expired.length, color: "#d97706" },
          ].map(s => (
            <div key={s.label} className="card" style={{ padding: "10px 20px", textAlign: "center", minWidth: 90 }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: s.color }}>{s.count}</div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>{s.label}</div>
            </div>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>불러오는 중...</div>
        ) : rows.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>
            해당 날짜의 일일권이 없습니다.
          </div>
        ) : (
          <div className="card" style={{ overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th style={th}>입장코드</th>
                  <th style={th}>이용일</th>
                  <th style={th}>지점</th>
                  <th style={th}>상태</th>
                  <th style={th}>이름</th>
                  <th style={th}>연락처</th>
                  <th style={th}>상품</th>
                  <th style={th}>결제금액</th>
                  <th style={th}>결제방법</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.pass_id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ ...td, fontFamily: "monospace", fontSize: 20, fontWeight: 900, letterSpacing: 4, color: r.status === "PENDING" && !r.is_expired ? "#111" : "var(--muted)" }}>
                      {r.pass_code ?? "—"}
                    </td>
                    <td style={td}>{String(r.use_date).slice(0, 10)}</td>
                    <td style={td}>{r.branch_name}</td>
                    <td style={{ ...td }}>
                      <span style={{ color: r.is_expired ? "#d97706" : STATUS_COLOR[r.status], fontWeight: 700 }}>
                        {r.is_expired ? "기간만료" : STATUS_LABEL[r.status]}
                      </span>
                    </td>
                    <td style={td}>{r.guest_name || (r.member_id ? `회원#${r.member_id}` : "—")}</td>
                    <td style={td}>{r.guest_phone || "—"}</td>
                    <td style={td}>{r.product_name || "—"}</td>
                    <td style={td}>{r.final_amount != null ? `${Number(r.final_amount).toLocaleString()}원` : "—"}</td>
                    <td style={td}>{r.payment_method || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}

const th: React.CSSProperties = { padding: "10px 12px", textAlign: "left", fontWeight: 700, whiteSpace: "nowrap", color: "var(--muted)", fontSize: 13 };
const td: React.CSSProperties = { padding: "10px 12px", whiteSpace: "nowrap" };
