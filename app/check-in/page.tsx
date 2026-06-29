"use client";

import { useState, useEffect } from "react";

export default function CheckInPage() {
  const [phone, setPhone] = useState("");
  const [result, setResult] = useState<any>(null);
  const [mode, setMode] = useState<"CHECK_IN" | "CHECK_OUT">("CHECK_IN");

  const press = (value: string) => {
    if (value === "clear") {
      setPhone("");
      setResult(null);
      return;
    }

    if (value === "back") {
      setPhone((prev) => prev.slice(0, -1));
      return;
    }

    if (value === "ok") {
      submitCheckIn();
      return;
    }

    if (phone.length < 4) {
      setPhone((prev) => prev + value);
    }
  };

  const submitOnMode = async (checkMode: "CHECK_IN" | "CHECK_OUT") => {
    if (phone.length !== 4) return;
    const res = await fetch("/api/check-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone_last4: phone, check_type: checkMode }),
    });
    const data = await res.json();
    setResult(data);
    setTimeout(() => { setPhone(""); setResult(null); }, 3000);
  };

  const submitCheckIn = async () => {
    if (phone.length !== 4) return;

    const res = await fetch("/api/check-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone_last4: phone, check_type: mode }),
    });

    const data = await res.json();
    setResult(data);

    setTimeout(() => {
      setPhone("");
      setResult(null);
    }, 3000);
  };

  const isSuccess = result?.success === true;

  return (
    <div className="kiosk">
      <div className="kiosk-box">
        <div className="kiosk-title">STRONG <span>BOXING</span></div>

        <div className="kiosk-subtitle">전화번호 뒤 4자리를 입력해주세요</div>

        <div className="phone-display">
          {phone || "____"}
        </div>

        {result && (
          <div
            style={{
              marginBottom: 24,
              padding: 30,
              borderRadius: 24,
              fontSize: 42,
              fontWeight: 900,
              background: isSuccess ? "rgba(46,229,157,.15)" : "rgba(255,32,78,.18)",
              border: isSuccess ? "2px solid #2ee59d" : "2px solid #ff204e",
              color: isSuccess ? "#2ee59d" : "#ff204e",
            }}
          >
            <div>{result.message}</div>
            {result.member && (
              <div style={{ marginTop: 16, fontSize: 28, color: "white" }}>
                {result.member.name} / {result.member.product_name} / 남은횟수 {result.member.remaining_count}
              </div>
            )}
          </div>
        )}

        <div className="keypad">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((n) => (
            <button className="key" key={n} onClick={() => press(n)}>
              {n}
            </button>
          ))}

          <button className="key" onClick={() => press("back")}>←</button>
          <button className="key" onClick={() => press("0")}>0</button>
          <button className="key confirm" onClick={() => press("ok")}>확인</button>

          <button className="key" style={{ gridColumn: "1 / 4" }} onClick={() => press("clear")}>
            초기화
          </button>
        </div>

        {/* 입장/퇴장 버튼 */}
        <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
          <button
            onClick={() => { setMode("CHECK_IN"); setPhone(""); setResult(null); submitOnMode("CHECK_IN"); }}
            style={{
              flex: 1, padding: "18px 0", borderRadius: 16, fontSize: 20, fontWeight: 900, border: "none", cursor: "pointer",
              background: mode === "CHECK_IN" ? "#38bdf8" : "#1e293b",
              color: mode === "CHECK_IN" ? "#0f172a" : "#64748b",
            }}
          >입장</button>
          <button
            onClick={() => { setMode("CHECK_OUT"); setPhone(""); setResult(null); submitOnMode("CHECK_OUT"); }}
            style={{
              flex: 1, padding: "18px 0", borderRadius: 16, fontSize: 20, fontWeight: 900, border: "none", cursor: "pointer",
              background: mode === "CHECK_OUT" ? "#f97316" : "#1e293b",
              color: mode === "CHECK_OUT" ? "#fff" : "#64748b",
            }}
          >퇴장</button>
        </div>
      </div>
    </div>
  );
}