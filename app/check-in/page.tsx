"use client";

import { useState } from "react";

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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone_last4: phone, check_type: type }),
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
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #eff6ff 0%, #dbeafe 50%, #e0e7ff 100%)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 680,
          background: "#ffffff",
          borderRadius: 34,
          padding: "44px 40px",
          boxShadow: "0 8px 40px rgba(37,99,235,0.12)",
          border: "1px solid #bfdbfe",
        }}
      >
        {/* 헤더 */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <h1 style={{ fontSize: 56, margin: 0, fontWeight: 900, letterSpacing: 4, color: "#1e3a8a", textTransform: "uppercase" }}>
            <span style={{ color: "#1e3a8a" }}>STRONG</span>{" "}
            <span style={{ color: "#2563eb" }}>BOXING</span>
          </h1>
          <p style={{ color: "#64748b", marginTop: 10, fontSize: 20 }}>
            전화번호 뒤 4자리를 입력해주세요
          </p>
        </div>

        {/* 입력 디스플레이 */}
        <div
          style={{
            height: 82,
            borderRadius: 16,
            border: "2px solid #2563eb",
            background: "#f0f7ff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 40,
            fontWeight: 900,
            letterSpacing: 14,
            marginBottom: 20,
            color: "#1e3a8a",
          }}
        >
          {phone || <span style={{ color: "#cbd5e1" }}>____</span>}
        </div>

        {/* 결과 메시지 */}
        {result && (
          <div
            style={{
              marginBottom: 20,
              padding: 24,
              borderRadius: 16,
              fontSize: 32,
              fontWeight: 900,
              background: isSuccess ? "#f0fdf4" : "#fff1f2",
              border: isSuccess ? "2px solid #22c55e" : "2px solid #f43f5e",
              color: isSuccess ? "#16a34a" : "#e11d48",
              textAlign: "center",
            }}
          >
            <div>{result.message}</div>
            {result.member && (
              <div style={{ marginTop: 12, fontSize: 20, color: "#374151" }}>
                {result.member.name} / {result.member.product_name} / 남은횟수 {result.member.remaining_count}
              </div>
            )}
          </div>
        )}

        {/* 키패드 */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 10,
            marginBottom: 12,
          }}
        >
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((n) => (
            <button
              key={n}
              onClick={() => press(n)}
              style={{
                height: 78,
                borderRadius: 14,
                border: "1px solid #e5e7eb",
                background: "#f8f9fb",
                color: "#111827",
                fontSize: 34,
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              {n}
            </button>
          ))}

          <button
            onClick={() => press("back")}
            style={{
              height: 78,
              borderRadius: 14,
              border: "1px solid #e5e7eb",
              background: "#f8f9fb",
              color: "#111827",
              fontSize: 28,
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            ⌫
          </button>

          <button
            onClick={() => press("0")}
            style={{
              height: 78,
              borderRadius: 14,
              border: "1px solid #e5e7eb",
              background: "#f8f9fb",
              color: "#111827",
              fontSize: 34,
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            0
          </button>

          <button
            onClick={() => submitCheckIn("CHECK_IN")}
            style={{
              height: 78,
              borderRadius: 14,
              border: 0,
              background: "#2563eb",
              color: "#fff",
              fontSize: 30,
              fontWeight: 1000,
              cursor: "pointer",
            }}
          >
            입장
          </button>
        </div>

        {/* 초기화 */}
        <button
          onClick={() => press("clear")}
          style={{
            width: "100%",
            height: 62,
            borderRadius: 14,
            border: "1px solid #e5e7eb",
            background: "#f8f9fb",
            color: "#374151",
            fontSize: 22,
            fontWeight: 700,
            cursor: "pointer",
            marginBottom: 10,
          }}
        >
          초기화
        </button>

        {/* 운동 종료 */}
        <button
          onClick={() => submitCheckIn("CHECK_OUT")}
          style={{
            width: "100%",
            height: 54,
            borderRadius: 14,
            border: "1px solid #fde68a",
            background: "#fffbeb",
            color: "#92400e",
            fontSize: 18,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          운동 종료
        </button>
      </div>
    </div>
  );
}
