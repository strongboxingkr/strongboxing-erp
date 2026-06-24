"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

export default function KioskPage() {
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("출석번호를 입력해주세요");
  const [member, setMember] = useState<any>(null);

  const checkWithCode = async (inputCode: string, type: "CHECK_IN" | "CHECK_OUT") => {
    if (!inputCode.trim()) return;
    const res = await apiFetch("/api/check-in", {
      method: "POST",
      body: JSON.stringify({ checkin_code: inputCode, check_type: type }),
    });
    const data = await res.json();
    if (data.success) {
      setMember(data.member);
      setMessage(type === "CHECK_OUT" ? `${data.member.name}님 퇴실 완료! 👋` : `${data.member.name}님 입장 완료! 🥊`);
    } else {
      setMember(null);
      setMessage(data.message || "출석 실패");
    }
    setTimeout(() => { setCode(""); setMember(null); setMessage("출석번호를 입력해주세요"); }, 2500);
  };

  const pressNumber = (num: string) => { if (code.length >= 4) return; setCode((prev) => prev + num); };
  const backspace = () => setCode((prev) => prev.slice(0, -1));

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qrCode = params.get("code");
    if (qrCode) { setCode(qrCode); setTimeout(() => checkWithCode(qrCode, "CHECK_IN"), 300); }
  }, []);

  const keyStyle: React.CSSProperties = {
    height: 86,
    borderRadius: 18,
    border: "1px solid #334155",
    background: "#1e293b",
    color: "#fff",
    fontSize: 32,
    fontWeight: 900,
    cursor: "pointer",
  };

  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(circle at top, #172554 0%, #0f172a 45%, #020617 100%)", color: "#fff", display: "flex", justifyContent: "center", alignItems: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 760, background: "rgba(15,23,42,0.95)", borderRadius: 34, padding: 44, boxShadow: "0 0 60px rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.06)" }}>

        <div style={{ textAlign: "center", marginBottom: 30 }}>
          <h1 style={{ fontSize: 58, margin: 0, fontWeight: 900, letterSpacing: 4 }}>
            <span style={{ color: "#fff" }}>STRONG</span>{" "}
            <span style={{ color: "#2563eb" }}>BOXING</span>
          </h1>
          <p style={{ color: "#64748b", marginTop: 14, fontSize: 22 }}>회원 출석 키오스크</p>
        </div>

        <div style={{ textAlign: "center", fontSize: 28, fontWeight: 900, marginBottom: 24 }}>
          {message}
          {member && <div style={{ color: "#2ee59d", fontSize: 20, marginTop: 8 }}>{member.branch_name}</div>}
        </div>

        <div style={{ height: 88, borderRadius: 16, border: "2px solid #2ee59d", background: "#020617", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 42, fontWeight: 900, letterSpacing: 16, marginBottom: 26, boxShadow: "0 0 20px rgba(46,229,157,0.18)" }}>
          {code || <span style={{ color: "#334155" }}>----</span>}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 24 }}>
          {["1","2","3","4","5","6","7","8","9"].map((n) => (
            <button key={n} onClick={() => pressNumber(n)} style={keyStyle}>{n}</button>
          ))}
          <button onClick={() => pressNumber("0")} style={{ ...keyStyle, gridColumn: "1 / 3" }}>0</button>
          <button onClick={backspace} style={{ ...keyStyle, fontSize: 26, color: "#94a3b8" }}>⌫</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <button onClick={() => checkWithCode(code, "CHECK_IN")} style={{ ...keyStyle, height: 82, background: "#2563eb", border: "none", fontSize: 30, letterSpacing: 2 }}>입장</button>
          <button onClick={() => checkWithCode(code, "CHECK_OUT")} style={{ ...keyStyle, height: 82, background: "#f59e0b", border: "none", fontSize: 30, letterSpacing: 2 }}>퇴실</button>
        </div>

        <div style={{ marginTop: 20, color: "#475569", textAlign: "center", fontSize: 16 }}>
          회원번호 입력 후 출석 버튼을 눌러주세요
        </div>
      </div>
    </div>
  );
}
