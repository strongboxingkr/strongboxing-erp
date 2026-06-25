"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { apiFetch } from "@/lib/api";

export default function PendingUsersPage() {
  const [rows, setRows] = useState<any[]>([]);

  const load = async () => {
    const res = await apiFetch("/api/users/pending");
    const json = await res.json();
    setRows(json.rows || []);
  };

  const approve = async (user_id: number) => {
    const res = await apiFetch("/api/users/approve", {
      method: "POST",
      body: JSON.stringify({ user_id }),
    });
    const json = await res.json();
    if (json.success) { alert("승인 완료!"); load(); }
    else alert(json.message || "승인 실패");
  };

  useEffect(() => { load(); }, []);

  return (
    <AppShell title="가입 승인 관리">
      {rows.length === 0 ? (
        <div className="card" style={{ textAlign: "center", color: "var(--muted)", padding: 40 }}>
          승인 대기 계정이 없습니다.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          {rows.map((u) => (
            <div key={u.user_id} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 900 }}>{u.name}</div>
                <div style={{ color: "var(--muted)", fontSize: 14, marginTop: 4 }}>아이디: {u.login_id}</div>
                <div style={{ color: "var(--muted)", fontSize: 14 }}>전화번호: {u.phone || "-"}</div>
                <div style={{ color: "var(--muted)", fontSize: 14 }}>지점: {u.branch_name || "-"}</div>
                <div style={{ color: "var(--muted)", fontSize: 14 }}>권한: {u.role}</div>
                <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>{u.created_at?.slice(0, 16)}</div>
              </div>
              <button className="btn" onClick={() => approve(u.user_id)}>승인</button>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
