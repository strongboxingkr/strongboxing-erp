"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { apiFetch } from "@/lib/api";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

const now = new Date();
const thisYear = now.getFullYear();
const thisMonth = now.getMonth() + 1;

const BRANCH_COLORS: Record<string, string> = {
  "개봉점": "#3b82f6",
  "신정점": "#22c55e",
  "목동점": "#f59e0b",
  "철산점": "#ec4899",
  "영등포점": "#8b5cf6",
};

export default function SalesReportPage() {
  const [branches, setBranches] = useState<any[]>([]);
  const [branch, setBranch] = useState("전체");
  const [year, setYear] = useState(String(thisYear));
  const [month, setMonth] = useState(String(thisMonth));
  const [rows, setRows] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadBranch, setUploadBranch] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const isAdminOrOwner = user?.role === "ADMIN" || user?.role === "OWNER";

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem("user") || "null");
    setUser(u);
    apiFetch("/api/settings?option_type=BRANCH").then(r => r.json()).then(d => {
      setBranches(d.rows || []);
      if (d.rows?.length) setUploadBranch(d.rows[0].option_name);
    });
  }, []);

  const load = async () => {
    let url = `/api/daily-sales?year=${year}&month=${month}`;
    if (branch !== "전체") url += `&branch_name=${encodeURIComponent(branch)}`;
    const res = await apiFetch(url);
    const json = await res.json();
    setRows(json.rows || []);
  };

  useEffect(() => {
    if (user) load();
  }, [branch, year, month, user]);

  const upload = async () => {
    if (!file || !uploadBranch) return alert("지점과 파일을 선택해주세요.");
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("branch_name", uploadBranch);
    const res = await apiFetch("/api/daily-sales/upload", { method: "POST", body: fd });
    const json = await res.json();
    setUploading(false);
    if (json.success) {
      alert(`업로드 완료 (${json.inserted}건 저장)`);
      setFile(null);
      load();
    } else {
      alert(json.error || "업로드 실패");
    }
  };

  // 요약
  const totalCash = rows.reduce((s, r) => s + (r.cash_amount || 0), 0);
  const totalCard = rows.reduce((s, r) => s + (r.card_amount || 0), 0);
  const totalSales = rows.reduce((s, r) => s + (r.total_amount || 0), 0);
  const totalExpense = rows.reduce((s, r) => s + (r.expense_amount || 0), 0);
  const totalNet = rows.reduce((s, r) => s + (r.net_amount || 0), 0);

  // 지점별 집계
  const branchMap: Record<string, any> = {};
  for (const r of rows) {
    if (!branchMap[r.branch_name]) branchMap[r.branch_name] = { branch_name: r.branch_name, total_amount: 0, net_amount: 0 };
    branchMap[r.branch_name].total_amount += r.total_amount || 0;
    branchMap[r.branch_name].net_amount += r.net_amount || 0;
  }
  const branchSummary = Object.values(branchMap);

  // 차트 데이터 (일별)
  const chartData = [...rows].reverse().map(r => ({
    date: r.sale_date?.slice(5),
    현금: r.cash_amount,
    카드: r.card_amount,
    순수익: r.net_amount,
  }));

  const fmt = (n: number) => n.toLocaleString() + "원";

  return (
    <AppShell title="매출 현황">
      {/* 엑셀 업로드 */}
      {isAdminOrOwner && (
        <div className="card" style={{ marginBottom: 18 }}>
          <h2 style={{ marginTop: 0 }}>이지스포 엑셀 업로드</h2>
          <div style={{ display: "grid", gridTemplateColumns: "180px 1fr auto", gap: 12, alignItems: "center" }}>
            <select className="input" value={uploadBranch} onChange={e => setUploadBranch(e.target.value)}>
              {branches.map(b => <option key={b.option_id}>{b.option_name}</option>)}
            </select>
            <input className="input" type="file" accept=".xlsx,.xls" onChange={e => setFile(e.target.files?.[0] || null)} />
            <button className="btn" onClick={upload} disabled={uploading}>
              {uploading ? "업로드 중..." : "업로드"}
            </button>
          </div>
        </div>
      )}

      {/* 조회 필터 */}
      <div className="card" style={{ marginBottom: 18 }}>
        <div style={{ display: "grid", gridTemplateColumns: "160px 120px 120px auto", gap: 12, alignItems: "center" }}>
          {isAdminOrOwner ? (
            <select className="input" value={branch} onChange={e => setBranch(e.target.value)}>
              <option>전체</option>
              {branches.map(b => <option key={b.option_id}>{b.option_name}</option>)}
            </select>
          ) : (
            <div className="input" style={{ color: "#94a3b8" }}>{user?.branch_name}</div>
          )}
          <select className="input" value={year} onChange={e => setYear(e.target.value)}>
            {[2024, 2025, 2026, 2027].map(y => <option key={y}>{y}</option>)}
          </select>
          <select className="input" value={month} onChange={e => setMonth(e.target.value)}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <option key={m} value={m}>{m}월</option>
            ))}
          </select>
          <button className="btn" onClick={load}>조회</button>
        </div>
      </div>

      {/* 요약 카드 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 18 }}>
        {[
          { label: "총매출", value: fmt(totalSales), color: "#3b82f6" },
          { label: "현금", value: fmt(totalCash), color: "#22c55e" },
          { label: "카드", value: fmt(totalCard), color: "#f59e0b" },
          { label: "지출", value: fmt(totalExpense), color: "#ef4444" },
          { label: "순수익", value: fmt(totalNet), color: "#8b5cf6" },
        ].map(c => (
          <div key={c.label} className="card" style={{ textAlign: "center" }}>
            <div style={{ color: "#94a3b8", fontSize: 13, marginBottom: 6 }}>{c.label}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 18 }}>
        {/* 지점별 요약 */}
        {isAdminOrOwner && (
          <div className="card">
            <h2 style={{ marginTop: 0 }}>지점별 매출</h2>
            <table>
              <thead>
                <tr>
                  <th>지점</th>
                  <th>총매출</th>
                  <th>순수익</th>
                </tr>
              </thead>
              <tbody>
                {branchSummary.map(b => (
                  <tr key={b.branch_name}>
                    <td>
                      <span style={{ padding: "4px 10px", borderRadius: 8, background: `${BRANCH_COLORS[b.branch_name] || "#94a3b8"}22`, color: BRANCH_COLORS[b.branch_name] || "#94a3b8", fontWeight: 900, borderLeft: `3px solid ${BRANCH_COLORS[b.branch_name] || "#94a3b8"}` }}>
                        {b.branch_name}
                      </span>
                    </td>
                    <td style={{ fontWeight: 900 }}>{b.total_amount.toLocaleString()}원</td>
                    <td style={{ color: "#22c55e", fontWeight: 900 }}>{b.net_amount.toLocaleString()}원</td>
                  </tr>
                ))}
                {branchSummary.length === 0 && <tr><td colSpan={3} style={{ textAlign: "center", color: "#4b5563" }}>데이터 없음</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {/* 차트 */}
        <div className="card">
          <h2 style={{ marginTop: 0 }}>일별 매출 추이</h2>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData}>
                <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={v => `${(v / 10000).toFixed(0)}만`} />
                <Tooltip formatter={(v: any) => v.toLocaleString() + "원"} contentStyle={{ background: "var(--panel2)", border: "none" }} />
                <Legend />
                <Bar dataKey="현금" fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="카드" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="순수익" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ textAlign: "center", color: "#4b5563", padding: 40 }}>데이터 없음</div>
          )}
        </div>
      </div>

      {/* 일별 상세 */}
      <div className="card">
        <h2 style={{ marginTop: 0 }}>{year}년 {month}월 일별 상세</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>날짜</th>
                <th>지점</th>
                <th>현금</th>
                <th>카드</th>
                <th>미수</th>
                <th>총매출</th>
                <th>지출</th>
                <th>순수익</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td style={{ whiteSpace: "nowrap", fontWeight: 900 }}>{r.sale_date?.slice(0, 10)}</td>
                  <td>
                    <span style={{ padding: "3px 8px", borderRadius: 6, background: `${BRANCH_COLORS[r.branch_name] || "#94a3b8"}22`, color: BRANCH_COLORS[r.branch_name] || "#94a3b8", fontWeight: 900 }}>
                      {r.branch_name}
                    </span>
                  </td>
                  <td>{(r.cash_amount || 0).toLocaleString()}</td>
                  <td>{(r.card_amount || 0).toLocaleString()}</td>
                  <td>{(r.unpaid_amount || 0).toLocaleString()}</td>
                  <td style={{ fontWeight: 900 }}>{(r.total_amount || 0).toLocaleString()}</td>
                  <td style={{ color: "#ef4444" }}>{(r.expense_amount || 0).toLocaleString()}</td>
                  <td style={{ color: "#22c55e", fontWeight: 900 }}>{(r.net_amount || 0).toLocaleString()}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: "center", color: "#4b5563", padding: 24 }}>데이터 없음</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
