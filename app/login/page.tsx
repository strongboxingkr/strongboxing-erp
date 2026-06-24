"use client";

import { useEffect, useState } from "react";

export default function LoginPage() {
  const [mode, setMode] = useState<"LOGIN" | "SIGNUP">("LOGIN");

  const [login_id, setLoginId] = useState("");
  const [password, setPassword] = useState("");

  const [signupForm, setSignupForm] = useState({
    name: "",
    username: "",
    password: "",
    phone: "",
    requested_branch: "철산점",
    role: "COACH",
    request_memo: "",
  });

  const [branches, setBranches] = useState<any[]>([]);

  const loadBranches = async () => {
    const res = await fetch("/api/settings?option_type=BRANCH");
    const data = await res.json();

    setBranches(data.rows || []);

    if (data.rows?.length > 0) {
      setSignupForm((prev) => ({
        ...prev,
        requested_branch: data.rows[0].option_name,
      }));
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
      }),
    });

    const data = await res.json();

    if (data.success) {
      localStorage.setItem("user", JSON.stringify(data.user));

      alert(`${data.user.name}님 로그인 성공`);

      const isMobile =
        /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

      if (isMobile) {
        if (
          data.user.role === "OWNER" ||
          data.user.role === "ADMIN"
        ) {
          window.location.replace("/mobile-owner");
        } else {
          window.location.replace("/mobile-branch");
        }
      } else {
        window.location.replace("/dashboard");
      }
    } else {
      alert(data.message || "로그인 실패");
    }
  };

  const signup = async () => {
    const res = await fetch("/api/signup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(signupForm),
    });

    const data = await res.json();

    if (data.success) {
      alert("회원가입 요청 완료! 관리자 승인 후 로그인 가능합니다.");

      setMode("LOGIN");

      setSignupForm({
        name: "",
        username: "",
        password: "",
        phone: "",
        requested_branch: "철산점",
        role: "COACH",
        request_memo: "",
      });
    } else {
      alert(data.message || "회원가입 실패");
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--panel2)",
        padding: 20,
      }}
    >
      <div
        style={{
          width: 420,
          background: "var(--panel2)",
          padding: 32,
          borderRadius: 20,
        }}
      >
        <h1
          style={{
            fontSize: 32,
            fontWeight: 900,
            marginBottom: 24,
            color: "var(--text)",
          }}
        >
          STRONG ERP
        </h1>

        {mode === "LOGIN" ? (
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

            <button className="btn" onClick={login}>
              로그인
            </button>

            <button
              className="btn secondary"
              onClick={() => setMode("SIGNUP")}
            >
              회원가입 요청
            </button>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            <input
              className="input"
              placeholder="이름"
              value={signupForm.name}
              onChange={(e) =>
                setSignupForm({
                  ...signupForm,
                  name: e.target.value,
                })
              }
            />

            <input
              className="input"
              placeholder="아이디"
              value={signupForm.username}
              onChange={(e) =>
                setSignupForm({
                  ...signupForm,
                  username: e.target.value,
                })
              }
            />

            <input
              className="input"
              type="password"
              placeholder="비밀번호"
              value={signupForm.password}
              onChange={(e) =>
                setSignupForm({
                  ...signupForm,
                  password: e.target.value,
                })
              }
            />

            <input
              className="input"
              placeholder="전화번호"
              value={signupForm.phone}
              onChange={(e) =>
                setSignupForm({
                  ...signupForm,
                  phone: e.target.value,
                })
              }
            />

            <select
              className="input"
              value={signupForm.requested_branch}
              onChange={(e) =>
                setSignupForm({
                  ...signupForm,
                  requested_branch: e.target.value,
                })
              }
            >
              {branches.map((b) => (
                <option
                  key={b.option_id}
                  value={b.option_name}
                >
                  {b.option_name}
                </option>
              ))}
            </select>

            <textarea
              className="input"
              placeholder="메모"
              value={signupForm.request_memo}
              onChange={(e) =>
                setSignupForm({
                  ...signupForm,
                  request_memo: e.target.value,
                })
              }
              style={{
                minHeight: 90,
              }}
            />

            <button className="btn" onClick={signup}>
              회원가입 요청
            </button>

            <button
              className="btn secondary"
              onClick={() => setMode("LOGIN")}
            >
              로그인으로 돌아가기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}