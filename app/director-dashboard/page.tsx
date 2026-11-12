"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { apiFetch } from "@/lib/api";
import Link from "next/link";

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
  const [showExpiring, setShowExpiring] = useState(false);

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
        apiFetch(`/api/attendance/live?all_branches=true`),
        apiFetch(`/api/members?status=ACTIVE&expiring=7`),
      ]);

      const [sumJson, attJson, allAttJson, expJson] = await Promise.all([
        sumRes.json(), attRes.json(), allAttRes.json(), expRes.json(),
      ]);

      setSummary(sumJson.data);
      setAttendance(attJson.rows || []);
      const branchList = ["철산점", "목동점", "개봉점", "신정점"];
      const branchMap: Record<string, number> = {};
      branchList.forEach((b) => (branchMap[b] = 0));
      (allAttJson.branches || []).forEach((r: any) => { branchMap[r.branch_name] = Number(r.count || 0); });
      setAllBranches(branchList.map((b) => ({ branch_name: b, count: branchMap[b] })));

      // 만료 임박 (오늘~3일 이내)
      const todayDate = new Date(); todayDate.setHours(0,0,0,0);
      const threeDays = new Date(todayDate); threeDays.setDate(threeDays.getDate() + 3);
      const expRows = (expJson.rows || []).filter((m: any) => {
        if (!m.end_date) return false;
        const end = new Date(m.end_date); end.setHours(0,0,0,0);
        return end >= todayDate && end <= threeDays;
      }).sort((a: any, b: any) => new Date(a.end_date).getTime() - new Date(b.end_date).getTime());
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
        <div style={{ fontSize: 22, fontWeight: 900 }}>전체 현황</div>
      </div>

      {error && <div className="card" style={{ color: "#ef4444", marginBottom: 16 }}>{error}</div>}

      {/* 요약 카드 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 20 }}>
        {[
          { label: "오늘 매출", value: loading ? "-" : money(summary?.today_sales), accent: true },
          { label: "이번달 매출", value: loading ? "-" : money(summary?.month_sales), accent: true },
          { label: "활성 회원", value: loading ? "-" : `${summary?.active_members || 0}명`, accent: false },
          { label: "오늘 출석", value: loading ? "-" : `${summary?.today_attendance || 0}명`, accent: false },
          { label: "오늘 신규 등록", value: loading ? "-" : `${summary?.today_new || 0}명`, accent: false },
          { label: "이번달 신규 등록", value: loading ? "-" : `${summary?.month_new || 0}명`, accent: false },
        ].map((s) => (
          <div key={s.label} className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: s.accent ? "var(--accent)" : "var(--text)" }}>{s.value}</div>
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
                  <span style={{ color: "var(--muted)" }}>{a.checkin_time ? new Date(a.checkin_time).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Seoul" }) : ""}</span>
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
                  background: "var(--panel2)",
                }}>
                  <span style={{ fontWeight: 700, color: "var(--text)", fontSize: 14 }}>
                    {b.branch_name}
                  </span>
                  <span style={{ fontWeight: 900, color: "var(--accent)" }}>{b.count}명</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 만료 임박 회원 (접기/펼치기) */}
      <div className="card">
        <button
          onClick={() => setShowExpiring((v) => !v)}
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left" }}
        >
          <span style={{ fontWeight: 800, fontSize: 15 }}>
            만료 임박 회원 <span style={{ color: "#ef4444", fontSize: 13 }}>3일 이내</span>
            {!loading && expiring.length > 0 && (
              <span style={{ marginLeft: 6, background: "#fee2e2", color: "#ef4444", borderRadius: 999, fontSize: 11, fontWeight: 700, padding: "1px 7px" }}>{expiring.length}</span>
            )}
          </span>
          <span style={{ color: "var(--muted)", fontSize: 14 }}>{showExpiring ? "▲" : "▼"}</span>
        </button>
        {showExpiring && (
          loading ? (
            <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 14 }}>로딩 중...</div>
          ) : expiring.length === 0 ? (
            <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 14 }}>만료 임박 회원 없음</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10, marginTop: 14 }}>
              {expiring.map((m: any) => (
                <Link key={m.member_id} href={`/members?search=${encodeURIComponent(m.name)}`} style={{ textDecoration: "none" }}>
                  <div style={{ padding: "10px 14px", background: "var(--panel2)", borderRadius: 10, borderLeft: "3px solid #ef4444" }}>
                    <div style={{ fontWeight: 800, fontSize: 14, color: "var(--text)" }}>{m.name}</div>
                    <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 2 }}>{m.product_name}</div>
                    <div style={{ color: "#ef4444", fontSize: 12, fontWeight: 700, marginTop: 2 }}>
                      만료: {String(m.end_date || "").slice(0, 10)}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )
        )}
      </div>
    </AppShell>
  );
}
