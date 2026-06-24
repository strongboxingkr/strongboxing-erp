"use client";

import { useEffect, useRef, useState } from "react";
import AppShell from "@/components/AppShell";
import { apiFetch } from "@/lib/api";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const SOURCE_LABELS: Record<string, string> = {
  NAVER_AD: "네이버 검색광고",
  NAVER_PLACE: "네이버 플레이스",
  NAVER_RESERVATION: "네이버 예약",
  WEBSITE: "홈페이지",
  INSTAGRAM_AD: "인스타그램 광고",
  FACEBOOK_AD: "페이스북 광고",
  DANGGEUN: "당근 광고",
  KAKAOMAP: "카카오맵",
  REFERRAL: "지인소개",
  WALK_IN: "지나가다 방문",
  OTHER: "기타",
};

const ALL_SOURCES = Object.keys(SOURCE_LABELS);

function safe(n: number, d: number, pct = false) {
  if (d === 0) return "-";
  const v = n / d;
  return pct ? (v * 100).toFixed(1) + "%" : Math.round(v).toLocaleString();
}

function num(v: number) {
  return v.toLocaleString();
}

type Row = {
  report_id: number;
  branch_name: string;
  report_date: string;
  lead_source: string;
  ad_cost: number;
  impressions: number;
  clicks: number;
  inquiries: number;
  reservations: number;
  registrations: number;
  revenue: number;
};

function aggregate(rows: Row[]) {
  return rows.reduce(
    (acc, r) => ({
      ad_cost: acc.ad_cost + r.ad_cost,
      impressions: acc.impressions + r.impressions,
      clicks: acc.clicks + r.clicks,
      inquiries: acc.inquiries + r.inquiries,
      reservations: acc.reservations + r.reservations,
      registrations: acc.registrations + r.registrations,
      revenue: acc.revenue + r.revenue,
    }),
    { ad_cost: 0, impressions: 0, clicks: 0, inquiries: 0, reservations: 0, registrations: 0, revenue: 0 }
  );
}

