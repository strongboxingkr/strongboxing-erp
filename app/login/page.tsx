"use client";

import { useEffect, useState } from "react";

export default function LoginPage() {
  const [login_id, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [branch_name, setBranchName] = useState("철산점");
  const [branches, setBranches] = useState<any[]>([]);

  const loadBranches = async () => {
    const res = await fetch("/api/settings?option_type=BRANCH");
    const data = await res.json();

    setBranches(data.rows || []);

    if (data.rows?.length > 0) {
      setBranchName(data.rows[0].option_name);
    }
  };

  useEffect(() => {
    loadBranches();
  }, []);

  const login = async () => {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        login_id,
        password,
        branch_name,
      }),
    });

    const data = await res.json();

    if (data.success) {
      localStorage.setItem("user", JSON.stringify(data.user));

      alert(`${data.user.name}님 로그인 성공`);

      location.href = "/dashboard";
    } else {
      alert(data.message || "로그인 실패");
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0f172a",
      }}
    >
      <div
        style={{
          width: 420,
          background: "#111827",
          padding: 32,
          borderRadius: 20,
        }}
      >
        <h1
          style={{
            fontSize: 32,
            fontWeight: 900,
            marginBottom: 24,
            color: "white",
          }}
        >
          STRONG ERP
        </h1>

        <div style={{ display: "grid", gap: 12 }}>
          <input
            className="input"
            placeholder="아이디"
            value={login_id}
            onChange={(e) => setLoginId(e.target.value)}
          />

          <input
            className="input"
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <select
            className="input"
            value={branch_name}
            onChange={(e) => setBranchName(e.target.value)}
          >
            {branches.map((b) => (
              <option key={b.option_id} value={b.option_name}>
                {b.option_name}
              </option>
            ))}
          </select>

          <p
            style={{
              color: "#9ca3af",
              fontSize: 13,
              margin: 0,
            }}
          >
            로그인 시 지점을 선택합니다.
          </p>

          <button className="btn" onClick={login}>
            로그인
          </button>
        </div>
      </div>
    </div>
  );
}