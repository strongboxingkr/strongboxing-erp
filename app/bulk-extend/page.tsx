"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { apiFetch } from "@/lib/api";

export default function BulkExtendPage() {
  const [user, setUser] = useState<any>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [branch, setBranch] = useState("");
  const [baseDate, setBaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [days, setDays] = useState(1);
  const [preview, setPreview] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("user");
    if (saved) {
      const u = JSON.parse(saved);
      setUser(u);
      if (u.role !== "ADMIN" && u.role !== "OWNER") setBranch(u.branch_name || "");
    }
    loadBranches();
  }, []);

  const loadBranches = async () => {
    const res = await apiFetch("/api/settings?option_type=BRANCH");
    const data = await res.json();
    setBranches(data.rows || []);
  };

  const loadPreview = async () => {
    setLoading(true);
    setDone(false);
    const branchQ = branch ? `&branch_name=${encodeURIComponent(branch)}` : "";
    const res = await apiFetch(`/api/bulk-extend?base_date=${baseDate}${branchQ}`);
    const data = await res.json();
    setPreview(data.rows || []);
    setLoading(false);
  };

  const apply = async () => {
    if (!confirm(`${preview.length}명의 만료일을 ${days > 0 ? "+" : ""}${days}일 변경합니다. 계속하시겠습니까?`)) return;
    setLoading(true);
    const res = await apiFetch("/api/bulk-extend", {
      method: "POST",
      body: JSON.stringify({ base_date: baseDate, days, branch_name: branch || null }),
    });
    const data = await res.json();
    setLoading(false);
    if (data.success) {
      setDone(true);
      alert(`✅ ${data.affected}명 변경 완료`);
      loadPreview();
    } else {
      alert("변경 실패");
    }
  };

  const isAdmin = user?.role === "ADMIN" || user?.role === "OWNER";

  return (
    <AppShell title="기간 일괄 연장">
      <div className="card" style={{ maxWidth: 700, margin: "0 auto" }}>
        <div style={{ fontWeight: 900, fontSize: 20, marginBottom: 24 }}>기간 일괄 연장</div>

        {/* 설정 */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 24 }}>
          {isAdmin && (
            <div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>지점</div>
              <select className="input" value={branch} onChange={(e) => setBranch(e.target.value)}>
                <option value="">전체 지점</option>
                {branches.map((b) => <option key={b.option_value} value={b.option_value}>{b.option_name}</option>)}
              </select>
            </div>
          )}
          <div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>기준일 <span style={{ color: "var(--muted)", fontWeight: 400 }}>(이 날짜 이후 만료 회원 대상)</span></div>
            <input className="input" type="date" value={baseDate} onChange={(e) => setBaseDate(e.target.value)} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>조정일수 <span style={{ color: "var(--muted)", fontWeight: 400 }}>(+ 연장 / - 단축)</span></div>
            <input
              className="input"
              type="number"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              style={{ color: days > 0 ? "var(--accent)" : "#ef4444" }}
            />
          </div>
        </div>

        <button className="btn secondary" onClick={loadPreview} disabled={loading} style={{ marginBottom: 20 }}>
          {loading ? "조회 중..." : "대상 회원 조회"}
        </button>

        {/* 미리보기 */}
        {preview.length > 0 && (
          <>
            <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "#ef4444" }}>
              ⚠️ 유효회원 전체에 적용됩니다. 신중하게 확인 후 변경하세요.
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontWeight: 700 }}>
                대상 회원 <span style={{ color: "var(--accent)" }}>{preview.length}명</span>
                {" "}· {days > 0 ? "+" : ""}{days}일 적용 시
              </div>
              <button className="btn" onClick={apply} disabled={loading} style={{ background: days < 0 ? "#ef4444" : undefined }}>
                일괄 변경 적용
              </button>
            </div>

            <div style={{ maxHeight: 400, overflowY: "auto", border: "1px solid var(--line)", borderRadius: 8 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", padding: "8px 14px", fontSize: 12, color: "var(--muted)", borderBottom: "1px solid var(--line)", fontWeight: 700 }}>
                <span>회원명</span>
                <span>지점</span>
                <span>현재 만료일</span>
                <span>변경 후</span>
              </div>
              {preview.map((m) => {
                const newEnd = new Date(m.end_date);
                newEnd.setDate(newEnd.getDate() + days);
                return (
                  <div key={m.member_id} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", padding: "8px 14px", fontSize: 13, borderBottom: "1px solid var(--line)" }}>
                    <span style={{ fontWeight: 700 }}>{m.name}</span>
                    <span style={{ color: "var(--muted)" }}>{m.branch_name}</span>
                    <span>{m.end_date?.slice(0, 10)}</span>
                    <span style={{ color: days > 0 ? "var(--accent)" : "#ef4444", fontWeight: 700 }}>
                      {newEnd.toISOString().slice(0, 10)}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
