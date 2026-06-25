"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { apiFetch } from "@/lib/api";

export default function PendingUsersPage() {
  const [pending, setPending] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [tab, setTab] = useState<"pending" | "all">("pending");
  const [resetUserId, setResetUserId] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const loadPending = async () => {
    const res = await apiFetch("/api/users/pending");
    const json = await res.json();
    setPending(json.rows || []);
  };

  const loadAll = async () => {
    const res = await apiFetch("/api/users");
    const json = await res.json();
    setAllUsers(json.rows || []);
  };

  useEffect(() => {
    loadPending();
    loadAll();
  }, []);

  const approve = async (user_id: number) => {
    const res = await apiFetch("/api/users/approve", {
      method: "POST",
      body: JSON.stringify({ user_id }),
    });
    const json = await res.json();
    if (json.success) { alert("승인 완료!"); loadPending(); loadAll(); }
    else alert(json.message || "승인 실패");
  };

  const resetPassword = async () => {
    if (!newPassword.trim()) return alert("새 비밀번호를 입력해주세요.");
    const res = await apiFetch("/api/users/reset-password", {
      method: "POST",
      body: JSON.stringify({ user_id: resetUserId, new_password: newPassword }),
    });
    const json = await res.json();
    if (json.success) { alert("비밀번호 변경 완료!"); setResetUserId(null); setNewPassword(""); }
    else alert(json.message || "변경 실패");
  };

  const rows = tab === "pending" ? pending : allUsers;

  return (
    <AppShell title="계정 관리">
      {/* 탭 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        <button className={`btn ${tab === "pending" ? "" : "secondary"}`} onClick={() => setTab("pending")}>
          가입 승인 대기 {pending.length > 0 && `(${pending.length})`}
        </button>
        <button className={`btn ${tab === "all" ? "" : "secondary"}`} onClick={() => setTab("all")}>
          전체 계정
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="card" style={{ textAlign: "center", color: "var(--muted)", padding: 40 }}>
          {tab === "pending" ? "승인 대기 계정이 없습니다." : "계정이 없습니다."}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {rows.map((u) => (
            <div key={u.user_id} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 900 }}>{u.name}</div>
                <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 3 }}>아이디: {u.login_id}</div>
                <div style={{ color: "var(--muted)", fontSize: 13 }}>전화: {u.phone || "-"} · 지점: {u.branch_name || "-"} · 권한: {u.role}</div>
                <div style={{ marginTop: 4 }}>
                  <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 12, fontWeight: 700,
                    background: u.status === "APPROVED" ? "#dcfce7" : "#fef9c3",
                    color: u.status === "APPROVED" ? "#16a34a" : "#92400e" }}>
                    {u.status || "APPROVED"}
                  </span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {u.status === "PENDING" && (
                  <button className="btn" onClick={() => approve(u.user_id)}>승인</button>
                )}
                <button className="btn secondary" onClick={() => { setResetUserId(u.user_id); setNewPassword(""); }}>
                  비번 변경
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 비밀번호 변경 모달 */}
      {resetUserId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }}>
          <div className="card" style={{ width: 340, borderRadius: 16 }}>
            <h2 style={{ marginTop: 0 }}>비밀번호 변경</h2>
            <input
              className="input"
              type="password"
              placeholder="새 비밀번호"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={{ marginBottom: 12 }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn" onClick={resetPassword}>변경</button>
              <button className="btn secondary" onClick={() => setResetUserId(null)}>취소</button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
