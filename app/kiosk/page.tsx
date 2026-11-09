"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

export default function KioskPage() {
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("출석번호를 입력해주세요");
  const [member, setMember] = useState<any>(null);
  const [multiPasses, setMultiPasses] = useState<any>(null); // MULTIPLE_PASSES 선택 대기

  const reset = () => { setCode(""); setMember(null); setMessage("출석번호를 입력해주세요"); setMultiPasses(null); };

  const checkWithCode = async (inputCode: string, type: "CHECK_IN" | "CHECK_OUT", usePass?: "REGULAR" | "DAILY") => {
    if (!inputCode.trim()) return;
    const body: any = { checkin_code: inputCode, check_type: type };
    if (usePass) body.use_pass = usePass;
    const res = await apiFetch("/api/check-in", {
      method: "POST",
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.result === "MULTIPLE_PASSES") {
      setMultiPasses({ ...data, savedCode: inputCode });
      return;
    }
    setMultiPasses(null);
    if (data.success) {
      setMember(data.member);
      setMessage(type === "CHECK_OUT" ? `${data.member?.name || ""}님 퇴실 완료!` : `${data.member?.name || data.guest_name || ""}님 입장 완료!`);
    } else {
      setMember(null);
      setMessage(data.message || "출석 실패");
    }
    setTimeout(() => reset(), 2500);
  };

  const pressNumber = (num: string) => { if (code.length >= 8) return; setCode((prev) => prev + num); };
  const backspace = () => setCode((prev) => prev.slice(0, -1));

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qrCode = params.get("code");
    if (qrCode) { setCode(qrCode); setTimeout(() => checkWithCode(qrCode, "CHECK_IN"), 300); }
  }, []);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0a0a",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
    }}>
      <style>{`
        .key { transition: all 0.07s; }
        .key:active { transform: translateY(2px); filter: brightness(0.85); }
      `}</style>

      {/* 로고 */}
      <div style={{ marginBottom: 32, textAlign: "center" }}>
