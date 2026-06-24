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

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0a0a",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
      fontFamily: "'Arial Black', 'Impact', sans-serif",
    }}>
      <style>{`
        .key { transition: all 0.07s; }
        .key:active { transform: translateY(2px); filter: brightness(0.85); }
      `}</style>

      {/* 로고 */}
      <div style={{ marginBottom: 32, textAlign: "center" }}>
<div style={{ fontSize: 52, fontWeight: 900, color: "#fff", letterSpacing: 6, lineHeight: 1 }}>
          STRONG
        </div>
        <div style={{ fontSize: 52, fontWeight: 900, color: "#ef4444", letterSpacing: 6, lineHeight: 1 }}>
          BOXING
        </div>
      </div>

      {/* 카드 */}
      <div style={{
        width: "100%",
        maxWidth: 420,
        background: "#141414",
        borderRadius: 24,
        border: "1px solid #222",
        overflow: "hidden",
      }}>
        {/* 상단 안내 */}
        <div style={{ background: "#ef4444", padding: "14px 20px", textAlign: "center", fontSize: 15, fontWeight: 700, letterSpacing: 2, color: "#fff", fontFamily: "sans-serif" }}>
          전화번호 뒤 4자리 입력
        </div>

        <div style={{ padding: "24px 20px 20px" }}>
          {/* 디스플레이 */}
          <div style={{
            background: "#0a0a0a",
            border: "2px solid #333",
            borderRadius: 12,
            height: 72,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 44,
            fontWeight: 900,
            letterSpacing: 14,
            marginBottom: 16,
            color: "#ef4444",
          }}>
            {phone || <span style={{ color: "#2a2a2a", fontSize: 36 }}>_ _ _ _</span>}
          </div>

          {/* 결과 */}
          {result && (
            <div style={{
              marginBottom: 16,
              padding: "16px 20px",
              borderRadius: 12,
              background: isSuccess ? "#052e16" : "#1c0a0a",
              border: isSuccess ? "1px solid #22c55e" : "1px solid #ef4444",
              color: isSuccess ? "#22c55e" : "#ef4444",
              textAlign: "center",
              fontSize: 20,
              fontWeight: 700,
              fontFamily: "sans-serif",
            }}>
              {result.message}
              {result.member && (
                <div style={{ marginTop: 8, fontSize: 14, color: "#9ca3af" }}>
                  {result.member.name} · {result.member.product_name} · 잔여 {result.member.remaining_count}회
                </div>
              )}
            </div>
          )}

          {/* 키패드 */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 10 }}>
            {["1","2","3","4","5","6","7","8","9"].map((n) => (
              <button key={n} className="key" onClick={() => press(n)} style={{
                height: 72,
                borderRadius: 12,
                border: "1px solid #2a2a2a",
                background: "#1e1e1e",
                color: "#fff",
                fontSize: 30,
                fontWeight: 900,
                cursor: "pointer",
              }}>{n}</button>
            ))}
            <button className="key" onClick={() => press("back")} style={{
              height: 72, borderRadius: 12, border: "1px solid #2a2a2a", background: "#1e1e1e", color: "#666", fontSize: 22, fontWeight: 900, cursor: "pointer"
            }}>⌫</button>
            <button className="key" onClick={() => press("0")} style={{
              height: 72, borderRadius: 12, border: "1px solid #2a2a2a", background: "#1e1e1e", color: "#fff", fontSize: 30, fontWeight: 900, cursor: "pointer"
            }}>0</button>
            <button className="key" onClick={() => submitCheckIn("CHECK_IN")} style={{
              height: 72, borderRadius: 12, border: "none", background: "#ef4444", color: "#fff", fontSize: 22, fontWeight: 900, cursor: "pointer", letterSpacing: 2
            }}>입장</button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <button className="key" onClick={() => press("clear")} style={{
              height: 52, borderRadius: 12, border: "1px solid #2a2a2a", background: "#1e1e1e", color: "#555", fontSize: 16, fontWeight: 700, cursor: "pointer", fontFamily: "sans-serif"
            }}>초기화</button>
            <button className="key" onClick={() => submitCheckIn("CHECK_OUT")} style={{
              height: 52, borderRadius: 12, border: "1px solid #2a2a2a", background: "#1e1e1e", color: "#888", fontSize: 16, fontWeight: 700, cursor: "pointer", fontFamily: "sans-serif"
            }}>운동 종료</button>
          </div>
        </div>
      </div>
    </div>
  );
}
