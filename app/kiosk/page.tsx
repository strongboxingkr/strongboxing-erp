"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

export default function KioskPage() {
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("출석번호를 입력해주세요");
  const [member, setMember] = useState<any>(null);

  const checkinWithCode = async (inputCode: string) => {
    if (!inputCode.trim()) return;

    const res = await apiFetch("/api/check-in", {
      method: "POST",
      body: JSON.stringify({
        checkin_code: inputCode,
      }),
    });

    const data = await res.json();

    if (data.success) {
      setMember(data.member);
      setMessage(`${data.member.name}님 출석 완료! 🥊`);
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
    await checkinWithCode(code);
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
        checkinWithCode(qrCode);
      }, 300);
    }
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top, #172554 0%, #0f172a 45%, #020617 100%)",
        color: "#fff",
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
          background: "rgba(15, 23, 42, 0.92)",
          borderRadius: 34,
          padding: 44,
          boxShadow: "0 0 60px rgba(0,0,0,0.5)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 30 }}>
          <h1
            style={{
              fontSize: 58,
              margin: 0,
              fontWeight: 1000,
              letterSpacing: 2,
            }}
          >
            STRONG BOXING
          </h1>

          <p style={{ color: "#aaa", marginTop: 18, fontSize: 22 }}>
            회원 출석 키오스크
          </p>
        </div>

        <div
          style={{
            textAlign: "center",
            fontSize: 30,
            fontWeight: 900,
            marginBottom: 24,
          }}
        >
          {message}
          {member && (
            <div style={{ color: "#2ee59d", fontSize: 22, marginTop: 8 }}>
              {member.branch_name}
            </div>
          )}
        </div>

        <div
          style={{
            height: 88,
            borderRadius: 16,
            border: "2px solid #2ee59d",
            background: "#020617",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 42,
            fontWeight: 900,
            letterSpacing: 16,
            marginBottom: 26,
            boxShadow: "0 0 20px rgba(46,229,157,0.18)",
          }}
        >
          {code || <span style={{ color: "#334155" }}>----</span>}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 10,
            marginBottom: 24,
          }}
        >
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((n) => (
            <button
              key={n}
              onClick={() => pressNumber(n)}
              style={{
                height: 72,
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "#1f2937",
                color: "#fff",
                fontSize: 34,
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              {n}
            </button>
          ))}

          <button
            onClick={() => pressNumber("0")}
            style={{
              gridColumn: "1 / 3",
              height: 72,
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "#1f2937",
              color: "#fff",
              fontSize: 34,
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            0
          </button>

          <button
            onClick={backspace}
            style={{
              height: 72,
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "#1f2937",
              color: "#fff",
              fontSize: 28,
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            ⌫
          </button>
        </div>

        <button
          onClick={checkin}
          style={{
            width: "100%",
            height: 82,
            borderRadius: 16,
            border: 0,
            background: "#2ee59d",
            color: "#000",
            fontSize: 32,
            fontWeight: 1000,
            cursor: "pointer",
          }}
        >
          출석하기
        </button>

        <div
          style={{
            marginTop: 20,
            color: "#777",
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