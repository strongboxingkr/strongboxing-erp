"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { apiFetch } from "@/lib/api";

const today = new Date().toISOString().slice(0, 10);

export default function AttendancePage() {
  const [user, setUser] = useState<any>(null);
  const [date, setDate] = useState(today);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [branches, setBranches] = useState<any[]>([]);
  const [selBranch, setSelBranch] = useState("");

  // 직접 출석 처리
  const [checkinCode, setCheckinCode] = useState("");
  const [checkinResult, setCheckinResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [checkinLoading, setCheckinLoading] = useState(false);

  const isAdminOrOwner = (role?: string) => role === "ADMIN" || role === "OWNER";

  const load = async (u = user, d = date, br = selBranch) => {
    if (!u) return;
    setLoading(true);
    const branchParam = isAdminOrOwner(u.role)
      ? (br && br !== "전체" ? `&branch_name=${encodeURIComponent(br)}` : "")
      : (u.branch_name ? `&branch_name=${encodeURIComponent(u.branch_name)}` : "");
    try {
      const res = await apiFetch(`/api/attendance?today_only=N&date=${d}&limit=500${branchParam}`);
      const json = await res.json();
      setRows(json.rows || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    const saved = localStorage.getItem("user");
    if (!saved) return;
    const u = JSON.parse(saved);
    setUser(u);
    if (isAdminOrOwner(u.role)) {
      apiFetch("/api/settings?option_type=BRANCH").then(r => r.json()).then(d => setBranches(d.rows || []));
    } else {
      setSelBranch(u.branch_name || "");
    }
    load(u, today, u.branch_name || "");
  }, []);

  const handleDateChange = (d: string) => {
    setDate(d);
    load(user, d, selBranch);
  };

  const handleBranchChange = (br: string) => {
    setSelBranch(br);
    load(user, date, br);
  };

  const handleCheckin = async () => {
    if (!checkinCode.trim()) return;
    setCheckinLoading(true);
    setCheckinResult(null);
    try {
      const branchName = isAdminOrOwner(user?.role) ? (selBranch !== "전체" ? selBranch : "") : user?.branch_name;
      const res = await apiFetch("/api/check-in", {
        method: "POST",
        body: JSON.stringify({ checkin_code: checkinCode.trim(), branch_name: branchName }),
      });
      const json = await res.json();
      if (json.success) {
        setCheckinResult({ ok: true, msg: `${json.name || ""}님 출석 완료` });
        setCheckinCode("");
        setTimeout(() => setCheckinResult(null), 3000);
        load(user, date, selBranch);
      } else {
        setCheckinResult({ ok: false, msg: json.message || "출석 처리 실패" });
      }
    } catch {
      setCheckinResult({ ok: false, msg: "네트워크 오류" });
    }
    setCheckinLoading(false);
  };

  const successRows = rows.filter(r => r.result === "SUCCESS");
  const isToday = date === today;

  return (
    <AppShell title="출석현황">
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 0 40px" }}>
        {/* 필터 */}
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
          <input
            type="date"
            value={date}
            onChange={e => handleDateChange(e.target.value)}
            style={{ height: 36, padding: "0 10px", fontSize: 14, border: "1px solid #e2e5eb", borderRadius: 7 }}
          />
          {isAdminOrOwner(user?.role) && (
            <select
              value={selBranch}
              onChange={e => handleBranchChange(e.target.value)}
              style={{ height: 36, padding: "0 10px", fontSize: 13, border: "1px solid #e2e5eb", borderRadius: 7 }}
            >
              <option value="">전체</option>
              {branches.map((b: any) => (
                <option key={b.option_id} value={b.option_name}>{b.option_name}</option>
              ))}
            </select>
          )}
          <span style={{ fontSize: 13, color: "#6b7280" }}>
            {loading ? "불러오는 중..." : `총 ${successRows.length}명 출석`}
          </span>
        </div>

        {/* 직접 출석 처리 (오늘만) */}
        {isToday && (
          <div style={{ background: "#f8faff", border: "1px solid #dbeafe", borderRadius: 10, padding: "14px 18px", marginBottom: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1d4ed8", marginBottom: 10 }}>직접 출석 처리</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="text"
                placeholder="출석 코드 입력"
                value={checkinCode}
                onChange={e => setCheckinCode(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleCheckin()}
                style={{ height: 38, padding: "0 12px", fontSize: 15, border: "1px solid #bfdbfe", borderRadius: 7, flex: 1, maxWidth: 220 }}
                inputMode="numeric"
              />
              <button
                onClick={handleCheckin}
                disabled={checkinLoading || !checkinCode.trim()}
                style={{ height: 38, padding: "0 18px", fontSize: 14, fontWeight: 700, background: "#2563eb", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer", opacity: checkinLoading ? 0.6 : 1 }}
              >
                {checkinLoading ? "처리 중..." : "출석"}
              </button>
              {checkinResult && (
                <span style={{ fontSize: 13, fontWeight: 600, color: checkinResult.ok ? "#16a34a" : "#dc2626" }}>
                  {checkinResult.msg}
                </span>
              )}
            </div>
          </div>
        )}

        {/* 출석 목록 */}
        <div style={{ background: "#fff", border: "1px solid #e2e5eb", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ padding: "12px 18px", borderBottom: "1px solid #e2e5eb", fontWeight: 700, fontSize: 14 }}>
            {date === today ? "오늘" : date} 출석 회원
          </div>
          {successRows.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: "#9ca3af", fontSize: 14 }}>
              {loading ? "불러오는 중..." : "출석 기록이 없습니다."}
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  <th style={{ padding: "8px 14px", textAlign: "left", fontWeight: 600, color: "#6b7280" }}>시간</th>
                  <th style={{ padding: "8px 14px", textAlign: "left", fontWeight: 600, color: "#6b7280" }}>이름</th>
                  {isAdminOrOwner(user?.role) && (
                    <th style={{ padding: "8px 14px", textAlign: "left", fontWeight: 600, color: "#6b7280" }}>지점</th>
                  )}
                  <th style={{ padding: "8px 14px", textAlign: "left", fontWeight: 600, color: "#6b7280" }}>프로그램</th>
                  <th style={{ padding: "8px 14px", textAlign: "left", fontWeight: 600, color: "#6b7280" }}>상태</th>
                  <th style={{ padding: "8px 14px", textAlign: "left", fontWeight: 600, color: "#6b7280" }}>만료일</th>
                </tr>
              </thead>
              <tbody>
                {successRows.map((r, i) => (
                  <tr key={r.attendance_id} style={{ borderTop: i > 0 ? "1px solid #f1f3f5" : "none" }}>
                    <td style={{ padding: "9px 14px", color: "#374151", fontVariantNumeric: "tabular-nums" }}>
                      {r.checkin_time ? new Date(r.checkin_time).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }) : "-"}
                    </td>
                    <td style={{ padding: "9px 14px", fontWeight: 600, color: "#111827" }}>
                      {r.name || "-"}
                    </td>
                    {isAdminOrOwner(user?.role) && (
                      <td style={{ padding: "9px 14px", color: "#6b7280" }}>{r.branch_name || "-"}</td>
                    )}
                    <td style={{ padding: "9px 14px", color: "#374151" }}>{r.product_name || "-"}</td>
                    <td style={{ padding: "9px 14px" }}>
                      <span style={{
                        fontSize: 11, padding: "2px 8px", borderRadius: 999, fontWeight: 600,
                        background: r.result === "CHECK_OUT" ? "#f3f4f6" : "#dcfce7",
                        color: r.result === "CHECK_OUT" ? "#6b7280" : "#16a34a",
                      }}>
                        {r.result === "CHECK_OUT" ? "퇴장" : "입장"}
                      </span>
                    </td>
                    <td style={{ padding: "9px 14px", color: r.end_date && r.end_date < today ? "#ef4444" : "#374151" }}>
                      {r.end_date ? r.end_date.slice(0, 10) : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppShell>
  );
}
