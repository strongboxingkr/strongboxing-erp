"use client";

import { useState, useEffect } from "react";

export default function CheckInPage() {
  const [phone, setPhone] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [branchName, setBranchName] = useState("");

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem("user") || "{}");
      if (u.branch_name) setBranchName(u.branch_name);
    } catch {}
  }, []);

  const press = (value: string) => {
    if (result) { setResult(null); }
    if (value === "back") { setPhone((p) => p.slice(0, -1)); return; }
    if (phone.length < 4) setPhone((p) => p + value);
  };

  const submit = async (checkType: "CHECK_IN" | "CHECK_OUT") => {
    if (phone.length !== 4 || loading) return;
    setLoading(true);
    const res = await fetch("/api/check-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone_last4: phone, check_type: checkType, branch_name: branchName || undefined }),
    });
    const data = await res.json();
    setResult({ ...data, checkType });
    setLoading(false);
    setTimeout(() => { setPhone(""); setResult(null); }, 4000);
  };

  const digits = Array.from({ length: 4 }, (_, i) => phone[i] || null);
  const isSuccess = result?.success === true;

  return (
    <>
    <style>{`@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@1,800;1,900&display=swap');`}</style>
    <div style={{
      minHeight: "100vh",
      background: "#fff",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      fontFamily: "-apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif",
      padding: "40px 24px 0",
      maxWidth: 480,
      margin: "0 auto",
    }}>

      {/* 타이틀 */}
      <div style={{ textAlign: "center", marginBottom: 8 }}>
        <div style={{
          fontSize: "clamp(44px, 12vw, 64px)",
          fontWeight: 900,
          color: "#c0392b",
          letterSpacing: 2,
          lineHeight: 1,
          fontStyle: "italic",
          fontFamily: "'Barlow Condensed', Impact, Arial Narrow, sans-serif",
          textTransform: "uppercase",
          whiteSpace: "nowrap",
        }}>
          STRONG BOXING
        </div>
        <div style={{ fontSize: 16, color: "#888", marginTop: 6, letterSpacing: 2 }}>
          출석 체크
        </div>
      </div>

      {/* 결과 표시 */}
      {result ? (
        <div style={{
          width: "100%",
          marginTop: 32,
          padding: "32px 24px",
          borderRadius: 20,
          textAlign: "center",
          background: isSuccess ? "#e8faf3" : "#fff0f0",
          border: `2px solid ${isSuccess ? "#30d158" : "#ff3b30"}`,
        }}>
          <div style={{ fontSize: 36, fontWeight: 900, color: isSuccess ? "#30d158" : "#ff3b30" }}>
            {result.message}
          </div>
          {result.member && (
            <div style={{ marginTop: 16, textAlign: "left" }}>
              {/* 회원명 크게 */}
              <div style={{ fontSize: 32, fontWeight: 900, color: "#1c1c1e", textAlign: "center", marginBottom: 16 }}>
                {result.member.name}
              </div>
              {/* 상세 정보 */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 15 }}>
                <div style={{ background: "#f2f2f7", borderRadius: 10, padding: "10px 14px" }}>
                  <div style={{ color: "#888", fontSize: 12, marginBottom: 4 }}>회원권</div>
                  <div style={{ fontWeight: 700 }}>{result.member.product_name || "-"}</div>
                </div>
                <div style={{ background: "#f2f2f7", borderRadius: 10, padding: "10px 14px" }}>
                  <div style={{ color: "#888", fontSize: 12, marginBottom: 4 }}>사용기간</div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>
                    {result.member.start_date?.slice(0, 10)} ~ {result.member.end_date?.slice(0, 10)}
                  </div>
                </div>
                <div style={{ background: result.result === "EXPIRED" ? "#fff0f0" : "#f2f2f7", borderRadius: 10, padding: "10px 14px" }}>
                  <div style={{ color: "#888", fontSize: 12, marginBottom: 4 }}>잔여</div>
                  <div style={{ fontWeight: 900, color: result.result === "EXPIRED" ? "#ff3b30" : "#1c1c1e" }}>
                    {result.result === "EXPIRED" ? "만료" : result.member.remaining_count}
                  </div>
                </div>
                <div style={{ background: "#f2f2f7", borderRadius: 10, padding: "10px 14px", display: "flex", gap: 16, alignItems: "center" }}>
                  <div>
                    <div style={{ color: "#888", fontSize: 12, marginBottom: 4 }}>운동복</div>
                    <div style={{ fontWeight: 900, fontSize: 18, color: result.member.has_uniform ? "#30d158" : "#c7c7cc" }}>
                      {result.member.has_uniform ? "O" : "X"}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: "#888", fontSize: 12, marginBottom: 4 }}>락카</div>
                    <div style={{ fontWeight: 900, fontSize: 18, color: result.member.has_locker ? "#30d158" : "#c7c7cc" }}>
                      {result.member.has_locker ? (result.member.locker_no || "O") : "X"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* 안내 텍스트 */}
          <div style={{ fontSize: 22, fontWeight: 800, color: "#1c1c1e", margin: "28px 0 20px", textAlign: "center" }}>
            전화번호 뒤 4자리를 입력해 주세요
          </div>

          {/* 숫자 표시 */}
          <div style={{
            width: "100%",
            border: "1.5px solid #d1d1d6",
            borderRadius: 14,
            padding: "20px 24px",
            marginBottom: 20,
            display: "flex",
            justifyContent: "center",
            gap: 32,
          }}>
            {digits.map((d, i) => (
              <div key={i} style={{
                width: 44,
                textAlign: "center",
                fontSize: 32,
                fontWeight: 900,
                color: "#1c1c1e",
                borderBottom: `3px solid ${d ? "#1c1c1e" : "#c7c7cc"}`,
                paddingBottom: 4,
              }}>
                {d ? "●" : ""}
              </div>
            ))}
          </div>

          {/* 키패드 */}
          <div style={{ width: "100%", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {["1","2","3","4","5","6","7","8","9"].map((n) => (
              <button key={n} onClick={() => press(n)} style={keyStyle}>{n}</button>
            ))}
            <button onClick={() => press("back")} style={keyStyle}>←</button>
            <button onClick={() => press("0")} style={keyStyle}>0</button>
            <button
              onClick={() => submit("CHECK_IN")}
              disabled={phone.length !== 4 || loading}
              style={{
                ...keyStyle,
                background: phone.length === 4 ? "#c0392b" : "#e0e0e0",
                color: "#fff",
                border: "none",
                fontWeight: 900,
              }}
            >
              확인
            </button>
          </div>

          <div style={{ fontSize: 13, color: "#8e8e93", margin: "16px 0" }}>
            번호 입력 후 확인을 눌러주세요
          </div>
        </>
      )}

      {/* 퇴장하기 버튼 - 항상 하단 */}
      <div style={{ width: "100%", marginTop: "auto", paddingBottom: 32, paddingTop: 16 }}>
        <button
          onClick={() => submit("CHECK_OUT")}
          disabled={phone.length !== 4 || loading}
          style={{
            width: "100%",
            padding: "22px 0",
            borderRadius: 16,
            fontSize: 22,
            fontWeight: 800,
            border: "none",
            cursor: phone.length === 4 ? "pointer" : "not-allowed",
            background: phone.length === 4 ? "#1c1c1e" : "#c0c0c0",
            color: "#fff",
            letterSpacing: 1,
          }}
        >
          퇴장하기
        </button>
      </div>
    </div>
    </>
  );
}

const keyStyle: React.CSSProperties = {
  padding: "22px 0",
  borderRadius: 12,
  fontSize: 28,
  fontWeight: 700,
  border: "1.5px solid #d1d1d6",
  background: "#fff",
  cursor: "pointer",
  color: "#1c1c1e",
  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
};
