"use client";

import { useEffect, useState, useRef } from "react";

export default function LoginPage() {
  const [mode, setMode] = useState<"LOGIN" | "SIGNUP">("LOGIN");

  const [login_id, setLoginId] = useState("");
  const [password, setPassword] = useState("");

  const [signupForm, setSignupForm] = useState({
    name: "",
    username: "",
    password: "",
    phone: "",
    requested_branch: "",
    role: "COACH",
    request_memo: "",
  });

  const [branches, setBranches] = useState<any[]>([]);
  const [idStatus, setIdStatus] = useState<"idle" | "checking" | "ok" | "dup">("idle");
  const idTimer = useRef<any>(null);

  const loadBranches = async () => {
    const res = await fetch("/api/settings?option_type=BRANCH");
    const data = await res.json();
    setBranches(data.rows || []);
    if (data.rows?.length > 0) {
      setSignupForm((prev) => ({ ...prev, requested_branch: data.rows[0].option_name }));
    }
  };

  useEffect(() => { loadBranches(); }, []);

  const checkDuplicate = (username: string) => {
    if (!username.trim()) { setIdStatus("idle"); return; }
    setIdStatus("checking");
    clearTimeout(idTimer.current);
    idTimer.current = setTimeout(async () => {
      const res = await fetch(`/api/check-id?login_id=${encodeURIComponent(username)}`);
      const data = await res.json();
      setIdStatus(data.exists ? "dup" : "ok");
    }, 500);
  };

  const login = async () => {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login_id, password }),
    });
    const data = await res.json();
    if (data.success) {
      localStorage.setItem("user", JSON.stringify(data.user));
      alert(`${data.user.name}님 로그인 성공`);
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (isMobile) {
        window.location.replace(data.user.role === "OWNER" || data.user.role === "ADMIN" ? "/mobile-owner" : "/mobile-branch");
      } else {
        const role = data.user.role;
        if (role === "ADMIN" || role === "OWNER") {
          window.location.replace("/dashboard");
        } else {
          window.location.replace("/director-dashboard");
        }
      }
    } else {
      alert(data.message || "로그인 실패");
    }
  };

  const signup = async () => {
    if (idStatus === "dup") return alert("이미 사용 중인 아이디입니다.");
    if (idStatus !== "ok") return alert("아이디 중복 확인이 필요합니다.");
    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(signupForm),
    });
    const data = await res.json();
    if (data.success) {
      alert("회원가입 요청 완료! 관리자 승인 후 로그인 가능합니다.");
      setMode("LOGIN");
      setSignupForm({ name: "", username: "", password: "", phone: "", requested_branch: branches[0]?.option_name || "", role: "COACH", request_memo: "" });
      setIdStatus("idle");
    } else {
      alert(data.message || "회원가입 실패");
    }
  };

  const idColor = idStatus === "ok" ? "#16a34a" : idStatus === "dup" ? "#dc2626" : "#6b7280";
  const idMsg = idStatus === "ok" ? "사용 가능한 아이디입니다." : idStatus === "dup" ? "이미 사용 중인 아이디입니다." : idStatus === "checking" ? "확인 중..." : "";

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--panel2)", padding: 20 }}>
      <div style={{ width: 420, background: "var(--panel)", padding: 36, borderRadius: 20, boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
        <h1 style={{ fontSize: 32, fontWeight: 900, marginBottom: 8, color: "var(--text)" }}>STRONG ERP</h1>
        <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 28 }}>
          {mode === "LOGIN" ? "관리자 로그인" : "가입 신청"}
        </p>

        {mode === "LOGIN" ? (
          <div style={{ display: "grid", gap: 12 }}>
            <input className="input" placeholder="아이디" value={login_id}
              onChange={(e) => setLoginId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && login()} />
            <input className="input" type="password" placeholder="비밀번호" value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && login()} />
            <button className="btn" onClick={login}>로그인</button>
            <button className="btn secondary" onClick={() => setMode("SIGNUP")}>회원가입 요청</button>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            <input className="input" placeholder="이름" value={signupForm.name}
              onChange={(e) => setSignupForm({ ...signupForm, name: e.target.value })} />

            <div>
              <input className="input" placeholder="아이디" value={signupForm.username}
                onChange={(e) => { setSignupForm({ ...signupForm, username: e.target.value }); checkDuplicate(e.target.value); }} />
              {idMsg && <div style={{ fontSize: 12, marginTop: 4, color: idColor }}>{idMsg}</div>}
            </div>

            <input className="input" type="password" placeholder="비밀번호" value={signupForm.password}
              onChange={(e) => setSignupForm({ ...signupForm, password: e.target.value })} />

            <input className="input" placeholder="전화번호" value={signupForm.phone}
              onChange={(e) => setSignupForm({ ...signupForm, phone: e.target.value })} />

            <select className="input" value={signupForm.requested_branch}
              onChange={(e) => setSignupForm({ ...signupForm, requested_branch: e.target.value })}>
              {branches.map((b) => <option key={b.option_id} value={b.option_name}>{b.option_name}</option>)}
            </select>

            <select className="input" value={signupForm.role}
              onChange={(e) => setSignupForm({ ...signupForm, role: e.target.value })}>
              <option value="COACH">코치</option>
              <option value="DIRECTOR">관장</option>
            </select>

            <textarea className="input" placeholder="메모 (선택)" value={signupForm.request_memo}
              onChange={(e) => setSignupForm({ ...signupForm, request_memo: e.target.value })}
              style={{ minHeight: 80 }} />

            <button className="btn" onClick={signup}>회원가입 요청</button>
            <button className="btn secondary" onClick={() => setMode("LOGIN")}>로그인으로 돌아가기</button>
          </div>
        )}
      </div>
    </div>
  );
}
