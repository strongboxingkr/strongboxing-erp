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
      body: JSON.stringify({
      checkin_code: inputCode,
      check_type: type,
    }),
    });

    const data = await res.json();

    if (data.success) {
      setMember(data.member);
      setMessage(
        type === "CHECK_OUT"
          ? `${data.member.name}님 퇴실 완료! 👋`
          : `${data.member.name}님 입장 완료! 🥊`
      );
    } else {
      setMember(null);
      setMessage(data.message || "출석 실패");
    }

    setTimeout(() => {
      setCode("");
      setMember(null);
      setMessage("출석번호를 입력해주세요");
    }, 2500);
  };

  const checkin = async () => {
    await checkWithCode(code, "CHECK_IN");
  };

  const checkout = async () => {
    await checkWithCode(code, "CHECK_OUT");
  };

  const pressNumber = (num: string) => {
    if (code.length >= 4) return;
    setCode((prev) => prev + num);
  };

  const backspace = () => {
    setCode((prev) => prev.slice(0, -1));
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qrCode = params.get("code");

    if (qrCode) {
      setCode(qrCode);
      setTimeout(() => {
        checkWithCode(qrCode, "CHECK_IN");
      }, 300);
    }
  }, []);

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
          maxWidth: 760,
          background: "#ffffff",
          borderRadius: 34,
          padding: 44,
          boxShadow: "0 8px 40px rgba(37,99,235,0.12)",
          border: "1px solid #bfdbfe",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 30 }}>
          <h1
            style={{
              fontSize: 56,
              margin: 0,
              fontWeight: 900,
              letterSpacing: 4,
            }}
          >
            <span style={{ color: "#1e3a8a" }}>STRONG</span>{" "}
            <span style={{ color: "#2563eb" }}>BOXING</span>
          </h1>

          <p style={{ color: "#64748b", marginTop: 14, fontSize: 20 }}>
            회원 출석 키오스크
          </p>
        </div>

        <div
          style={{
            textAlign: "center",
            fontSize: 26,
            fontWeight: 900,
            marginBottom: 24,
            color: "#111827",
          }}
        >
          {message}
          {member && (
            <div style={{ color: "#2563eb", fontSize: 20, marginTop: 8 }}>
              {member.branch_name}
            </div>
          )}
        </div>

        <div
          style={{
            height: 88,
            borderRadius: 16,
            border: "2px solid #2563eb",
            background: "#f0f7ff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 42,
            fontWeight: 900,
            letterSpacing: 16,
            marginBottom: 26,
            color: "#1e3a8a",
          }}
        >
          {code || <span style={{ color: "#cbd5e1" }}>----</span>}
        </div>

        <style>{`
          .key-btn { transition: transform 0.08s, box-shadow 0.08s; }
          .key-btn:active { transform: scale(0.94); box-shadow: none !important; }
        `}</style>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((n) => (
            <button
              key={n}
              className="key-btn"
              onClick={() => pressNumber(n)}
              style={{
                height: 82,
                borderRadius: 18,
                border: "1px solid #e2e8f0",
                background: "linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)",
                color: "#1e3a8a",
                fontSize: 36,
                fontWeight: 900,
                cursor: "pointer",
                boxShadow: "0 4px 0 #cbd5e1",
              }}
            >
              {n}
            </button>
          ))}

          <button
            className="key-btn"
            onClick={() => pressNumber("0")}
            style={{
              gridColumn: "1 / 3",
              height: 82,
              borderRadius: 18,
              border: "1px solid #e2e8f0",
              background: "linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)",
              color: "#1e3a8a",
              fontSize: 36,
              fontWeight: 900,
              cursor: "pointer",
              boxShadow: "0 4px 0 #cbd5e1",
            }}
          >
            0
          </button>

          <button
            className="key-btn"
            onClick={backspace}
            style={{
              height: 82,
              borderRadius: 18,
              border: "1px solid #e2e8f0",
              background: "linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)",
              color: "#64748b",
              fontSize: 28,
              fontWeight: 900,
              cursor: "pointer",
              boxShadow: "0 4px 0 #cbd5e1",
            }}
          >
            ⌫
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <button
            className="key-btn"
            onClick={checkin}
            style={{
              width: "100%",
              height: 82,
              borderRadius: 18,
              border: 0,
              background: "linear-gradient(180deg, #3b82f6 0%, #1d4ed8 100%)",
              color: "#fff",
              fontSize: 28,
              fontWeight: 900,
              cursor: "pointer",
              boxShadow: "0 4px 0 #1e40af",
              letterSpacing: 2,
            }}
          >
            입장
          </button>

          <button
            className="key-btn"
            onClick={checkout}
            style={{
              width: "100%",
              height: 82,
              borderRadius: 18,
              border: 0,
              background: "linear-gradient(180deg, #fbbf24 0%, #d97706 100%)",
              color: "#fff",
              fontSize: 28,
              fontWeight: 900,
              cursor: "pointer",
              boxShadow: "0 4px 0 #b45309",
              letterSpacing: 2,
            }}
          >
            퇴실
          </button>
        </div>

        <div
          style={{
            marginTop: 20,
            color: "#94a3b8",
            textAlign: "center",
            fontSize: 16,
          }}
        >
          회원번호 입력 후 출석 버튼을 눌러주세요
        </div>
      </div>
    </div>
  );
}
