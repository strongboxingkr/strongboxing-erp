"use client";

import { useState } from "react";

export default function CheckInPage() {
  const [phone, setPhone] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const press = (value: string) => {
    if (result) { setResult(null); }
    if (value === "clear") { setPhone(""); return; }
    if (value === "back") { setPhone((p) => p.slice(0, -1)); return; }
    if (phone.length < 4) setPhone((p) => p + value);
  };

  const submit = async (checkType: "CHECK_IN" | "CHECK_OUT") => {
    if (phone.length !== 4) return;
    setLoading(true);
    const res = await fetch("/api/check-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone_last4: phone, check_type: checkType }),
    });
    const data = await res.json();
    setResult(data);
    setLoading(false);
    setTimeout(() => { setPhone(""); setResult(null); }, 4000);
  };

  const digits = Array.from({ length: 4 }, (_, i) => phone[i] || null);
  const isSuccess = result?.success === true;

  return (
    <div style={{
      minHeight: "100vh",
      background: "#f2f2f7",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "-apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif",
    }}>
      <div style={{ width: "100%", maxWidth: 480, padding: "32px 24px" }}>

        {/* 타이틀 */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 36, fontWeight: 900, letterSpacing: 2, color: "#1c1c1e" }}>
            STRONG BOXING
          </div>
          <div style={{ fontSize: 14, color: "#8e8e93", marginTop: 4, letterSpacing: 1 }}>
            ── 출석 체크 ──
          </div>
        </div>

        {/* 결과 표시 */}
        {result ? (
          <div style={{
            marginBottom: 28,
            padding: "28px 24px",
            borderRadius: 20,
            textAlign: "center",
            background: isSuccess ? "#e8faf3" : "#fff0f0",
            border: `2px solid ${isSuccess ? "#30d158" : "#ff3b30"}`,
          }}>
            <div style={{ fontSize: 38, fontWeight: 900, color: isSuccess ? "#30d158" : "#ff3b30" }}>
              {result.message}
            </div>
            {result.member && (
              <div style={{ marginTop: 12, fontSize: 20, color: "#1c1c1e", fontWeight: 600 }}>
                {result.member.name} · {result.member.product_name}
                <div style={{ fontSize: 15, color: "#636366", marginTop: 4, fontWeight: 400 }}>
                  {result.member.pass_type === "COUNT"
                    ? `남은횟수 ${result.member.remaining_count}`
                    : `남은일수 ${result.member.remaining_count}`}
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* 안내 텍스트 */}
            <div style={{ textAlign: "center", fontSize: 22, fontWeight: 700, color: "#1c1c1e", marginBottom: 20 }}>
              전화번호 뒤 4자리를 입력해 주세요
            </div>

            {/* 숫자 표시 */}
            <div style={{
              background: "#fff",
              border: "1.5px solid #d1d1d6",
              borderRadius: 16,
              padding: "22px 24px",
              marginBottom: 20,
              display: "flex",
              justifyContent: "center",
              gap: 28,
            }}>
              {digits.map((d, i) => (
                <div key={i} style={{
                  width: 48,
                  textAlign: "center",
                  fontSize: 36,
                  fontWeight: 900,
                  color: "#1c1c1e",
                  borderBottom: `3px solid ${d ? "#1c1c1e" : "#c7c7cc"}`,
                  paddingBottom: 4,
                }}>
                  {d ? "●" : ""}
                </div>
              ))}
            </div>
          </>
        )}

        {/* 키패드 */}
        {!result && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
            {["1","2","3","4","5","6","7","8","9"].map((n) => (
              <button key={n} onClick={() => press(n)} style={keyStyle}>
                {n}
              </button>
            ))}
            <button onClick={() => press("back")} style={keyStyle}>←</button>
            <button onClick={() => press("0")} style={keyStyle}>0</button>
            <button onClick={() => press("clear")} style={keyStyle}>전체 지우기</button>
          </div>
        )}

        {/* 확인 / 퇴장하기 */}
        {!result && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <button
              onClick={() => submit("CHECK_IN")}
              disabled={phone.length !== 4 || loading}
              style={{
                padding: "22px 0",
                borderRadius: 16,
                fontSize: 22,
                fontWeight: 800,
                border: "none",
                cursor: phone.length === 4 ? "pointer" : "not-allowed",
                background: phone.length === 4 ? "#c0392b" : "#e0e0e0",
                color: "#fff",
                letterSpacing: 1,
              }}
            >
              확인
            </button>
            <button
              onClick={() => submit("CHECK_OUT")}
              disabled={phone.length !== 4 || loading}
              style={{
                padding: "22px 0",
                borderRadius: 16,
                fontSize: 22,
                fontWeight: 800,
                border: "none",
                cursor: phone.length === 4 ? "pointer" : "not-allowed",
                background: phone.length === 4 ? "#1c1c1e" : "#e0e0e0",
                color: "#fff",
                letterSpacing: 1,
              }}
            >
              퇴장하기
            </button>
          </div>
        )}

        <div style={{ textAlign: "center", fontSize: 13, color: "#8e8e93" }}>
          번호 입력 후 확인 또는 퇴장하기를 눌러주세요
        </div>
      </div>
    </div>
  );
}

const keyStyle: React.CSSProperties = {
  padding: "20px 0",
  borderRadius: 14,
  fontSize: 26,
  fontWeight: 700,
  border: "1.5px solid #d1d1d6",
  background: "#fff",
  cursor: "pointer",
  color: "#1c1c1e",
  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
  transition: "background 0.1s",
};