<div style={{ fontSize: 64, fontWeight: 900, color: "#fff", letterSpacing: 6, lineHeight: 1, fontFamily: "'Arial Black', sans-serif" }}>
          STRONG
        </div>
        <div style={{ fontSize: 64, fontWeight: 900, color: "#ef4444", letterSpacing: 6, lineHeight: 1, fontFamily: "'Arial Black', sans-serif" }}>
          BOXING
        </div>
      </div>

      {/* 카드 */}
      <div style={{ width: "100%", maxWidth: 540, background: "#141414", borderRadius: 24, border: "1px solid #222", overflow: "hidden" }}>
        <div style={{ background: "#ef4444", padding: "14px 20px", textAlign: "center", fontSize: 16, fontWeight: 700, letterSpacing: 2, color: "#fff" }}>
          회원 출석 키오스크
        </div>

        <div style={{ padding: "28px 24px 24px" }}>
          {/* MULTIPLE_PASSES 선택 */}
          {multiPasses && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ textAlign: "center", fontSize: 20, fontWeight: 900, color: "#ff9500", marginBottom: 8 }}>
                이용권을 선택해주세요
              </div>
              <div style={{ textAlign: "center", fontSize: 15, color: "#ccc", marginBottom: 16 }}>{multiPasses.member?.name}님</div>
              <div style={{ display: "flex", gap: 12 }}>
                <button
                  onClick={() => checkWithCode(multiPasses.savedCode, "CHECK_IN", "REGULAR")}
                  style={{ flex: 1, padding: "16px 12px", borderRadius: 14, border: "2px solid #3a7bd5", background: "#0d1f3c", cursor: "pointer", textAlign: "left" }}
                >
                  <div style={{ fontSize: 12, color: "#5b9af5", fontWeight: 700, marginBottom: 4 }}>정기 회원권</div>
                  <div style={{ fontSize: 15, fontWeight: 900, color: "#fff" }}>{multiPasses.regular_pass?.product_name || "-"}</div>
                  <div style={{ fontSize: 12, color: "#aaa", marginTop: 4 }}>
                    {multiPasses.regular_pass?.pass_type === "COUNT"
                      ? `잔여 ${multiPasses.regular_pass?.remaining_count}회`
                      : `만료일 ${multiPasses.regular_pass?.end_date || "-"}`}
                  </div>
                </button>
                <button
                  onClick={() => checkWithCode(multiPasses.savedCode, "CHECK_IN", "DAILY")}
                  style={{ flex: 1, padding: "16px 12px", borderRadius: 14, border: "2px solid #ef4444", background: "#1f0d0d", cursor: "pointer", textAlign: "left" }}
                >
                  <div style={{ fontSize: 12, color: "#ef4444", fontWeight: 700, marginBottom: 4 }}>일일권</div>
                  <div style={{ fontSize: 15, fontWeight: 900, color: "#fff" }}>이용일</div>
                  <div style={{ fontSize: 12, color: "#aaa", marginTop: 4 }}>{multiPasses.day_pass?.use_date || "-"}</div>
                </button>
              </div>
              <button onClick={() => reset()} style={{ marginTop: 12, width: "100%", padding: "12px 0", borderRadius: 12, border: "1px solid #333", background: "#1f1f1f", fontSize: 14, fontWeight: 700, cursor: "pointer", color: "#aaa" }}>
                취소
              </button>
            </div>
          )}

          {/* 메시지 */}
          {!multiPasses && (
          <div style={{ textAlign: "center", fontSize: 22, fontWeight: 700, color: "#fff", marginBottom: 16 }}>
            {message}
            {member && <div style={{ color: "#ef4444", fontSize: 16, marginTop: 6 }}>{member.branch_name}</div>}
          </div>
          )}

          {/* 디스플레이 */}
          <div style={{
            background: "#0a0a0a",
            border: "2px solid #333",
            borderRadius: 14,
            height: 80,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 48,
            fontWeight: 900,
            letterSpacing: 16,
            marginBottom: 20,
            color: "#ef4444",
          }}>
            {code || <span style={{ color: "#2a2a2a", fontSize: 32 }}>- - - - - - - -</span>}
          </div>

          {/* 키패드 */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 12 }}>
            {["1","2","3","4","5","6","7","8","9"].map((n) => (
              <button key={n} className="key" onClick={() => pressNumber(n)} style={{
                height: 80,
                borderRadius: 14,
                border: "1px solid #2a2a2a",
                background: "#1e1e1e",
                color: "#fff",
                fontSize: 34,
                fontWeight: 900,
                cursor: "pointer",
              }}>{n}</button>
            ))}
            <button className="key" onClick={() => pressNumber("0")} style={{
              gridColumn: "1 / 3", height: 80, borderRadius: 14, border: "1px solid #2a2a2a", background: "#1e1e1e", color: "#fff", fontSize: 34, fontWeight: 900, cursor: "pointer"
            }}>0</button>
            <button className="key" onClick={backspace} style={{
              height: 80, borderRadius: 14, border: "1px solid #2a2a2a", background: "#1e1e1e", color: "#555", fontSize: 26, fontWeight: 900, cursor: "pointer"
            }}>⌫</button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <button className="key" onClick={() => checkWithCode(code, "CHECK_IN")} style={{
              height: 80, borderRadius: 14, border: "none", background: "#ef4444", color: "#fff", fontSize: 28, fontWeight: 900, cursor: "pointer", letterSpacing: 3
            }}>입장</button>
            <button className="key" onClick={() => checkWithCode(code, "CHECK_OUT")} style={{
              height: 80, borderRadius: 14, border: "1px solid #333", background: "#1e1e1e", color: "#888", fontSize: 22, fontWeight: 700, cursor: "pointer"
            }}>퇴실</button>
          </div>
        </div>
      </div>
    </div>
  );
}
