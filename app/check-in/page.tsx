"use client";

import { useState, useEffect } from "react";

export default function CheckInPage() {
  const [phone, setPhone] = useState("");
  const [result, setResult] = useState<any>(null);

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

    if (phone.length < 4) {
      setPhone((prev) => prev + value);
    }
  };

  const submitCheckIn = async (type: "CHECK_IN" | "CHECK_OUT") => {
    if (phone.length !== 4) return;

    const res = await fetch("/api/check-in", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        phone_last4: phone,
        check_type: type,
      }),
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
        <div className="kiosk-title">STRONG BOXING</div>
        <p style={{ fontSize: 28, color: "#aaa" }}>전화번호 뒤 4자리를 입력해주세요</p>

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

          <button
            className="key confirm"
            style={{
              background: "#ff2d55",
              fontSize: 32,
              fontWeight: 900,
            }}
            onClick={() => submitCheckIn("CHECK_IN")}
          >
            입장
          </button>

          <button className="key" style={{ gridColumn: "1 / 4" }} onClick={() => press("clear")}>
            초기화
          </button>

          <button
            onClick={() => submitCheckIn("CHECK_OUT")}
            style={{
              marginTop: 12,
              width: "100%",
              height: 52,
              borderRadius: 12,
              border: "1px solid #374151",
              background: "#111827",
              color: "#9ca3af",
              fontSize: 18,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            운동 종료
          </button>

        </div>
      </div>
    </div>
  );
}