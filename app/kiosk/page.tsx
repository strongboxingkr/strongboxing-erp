"use client";

import { useEffect, useState } from "react";

export default function KioskPage() {
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("출석번호를 입력해주세요");
  const [member, setMember] = useState<any>(null);
  const reset = () => { setCode(""); setMember(null); setMessage("출석번호를 입력해주세요"); };

  const checkWithCode = async (inputCode: string, type: "CHECK_IN" | "CHECK_OUT", usePass?: "REGULAR" | "DAILY") => {
    if (!inputCode.trim()) return;
    const body: any = { checkin_code: inputCode, check_type: type };
    if (usePass) body.use_pass = usePass;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    try {
      const token = localStorage.getItem("kiosk_device_token");
      if (token) headers["x-kiosk-token"] = token;
    } catch {}
    const res = await fetch("/api/check-in", { method: "POST", headers, body: JSON.stringify(body) });
    const data = await res.json();
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
          {/* 메시지 */}
          <div style={{ textAlign: "center", fontSize: 22, fontWeight: 700, color: "#fff", marginBottom: 16 }}>
            {message}
            {member && <div style={{ color: "#ef4444", fontSize: 16, marginTop: 6 }}>{member.branch_name}</div>}
          </div>

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

      {/* 기기 등록 — 하단 소형 버튼 (직원이 처음 1회 실행) */}
      <div style={{ marginTop: 24, textAlign: "center" }}>
        <button
          onClick={async () => {
            try {
              const existing = localStorage.getItem("kiosk_device_token");
              if (existing) { alert("이미 등록된 기기입니다.\n토큰: " + existing.slice(0, 8) + "…"); return; }
            } catch {}
            const branch = prompt("등록할 지점명을 입력하세요 (예: 철산점)");
            if (!branch) return;
            const label = prompt("기기 이름 (선택, 예: 1번키오스크)") || undefined;
            const res = await fetch("/api/kiosk-device", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ branch_name: branch, label }),
              credentials: "include",
            });
            const data = await res.json();
            if (data.success && data.device_token) {
              try { localStorage.setItem("kiosk_device_token", data.device_token); } catch {}
              alert(`등록 완료!\n지점: ${branch}\n이 기기에서 체크인 시 서버가 지점을 자동으로 확정합니다.`);
            } else {
              alert(data.error || data.message || "등록 실패 — 직원으로 로그인 후 시도하세요.");
            }
          }}
          style={{ background: "none", border: "none", color: "#333", fontSize: 12, cursor: "pointer", padding: "8px 16px" }}
        >기기 등록</button>
        <button
          onClick={() => {
            try { localStorage.removeItem("kiosk_device_token"); } catch {}
            alert("기기 등록이 해제됐습니다. 서버 목록에서도 삭제하려면 관리자에게 문의하세요.");
          }}
          style={{ background: "none", border: "none", color: "#333", fontSize: 12, cursor: "pointer", padding: "8px 16px" }}
        >등록 해제</button>
      </div>
    </div>
  );
}