export default function MarketingPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);

  const [branch, setBranch] = useState("전체");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const isAdminOrOwner = user?.role === "ADMIN" || user?.role === "OWNER";

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem("user") || "null");
    setUser(u);
    apiFetch("/api/settings?option_type=BRANCH")
      .then((r) => r.json())
      .then((d) => setBranches(d.rows || []));
  }, []);

  const load = async () => {
    let url = "/api/marketing?";
    if (isAdminOrOwner && branch !== "전체") url += `branch_name=${encodeURIComponent(branch)}&`;
    if (startDate) url += `start_date=${startDate}&`;
    if (endDate) url += `end_date=${endDate}&`;
    const res = await apiFetch(url);
    const data = await res.json();
    setRows(data.rows || []);
  };

  useEffect(() => {
    if (user) load();
  }, [user, branch, startDate, endDate]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await apiFetch("/api/marketing/upload", { method: "POST", body: fd });
    const data = await res.json();
    setUploading(false);
    if (data.success) {
      alert(`업로드 완료! 처리: ${data.inserted}건, 건너뜀: ${data.skipped}건`);
      load();
    } else {
      alert(data.message || "업로드 실패");
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleDownload = () => {
    let url = "/api/marketing/download?";
    if (isAdminOrOwner && branch !== "전체") url += `branch_name=${encodeURIComponent(branch)}&`;
    if (startDate) url += `start_date=${startDate}&`;
    if (endDate) url += `end_date=${endDate}&`;
    window.open(url);
  };

  const handleTemplate = () => {
    window.open("/api/marketing/template");
  };

  const total = aggregate(rows);

  // 유입경로별 집계
  const bySource = ALL_SOURCES.map((src) => {
    const srcRows = rows.filter((r) => r.lead_source === src);
    if (srcRows.length === 0) return null;
    const a = aggregate(srcRows);
    return { src, label: SOURCE_LABELS[src], ...a };
  }).filter(Boolean) as any[];

  bySource.sort((a, b) => b.registrations - a.registrations);

  // 지점별 집계
  const branchNames = [...new Set(rows.map((r) => r.branch_name))];
  const byBranch = branchNames.map((bn) => {
    const a = aggregate(rows.filter((r) => r.branch_name === bn));
    return { branch: bn, ...a };
  });

  // 월별 집계
  const monthMap: Record<string, { inquiries: number; registrations: number }> = {};
  for (const r of rows) {
    const m = r.report_date?.slice(0, 7) || "알수없음";
    if (!monthMap[m]) monthMap[m] = { inquiries: 0, registrations: 0 };
    monthMap[m].inquiries += r.inquiries;
    monthMap[m].registrations += r.registrations;
  }
  const monthlyData = Object.entries(monthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({ month, ...v }));

  // TOP 5
  const top5 = [...bySource].sort((a, b) => {
    const rA = a.inquiries > 0 ? a.registrations / a.inquiries : 0;
    const rB = b.inquiries > 0 ? b.registrations / b.inquiries : 0;
    return rB - rA;
  }).slice(0, 5);

  return (
    <AppShell title="마케팅 분석">
      {/* 헤더 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 900 }}>마케팅 분석</h1>
          <p style={{ color: "#aaa", marginTop: 6 }}>유입경로별 광고 성과 및 전환율 분석</p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="btn secondary" onClick={handleTemplate}>양식 다운로드</button>
          <button className="btn secondary" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? "업로드 중..." : "엑셀 업로드"}
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={handleUpload} />
          <button className="btn" onClick={handleDownload}>엑셀 다운로드</button>
        </div>
      </div>

      {/* 필터 */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
          {isAdminOrOwner ? (
            <select className="input" value={branch} onChange={(e) => setBranch(e.target.value)}>
              <option>전체</option>
              {branches.map((b) => <option key={b.option_id}>{b.option_name}</option>)}
            </select>
          ) : (
            <div className="input" style={{ color: "#aaa" }}>{user?.branch_name}</div>
          )}
          <input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <input className="input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          <button className="btn secondary" onClick={() => { setStartDate(""); setEndDate(""); setBranch("전체"); }}>
            초기화
          </button>
        </div>
      </div>

      {/* 총합 카드 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 14, marginBottom: 24 }}>
        {[
          ["총 광고비", `${num(total.ad_cost)}원`, "#f59e0b"],
          ["총 노출수", num(total.impressions), "#3b82f6"],
          ["총 클릭수", num(total.clicks), "#8b5cf6"],
          ["총 문의수", num(total.inquiries), "#22c55e"],
          ["총 예약수", num(total.reservations), "#06b6d4"],
          ["총 등록수", num(total.registrations), "#f97316"],
          ["전환율", safe(total.registrations, total.inquiries, true), "#ec4899"],
          ["ROAS", safe(total.revenue, total.ad_cost), "#a3e635"],
        ].map(([label, value, color]) => (
          <div key={label} className="card" style={{ textAlign: "center" }}>
            <div style={{ color: "#94a3b8", fontSize: 13, fontWeight: 700 }}>{label}</div>
            <div style={{ color: color as string, fontSize: 26, fontWeight: 900, marginTop: 6 }}>{value}</div>
          </div>
        ))}
      </div>

      {/* 유입경로별 표 */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h2 style={{ marginTop: 0 }}>유입경로별 성과</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>유입경로</th>
                <th>광고비</th>
                <th>노출수</th>
                <th>클릭수</th>
                <th>CTR</th>
                <th>CPC</th>
                <th>문의수</th>
                <th>CPL</th>
                <th>예약수</th>
                <th>등록수</th>
                <th>CAC</th>
                <th>전환율</th>
                <th>매출</th>
                <th>ROAS</th>
              </tr>
            </thead>
            <tbody>
              {bySource.map((s) => (
                <tr key={s.src}>
                  <td style={{ fontWeight: 900 }}>{s.label}</td>
                  <td>{num(s.ad_cost)}원</td>
                  <td>{num(s.impressions)}</td>
                  <td>{num(s.clicks)}</td>
                  <td>{safe(s.clicks, s.impressions, true)}</td>
                  <td>{safe(s.ad_cost, s.clicks)}</td>
                  <td style={{ color: "#22c55e", fontWeight: 900 }}>{num(s.inquiries)}</td>
                  <td>{safe(s.ad_cost, s.inquiries)}</td>
                  <td>{num(s.reservations)}</td>
                  <td style={{ color: "#f97316", fontWeight: 900 }}>{num(s.registrations)}</td>
                  <td>{safe(s.ad_cost, s.registrations)}</td>
                  <td style={{ color: "#ec4899", fontWeight: 900 }}>{safe(s.registrations, s.inquiries, true)}</td>
                  <td>{num(s.revenue)}원</td>
                  <td style={{ color: "#a3e635", fontWeight: 900 }}>{safe(s.revenue, s.ad_cost)}</td>
                </tr>
              ))}
              {bySource.length === 0 && (
                <tr><td colSpan={14} style={{ textAlign: "center", color: "#aaa" }}>데이터가 없습니다.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 지점별 표 */}
      {isAdminOrOwner && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h2 style={{ marginTop: 0 }}>지점별 성과</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>지점</th>
                  <th>광고비</th>
                  <th>문의수</th>
                  <th>예약수</th>
                  <th>등록수</th>
                  <th>전환율</th>
                  <th>매출</th>
                  <th>ROAS</th>
                </tr>
              </thead>
              <tbody>
                {byBranch.map((b) => (
                  <tr key={b.branch}>
                    <td style={{ fontWeight: 900, color: "#3b82f6" }}>{b.branch}</td>
                    <td>{num(b.ad_cost)}원</td>
                    <td style={{ color: "#22c55e", fontWeight: 900 }}>{num(b.inquiries)}</td>
                    <td>{num(b.reservations)}</td>
                    <td style={{ color: "#f97316", fontWeight: 900 }}>{num(b.registrations)}</td>
                    <td style={{ color: "#ec4899", fontWeight: 900 }}>{safe(b.registrations, b.inquiries, true)}</td>
                    <td>{num(b.revenue)}원</td>
                    <td style={{ color: "#a3e635", fontWeight: 900 }}>{safe(b.revenue, b.ad_cost)}</td>
                  </tr>
                ))}
                {byBranch.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: "center", color: "#aaa" }}>데이터가 없습니다.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 월별 그래프 */}
      {monthlyData.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h2 style={{ marginTop: 0 }}>월별 문의/등록 추이</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#273244" />
              <XAxis dataKey="month" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip contentStyle={{ background: "var(--panel2)", border: "1px solid #273244", borderRadius: 12 }} />
              <Legend />
              <Bar dataKey="inquiries" name="문의수" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="registrations" name="등록수" fill="#f97316" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* TOP 5 */}
      {top5.length > 0 && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>전환율 TOP 5 유입경로</h2>
          <div style={{ display: "grid", gap: 12 }}>
            {top5.map((s, i) => {
              const rate = s.inquiries > 0 ? (s.registrations / s.inquiries) * 100 : 0;
              return (
                <div key={s.src} style={{ display: "flex", alignItems: "center", gap: 16, background: "var(--panel2)", borderRadius: 14, padding: "14px 18px" }}>
                  <div style={{ fontSize: 28, fontWeight: 900, color: i === 0 ? "#f59e0b" : i === 1 ? "#94a3b8" : i === 2 ? "#b45309" : "#4b5563", minWidth: 32 }}>
                    #{i + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 900, fontSize: 16 }}>{s.label}</div>
                    <div style={{ color: "#94a3b8", fontSize: 13, marginTop: 2 }}>
                      문의 {num(s.inquiries)} → 등록 {num(s.registrations)}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 24, fontWeight: 900, color: "#ec4899" }}>{rate.toFixed(1)}%</div>
                    <div style={{ color: "#94a3b8", fontSize: 12 }}>전환율</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </AppShell>
  );
}
