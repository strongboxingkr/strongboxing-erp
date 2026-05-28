"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function PendingUsersPage() {
  const [rows, setRows] = useState<any[]>([]);

  const load = async () => {
    const res = await fetch("/api/users/pending");
    const json = await res.json();
    setRows(json.rows || []);
  };

  const approve = async (user_id: number) => {
    const res = await fetch("/api/users/approve", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ user_id }),
    });

    const json = await res.json();

    if (json.success) {
      alert("승인 완료!");
      load();
    } else {
      alert(json.message || "승인 실패");
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#08090d",
        color: "white",
        padding: 24,
      }}
    >
      <Link href="/dashboard" style={{ color: "#2ee59d" }}>
        ← 대시보드
      </Link>

      <h1 style={{ fontSize: 34, fontWeight: 900 }}>
        회원가입 승인관리
      </h1>

      <div style={{ display: "grid", gap: 14 }}>
        {rows.map((u) => (
          <div
            key={u.user_id}
            className="card"
            style={{ borderRadius: 22 }}
          >
            <h2>{u.name}</h2>
            <p>아이디: {u.username}</p>
            <p>전화번호: {u.phone || "-"}</p>
            <p>요청지점: {u.requested_branch || "-"}</p>
            <p>권한: {u.role}</p>
            <p>메모: {u.request_memo || "-"}</p>

            <button className="btn" onClick={() => approve(u.user_id)}>
              승인
            </button>
          </div>
        ))}

        {rows.length === 0 && <p>승인 대기 계정이 없습니다.</p>}
      </div>
    </main>
  );
}