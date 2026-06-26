"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { apiFetch } from "@/lib/api";

const money = (v: any) => `${Number(v || 0).toLocaleString()}원`;
const today = new Date().toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" });

export default function DirectorDashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [allBranches, setAllBranches] = useState<any[]>([]);
  const [expiring, setExpiring] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("user");
    if (saved) {
      const u = JSON.parse(saved);
      setUser(u);
      loadData(u);
    }
  }, []);

  const loadData = async (u: any) => {
    setLoading(true);
    setError("");
    try {
      const branch = encodeURIComponent(u.branch_name || "");

      const [sumRes, attRes, allAttRes, expRes] = await Promise.all([
        apiFetch(`/api/dashboard/summary`),
        apiFetch(`/api/attendance/live`),
        apiFetch(`/api/attendance/live`),
        apiFetch(`/api/members?status=ACTIVE&expiring=7`),
      ]);

      const [sumJson, attJson, , expJson] = await Promise.all([
        sumRes.json(), attRes.json(), allAttRes.json(), expRes.json(),
      ]);

      setSummary(sumJson.data);
      setAttendance(attJson.rows || []);

      // 전체 지점 출석 집계
      const branchMap: Record<string, number> = {};
      (attJson.rows || []).forEach((r: any) => {
        const b = r.branch_name || "기타";
        branchMap[b] = (branchMap[b] || 0) + 1;
      });
      setAllBranches(Object.entries(branchMap).map(([branch_name, count]) => ({ branch_name, count })).sort((a, b) => b.count - a.count));

      // 만료 임박 (오늘~7일 이내)
      const todayDate = new Date(); todayDate.setHours(0,0,0,0);
      const sevenDays = new Date(todayDate); sevenDays.setDate(sevenDays.getDate() + 7);
      const expRows = (expJson.rows || []).filter((m: any) => {
        if (!m.end_date) return false;
        const end = new Date(m.end_date); end.setHours(0,0,0,0);
        return end >= todayDate && end <= sevenDays;
      });
      setExpiring(expRows.slice(0, 10));

    } catch (e) {
      console.error(e);
      setError("데이터 로딩 실패");
    }
    setLoading(false);
  };

  return (
    <AppShell title="대시보드">
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: "var(--muted)" }}>{today}</div>
        <div style={{ fontSize: 22, fontWeight: 900 }}>{user?.branch_name} 현황</div>
      </div>

      {error && <div className="card" style={{ color: "#ef4444", marginBottom: 16 }}>{error}</div>}

      {/* 요약 카드 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 20 }}>
        {[
          { label: "오늘 매출", value: loading ? "-" : money(summary?.today_sales), color: "#2563eb" },
          { label: "이번달 매출", value: loading ? "-" : money(summary?.month_sales), color: "#7c3aed" },
          { label: "활성 회원", value: loading ? "-" : `${summary?.active_members || 0}명`, color: "#059669" },
          { label: "오늘 출석", value: loading ? "-" : `${summary?.today_attendance || 0}명`, color: "#d97706" },
          { label: "오늘 신규 등록", value: loading ? "-" : `${summary?.today_new || 0}명`, color: "#0891b2" },
          { label: "이번달 신규 등록", value: loading ? "-" : `${summary?.month_new || 0}명`, color: "#be185d" },
        ].map((s) => (
          <div key={s.label} className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        {/* 오늘 출석 회원 */}
        <div className="card">
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 14 }}>
            오늘 출석 <span style={{ color: "var(--accent)", fontSize: 13 }}>{attendance.length}명</span>
          </div>
          {loading ? (
            <div style={{ color: "var(--muted)", fontSize: 13 }}>로딩 중...</div>
          ) : attendance.length === 0 ? (
            <div style={{ color: "var(--muted)", fontSize: 13 }}>오늘 출석 없음</div>
          ) : (
            <div style={{ display: "grid", gap: 6, maxHeight: 280, overflowY: "auto" }}>
              {attendance.map((a: any, i: number) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
                  <span style={{ fontWeight: 700 }}>{a.name}</span>
                  <span style={{ color: "var(--muted)" }}>{String(a.checkin_time || "").slice(11, 16)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 전체 지점 오늘 출석 현황 */}
        <div className="card">
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 14 }}>전체 지점 당일 출석</div>
          {loading ? (
            <div style={{ color: "var(--muted)", fontSize: 13 }}>로딩 중...</div>
          ) : allBranches.length === 0 ? (
            <div style={{ color: "var(--muted)", fontSize: 13 }}>출석 데이터 없음</div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {allBranches.map((b: any) => (
                <div key={b.branch_name} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "8px 12px", borderRadius: 8,
                  background: b.branch_name === user?.branch_name ? "var(--accent)" : "var(--panel2)",
                }}>
                  <span style={{ fontWeight: 700, color: b.branch_name === user?.branch_name ? "#fff" : "var(--text)", fontSize: 14 }}>
                    {b.branch_name}
                    {b.branch_name === user?.branch_name && <span style={{ fontSize: 11, marginLeft: 4, opacity: 0.8 }}>내 지점</span>}
                  </span>
                  <span style={{ fontWeight: 900, color: b.branch_name === user?.branch_name ? "#fff" : "var(--accent)" }}>{b.count}명</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 만료 임박 회원 */}
      <div className="card">
        <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 14 }}>
          만료 임박 회원 <span style={{ color: "#ef4444", fontSize: 13 }}>7일 이내</span>
        </div>
        {loading ? (
          <div style={{ color: "var(--muted)", fontSize: 13 }}>로딩 중...</div>
        ) : expiring.length === 0 ? (
          <div style={{ color: "var(--muted)", fontSize: 13 }}>만료 임박 회원 없음</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
            {expiring.map((m: any) => (
              <div key={m.member_id} style={{ padding: "10px 14px", background: "var(--panel2)", borderRadius: 10, borderLeft: "3px solid #ef4444" }}>
                <div style={{ fontWeight: 800, fontSize: 14 }}>{m.name}</div>
                <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 2 }}>{m.product_name}</div>
                <div style={{ color: "#ef4444", fontSize: 12, fontWeight: 700, marginTop: 2 }}>
                  만료: {String(m.end_date || "").slice(0, 10)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
