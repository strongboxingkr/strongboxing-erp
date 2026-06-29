"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { apiFetch } from "@/lib/api";

const ZONES = ["A", "B"];
const ZONE_RANGES: Record<string, number[]> = {
  A: Array.from({ length: 49 }, (_, i) => i + 1),
  B: Array.from({ length: 49 }, (_, i) => i + 50),
};

export default function LockersPage() {
  const [user, setUser] = useState<any>(null);
  const [branch, setBranch] = useState("");
  const [branches, setBranches] = useState<any[]>([]);
  const [lockers, setLockers] = useState<any[]>([]);
  const [zone, setZone] = useState("A");
  const [modal, setModal] = useState<any>(null);
  const [form, setForm] = useState({ member_name: "", start_date: "", end_date: "", memo: "" });

  useEffect(() => {
    const saved = localStorage.getItem("user");
    if (saved) {
      const u = JSON.parse(saved);
      setUser(u);
      const isAdmin = u.role === "ADMIN" || u.role === "OWNER";
      if (!isAdmin) setBranch(u.branch_name || "");
    }
    loadBranches();
  }, []);

  useEffect(() => {
    if (branch) load();
  }, [branch]);

  const loadBranches = async () => {
    const res = await apiFetch("/api/settings?option_type=BRANCH");
    const data = await res.json();
    setBranches(data.rows || []);
  };

  const load = async () => {
    const res = await apiFetch(`/api/lockers?branch_name=${encodeURIComponent(branch)}`);
    const data = await res.json();
    setLockers(data.rows || []);
  };

  const getLocker = (no: number) => lockers.find((l) => l.locker_no === no && l.locker_zone === zone);

  const openModal = (no: number) => {
    const existing = getLocker(no);
    setModal({ locker_no: no, zone, existing });
    setForm({
      member_name: existing?.member_name || "",
      start_date: existing?.start_date?.slice(0, 10) || "",
      end_date: existing?.end_date?.slice(0, 10) || "",
      memo: existing?.memo || "",
    });
  };

  const assign = async () => {
    await apiFetch("/api/lockers/assign", {
      method: "POST",
      body: JSON.stringify({
        branch_name: branch,
        locker_zone: modal.zone,
        locker_no: modal.locker_no,
        member_name: form.member_name,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        memo: form.memo,
      }),
    });
    setModal(null);
    load();
  };

  const release = async () => {
    if (!confirm("락커를 비우시겠습니까?")) return;
    await apiFetch("/api/lockers/release", {
      method: "POST",
      body: JSON.stringify({ locker_id: modal.existing.locker_id }),
    });
    setModal(null);
    load();
  };

  const isAdmin = user?.role === "ADMIN" || user?.role === "OWNER";
  const usedCount = lockers.filter((l) => l.locker_zone === zone && l.member_name).length;
  const totalCount = ZONE_RANGES[zone].length;

  return (
    <AppShell title="락커 관리">
      {/* 상단 필터 */}
      <div className="card" style={{ marginBottom: 16, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        {isAdmin && (
          <select className="input" style={{ width: 140 }} value={branch} onChange={(e) => setBranch(e.target.value)}>
            <option value="">지점 선택</option>
            {branches.map((b) => <option key={b.option_value} value={b.option_value}>{b.option_name}</option>)}
          </select>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          {ZONES.map((z) => (
            <button key={z} className={zone === z ? "btn" : "btn secondary"} onClick={() => setZone(z)}>
              {z}구역
            </button>
          ))}
        </div>
        <div style={{ marginLeft: "auto", fontSize: 14, color: "var(--muted)" }}>
          사용중 <strong style={{ color: "var(--accent)" }}>{usedCount}</strong> / 전체 {totalCount}
        </div>
      </div>

      {/* 락커 그리드 */}
      {!branch ? (
        <div className="card" style={{ textAlign: "center", color: "var(--muted)", padding: 40 }}>지점을 선택해주세요</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
          {ZONE_RANGES[zone].map((no) => {
            const locker = getLocker(no);
            const used = !!locker?.member_name;
            const expired = used && locker.end_date && new Date(locker.end_date) < new Date();
            return (
              <div
                key={no}
                onClick={() => openModal(no)}
                style={{
                  padding: "12px 8px",
                  borderRadius: 10,
                  cursor: "pointer",
                  border: expired ? "2px solid #ef4444" : used ? "2px solid var(--accent)" : "1px solid var(--line)",
                  background: expired ? "rgba(239,68,68,0.08)" : used ? "rgba(59,130,246,0.1)" : "var(--panel)",
                  textAlign: "center",
                  minHeight: 80,
                  transition: "transform 0.1s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.03)")}
                onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
              >
                <div style={{ fontSize: 16, fontWeight: 900, color: used ? "var(--accent)" : "var(--muted)" }}>{no}</div>
                {used && (
                  <>
                    <div style={{ fontSize: 11, fontWeight: 700, marginTop: 4, color: "var(--text)" }}>{locker.member_name}</div>
                    <div style={{ fontSize: 10, color: expired ? "#ef4444" : "var(--muted)", marginTop: 2 }}>
                      {locker.end_date?.slice(0, 10)}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 배정 모달 */}
      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="card" style={{ width: 380, padding: 28 }}>
            <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 20 }}>
              {modal.zone}구역 {modal.locker_no}번 락커
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>회원명</div>
                <input className="input" value={form.member_name} onChange={(e) => setForm({ ...form, member_name: e.target.value })} placeholder="회원명 입력" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>시작일</div>
                  <input className="input" type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>종료일</div>
                  <input className="input" type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>메모</div>
                <input className="input" value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} placeholder="메모" />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
              {modal.existing?.member_name && (
                <button className="btn secondary" style={{ color: "#ef4444" }} onClick={release}>비우기</button>
              )}
              <button className="btn secondary" style={{ marginLeft: "auto" }} onClick={() => setModal(null)}>취소</button>
              <button className="btn" onClick={assign}>저장</button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
