"use client";

import { useState } from "react";

export default function CheckInPage() {
  const [phone, setPhone] = useState("");
  const [result, setResult] = useState<any>(null);

  const press = (value: string) => {
    if (value === "clear") { setPhone(""); setResult(null); return; }
    if (value === "back") { setPhone((prev) => prev.slice(0, -1)); return; }
    if (phone.length < 4) setPhone((prev) => prev + value);
  };

  const submitCheckIn = async (type: "CHECK_IN" | "CHECK_OUT") => {
    if (phone.length !== 4) return;
    const res = await fetch("/api/check-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone_last4: phone, check_type: type }),
    });
    const data = await res.json();
    setResult(data);
    setTimeout(() => { setPhone(""); setResult(null); }, 3000);
  };

  const isSuccess = result?.success === true;

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
      <div style={{ width: "100%", maxWidth: 680, background: "rgba(15,23,42,0.95)", borderRadius: 34, padding: "44px 40px", boxShadow: "0 0 60px rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.06)" }}>

        {/* 헤더 */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <h1 style={{ fontSize: 54, margin: 0, fontWeight: 900, letterSpacing: 4 }}>
            <span style={{ color: "#fff" }}>STRONG</span>{" "}
            <span style={{ color: "#2563eb" }}>BOXING</span>
          </h1>
          <p style={{ color: "#64748b", marginTop: 10, fontSize: 20 }}>전화번호 뒤 4자리를 입력해주세요</p>
        </div>

        {/* 디스플레이 */}
        <div style={{ height: 82, borderRadius: 16, border: "2px solid #2ee59d", background: "#020617", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 42, fontWeight: 900, letterSpacing: 16, marginBottom: 20, boxShadow: "0 0 20px rgba(46,229,157,0.15)" }}>
          {phone || <span style={{ color: "#334155" }}>____</span>}
        </div>

        {/* 결과 */}
        {result && (
          <div style={{ marginBottom: 20, padding: 24, borderRadius: 16, fontSize: 30, fontWeight: 900, background: isSuccess ? "rgba(46,229,157,.15)" : "rgba(255,32,78,.18)", border: isSuccess ? "2px solid #2ee59d" : "2px solid #ff204e", color: isSuccess ? "#2ee59d" : "#ff204e", textAlign: "center" }}>
            <div>{result.message}</div>
            {result.member && (
              <div style={{ marginTop: 12, fontSize: 18, color: "#cbd5e1" }}>
                {result.member.name} / {result.member.product_name} / 남은횟수 {result.member.remaining_count}
              </div>
            )}
          </div>
        )}

        {/* 키패드 */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 12 }}>
          {["1","2","3","4","5","6","7","8","9"].map((n) => (
            <button key={n} onClick={() => press(n)} style={keyStyle}>{n}</button>
          ))}
          <button onClick={() => press("back")} style={{ ...keyStyle, fontSize: 26, color: "#94a3b8" }}>⌫</button>
          <button onClick={() => press("0")} style={keyStyle}>0</button>
          <button onClick={() => submitCheckIn("CHECK_IN")} style={{ ...keyStyle, background: "#ff2d55", border: "none", fontSize: 28, letterSpacing: 2 }}>입장</button>
        </div>

        <button onClick={() => press("clear")} style={{ ...keyStyle, width: "100%", height: 60, fontSize: 20, marginBottom: 10, color: "#94a3b8" }}>초기화</button>
        <button onClick={() => submitCheckIn("CHECK_OUT")} style={{ ...keyStyle, width: "100%", height: 52, fontSize: 18, color: "#94a3b8" }}>운동 종료</button>
      </div>
    </div>
  );
}
