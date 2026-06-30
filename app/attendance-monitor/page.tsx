"use client";

import { useEffect, useState, useRef } from "react";

const RESULT_LABEL: Record<string, { text: string; color: string }> = {
  SUCCESS: { text: "입장", color: "#22c55e" },
  CHECK_OUT: { text: "퇴장", color: "#3b82f6" },
  EXPIRED: { text: "만료", color: "#ef4444" },
  REST: { text: "휴회", color: "#f59e0b" },
  DUPLICATE: { text: "중복", color: "#a855f7" },
  NO_COUNT: { text: "횟수없음", color: "#ef4444" },
  NOT_FOUND: { text: "미등록", color: "#6b7280" },
};

export default function AttendanceMonitorPage() {
  const [branch, setBranch] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [latest, setLatest] = useState<any>(null);
  const [lastId, setLastId] = useState<number>(0);
  const [flash, setFlash] = useState(false);
  const intervalRef = useRef<any>(null);

  useEffect(() => {
    const saved = localStorage.getItem("user");
    if (saved) {
      const u = JSON.parse(saved);
      const isAdmin = u.role === "ADMIN" || u.role === "OWNER";
      if (!isAdmin && u.branch_name) setBranch(u.branch_name);
    }
  }, []);

  useEffect(() => {
    load();
    intervalRef.current = setInterval(load, 10000);
    return () => clearInterval(intervalRef.current);
  }, [branch]);

  const load = async () => {
    const branchQ = branch ? `&branch_name=${encodeURIComponent(branch)}` : "";
    const res = await fetch(`/api/attendance?today_only=Y&limit=100${branchQ}`);
    const data = await res.json();
    const newRows: any[] = data.rows || [];
    setRows(newRows);

    if (newRows.length > 0) {
      const newest = newRows[0];
      if (newest.attendance_id !== lastId) {
        setLatest(newest);
        setLastId(newest.attendance_id);
        setFlash(true);
        setTimeout(() => setFlash(false), 3000);
      }
    }
  };

  const fmt = (dt: string) => {
    if (!dt) return "";
    return new Date(dt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
  };

  const today = new Date().toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" });

  const successCount = rows.filter((r) => r.result === "SUCCESS").length;
  const checkoutCount = rows.filter((r) => r.result === "CHECK_OUT").length;

  return (
    <div style={{
      display: "flex",
      height: "100vh",
      background: "#0f172a",
      color: "white",
      fontFamily: "-apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif",
      overflow: "hidden",
    }}>
      {/* 왼쪽: 최근 출석 회원 크게 */}
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 48,
        borderRight: "1px solid #1e293b",
        position: "relative",
        transition: "background 0.5s",
        background: flash
          ? (latest?.result === "SUCCESS" ? "rgba(34,197,94,0.08)" :
             latest?.result === "CHECK_OUT" ? "rgba(59,130,246,0.08)" :
             "rgba(239,68,68,0.08)")
          : "#0f172a",
      }}>
        {/* 날짜 + 지점 */}
        <div style={{ position: "absolute", top: 24, left: 32, fontSize: 15, color: "#64748b" }}>
          {today} {branch && `· ${branch}`}
        </div>

        {/* 실시간 시계 */}
        <Clock />

        {latest ? (
          <>
            {/* 결과 뱃지 */}
            <div style={{
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: 4,
              color: RESULT_LABEL[latest.result]?.color || "#fff",
              marginBottom: 24,
              padding: "6px 20px",
              border: `1px solid ${RESULT_LABEL[latest.result]?.color || "#fff"}`,
              borderRadius: 999,
            }}>
              {RESULT_LABEL[latest.result]?.text || latest.result}
            </div>

            {/* 이름 */}
            <div style={{ fontSize: 80, fontWeight: 900, letterSpacing: -2, lineHeight: 1.1, textAlign: "center" }}>
              {latest.name || "미등록"}
            </div>

            {/* 시간 */}
            <div style={{ fontSize: 28, color: "#64748b", marginTop: 16 }}>
              {fmt(latest.checkin_time)}
            </div>

            {/* 회원권 정보 */}
            {latest.name && (
              <div style={{ marginTop: 32, display: "flex", gap: 20, flexWrap: "wrap", justifyContent: "center" }}>
                {latest.product_name && (
                  <div style={{ background: "#1e293b", borderRadius: 10, padding: "10px 20px", fontSize: 16, color: "#94a3b8" }}>
                    {latest.product_name}
                  </div>
                )}
                {latest.end_date && (
                  <div style={{ background: "#1e293b", borderRadius: 10, padding: "10px 20px", fontSize: 16, color: "#94a3b8" }}>
                    만료 {latest.end_date?.slice(0, 10)}
                  </div>
                )}
                {latest.remaining_count != null && latest.pass_type === "COUNT" && (
                  <div style={{ background: "#1e293b", borderRadius: 10, padding: "10px 20px", fontSize: 16, color: "#94a3b8" }}>
                    잔여 {latest.remaining_count}회
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div style={{ fontSize: 32, color: "#334155", textAlign: "center" }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>👋</div>
            키오스크에서 번호를 입력해주세요
          </div>
        )}

        {/* 하단 카운트 */}
        <div style={{ position: "absolute", bottom: 32, display: "flex", gap: 32 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 40, fontWeight: 900, color: "#22c55e" }}>{successCount}</div>
            <div style={{ fontSize: 13, color: "#64748b" }}>오늘 입장</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 40, fontWeight: 900, color: "#3b82f6" }}>{checkoutCount}</div>
            <div style={{ fontSize: 13, color: "#64748b" }}>퇴장</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 40, fontWeight: 900, color: "#f8fafc" }}>{rows.length}</div>
            <div style={{ fontSize: 13, color: "#64748b" }}>전체</div>
          </div>
        </div>
      </div>

      {/* 오른쪽: 출석 리스트 */}
      <div style={{ width: 320, display: "flex", flexDirection: "column", background: "#0a0f1e" }}>
        <div style={{ padding: "20px 20px 12px", fontSize: 13, fontWeight: 700, color: "#475569", letterSpacing: 2, borderBottom: "1px solid #1e293b" }}>
          오늘 출석 현황
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {rows.length === 0 ? (
            <div style={{ padding: 24, color: "#334155", fontSize: 14, textAlign: "center" }}>아직 출석이 없습니다</div>
          ) : (
            rows.map((r, i) => {
              const info = RESULT_LABEL[r.result] || { text: r.result, color: "#6b7280" };
              return (
                <div key={r.attendance_id} style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "10px 16px",
                  borderBottom: "1px solid #0f172a",
                  background: i === 0 ? "#1e293b" : "transparent",
                  gap: 10,
                }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: "50%",
                    background: info.color, flexShrink: 0,
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: r.name ? "#f8fafc" : "#475569", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {r.name || "미등록"}
                    </div>
                    <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>
                      <span style={{ color: info.color }}>{info.text}</span>
                      {r.product_name && <span style={{ marginLeft: 6 }}>{r.product_name}</span>}
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: "#475569", flexShrink: 0 }}>
                    {fmt(r.checkin_time)}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function Clock() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const update = () => setTime(new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false }));
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{ fontSize: 22, color: "#334155", marginBottom: 32, fontVariantNumeric: "tabular-nums" }}>
      {time}
    </div>
  );
}
