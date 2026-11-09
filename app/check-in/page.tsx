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
    if (phone.length < 8) setPhone((p) => p + value);
  };

  const submit = async (checkType: "CHECK_IN" | "CHECK_OUT", usePass?: "REGULAR" | "DAILY") => {
    if (phone.length < 1 || phone.length > 8 || loading) return;
    setLoading(true);
    const body: any = { phone_last4: phone, check_type: checkType, branch_name: branchName || undefined };
    if (usePass) body.use_pass = usePass;
    const res = await fetch("/api/check-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setResult({ ...data, checkType });
    setLoading(false);
    if (data.result !== "MULTIPLE_PASSES") {
      setTimeout(() => { setPhone(""); setResult(null); }, 4000);
    }
  };

  // 가변 길이: 현재 입력 길이에 맞춰 최소 1칸, 최대 8칸 표시
  const displayLen = Math.max(phone.length + (phone.length < 8 ? 1 : 0), 1);
  const digits = Array.from({ length: displayLen }, (_, i) => phone[i] || null);
  const isSuccess = result?.success === true;

  return (
    <>
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');
      html, body { margin: 0; padding: 0; background: #fff; height: 100%; }
    `}</style>
    <div style={{
      height: "100dvh",
      background: "#fff",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "-apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif",
      padding: "0 24px",
      boxSizing: "border-box",
      overflow: "hidden",
      width: "100%",
    }}>

      <div style={{ width: "100%", maxWidth: 480, display: "flex", flexDirection: "column", alignItems: "center" }}>
      {/* 타이틀 */}
      <div style={{ textAlign: "center", marginBottom: "clamp(8px, 2vh, 20px)" }}>
        <div style={{
          fontSize: "clamp(48px, 10vw, 80px)",
          fontWeight: 400,
          color: "#c0392b",
          letterSpacing: 3,
          lineHeight: 1,
          fontFamily: "'Bebas Neue', Impact, 'Arial Black', sans-serif",
          textTransform: "uppercase",
          whiteSpace: "nowrap",
        }}>
          STRONG BOXING
        </div>
        <div style={{ fontSize: "clamp(13px, 2vw, 16px)", color: "#888", marginTop: 6, letterSpacing: 2 }}>
          출석 체크
        </div>
      </div>

      {/* 결과 표시 */}
      {result?.result === "MULTIPLE_PASSES" ? (
        <div style={{
          width: "100%",
          marginTop: 24,
          padding: "24px 20px",
          borderRadius: 20,
          background: "#fff9ec",
          border: "2px solid #ff9500",
        }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: "#ff9500", textAlign: "center", marginBottom: 8 }}>
            이용권을 선택해주세요
          </div>
          <div style={{ fontSize: 15, color: "#1c1c1e", textAlign: "center", marginBottom: 20 }}>
            {result.member?.name}님
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* 정기권 */}
            <button
              onClick={() => submit("CHECK_IN", "REGULAR")}
              style={{
                padding: "16px 20px",
                borderRadius: 14,
                border: "2px solid #007aff",
                background: "#f0f5ff",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <div style={{ fontSize: 13, color: "#007aff", fontWeight: 700, marginBottom: 4 }}>정기 회원권</div>
              <div style={{ fontSize: 16, fontWeight: 900, color: "#1c1c1e" }}>{result.regular_pass?.product_name || "-"}</div>
              <div style={{ fontSize: 13, color: "#666", marginTop: 4 }}>
                {result.regular_pass?.pass_type === "COUNT"
                  ? `잔여 ${result.regular_pass?.remaining_count}회`
                  : `만료일 ${result.regular_pass?.end_date || "-"}`}
              </div>
            </button>
            {/* 일일권 */}
            <button
              onClick={() => submit("CHECK_IN", "DAILY")}
              style={{
                padding: "16px 20px",
                borderRadius: 14,
                border: "2px solid #c0392b",
                background: "#fff0f0",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <div style={{ fontSize: 13, color: "#c0392b", fontWeight: 700, marginBottom: 4 }}>일일권</div>
              <div style={{ fontSize: 16, fontWeight: 900, color: "#1c1c1e" }}>이용일: {result.day_pass?.use_date || "-"}</div>
            </button>
          </div>
          <button
            onClick={() => { setPhone(""); setResult(null); }}
            style={{ marginTop: 16, width: "100%", padding: "12px 0", borderRadius: 12, border: "1.5px solid #d1d1d6", background: "#f2f2f7", fontSize: 15, fontWeight: 700, cursor: "pointer", color: "#1c1c1e" }}
          >
            취소
          </button>
        </div>
      ) : result ? (
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
          <div style={{ fontSize: "clamp(16px, 3.5vw, 22px)", fontWeight: 800, color: "#1c1c1e", margin: "clamp(12px, 2vh, 28px) 0 clamp(10px, 1.5vh, 20px)", textAlign: "center" }}>
            출석번호를 입력 후 확인을 눌러주세요
          </div>

          {/* 숫자 표시 */}
          <div style={{
            width: "100%",
            border: "1.5px solid #d1d1d6",
            borderRadius: 14,
            padding: "clamp(12px, 2vh, 20px) 24px",
            marginBottom: "clamp(10px, 1.5vh, 20px)",
            display: "flex",
            justifyContent: "center",
            gap: "clamp(16px, 5vw, 32px)",
          }}>
            {digits.map((d, i) => (
              <div key={i} style={{
                width: "clamp(32px, 8vw, 44px)",
                textAlign: "center",
                fontSize: "clamp(22px, 5vw, 32px)",
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
          <div style={{ width: "100%", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "clamp(6px, 1.2vw, 10px)" }}>
            {["1","2","3","4","5","6","7","8","9"].map((n) => (
              <button key={n} onClick={() => press(n)} style={keyStyle}>{n}</button>
            ))}
            <button onClick={() => press("back")} style={keyStyle}>←</button>
            <button onClick={() => press("0")} style={keyStyle}>0</button>
            <button
              onClick={() => submit("CHECK_IN")}
              disabled={phone.length < 1 || loading}
              style={{
                ...keyStyle,
                background: phone.length >= 1 ? "#c0392b" : "#e0e0e0",
                color: "#fff",
                border: "none",
                fontWeight: 900,
              }}
            >
              확인
            </button>
          </div>

          <div style={{ fontSize: "clamp(11px, 1.5vw, 13px)", color: "#8e8e93", margin: "clamp(8px, 1.5vh, 16px) 0" }}>
            번호 입력 후 확인을 눌러주세요
          </div>
        </>
      )}

      {/* 퇴장하기 버튼 */}
      <div style={{ width: "100%", marginTop: "clamp(10px, 2vh, 24px)" }}>
        <button
          onClick={() => submit("CHECK_OUT")}
          disabled={phone.length < 1 || loading}
          style={{
            width: "100%",
            padding: "clamp(14px, 2.5vh, 22px) 0",
            borderRadius: 16,
            fontSize: "clamp(16px, 3vw, 22px)",
            fontWeight: 800,
            border: "none",
            cursor: phone.length >= 1 ? "pointer" : "not-allowed",
            background: phone.length >= 1 ? "#1c1c1e" : "#c0c0c0",
            color: "#fff",
            letterSpacing: 1,
          }}
        >
          퇴장하기
        </button>
      </div>
      </div>
    </div>
    </>
  );
}

const keyStyle: React.CSSProperties = {
  padding: "clamp(12px, 2.5vh, 22px) 0",
  borderRadius: 12,
  fontSize: "clamp(20px, 4vw, 28px)",
  fontWeight: 700,
  border: "1.5px solid #d1d1d6",
  background: "#fff",
  cursor: "pointer",
  color: "#1c1c1e",
  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
};
