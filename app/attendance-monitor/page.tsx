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
  const [userInfo, setUserInfo] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [latest, setLatest] = useState<any>(null);
  const [lastId, setLastId] = useState<number>(0);
  const [flash, setFlash] = useState(false);
  const [modalMember, setModalMember] = useState<any>(null);
  const intervalRef = useRef<any>(null);
  const closeTimerRef = useRef<any>(null);

  const openMemberModal = async (memberId: number) => {
    const res = await fetch(`/api/members/detail?member_id=${memberId}`);
    const data = await res.json();
    if (data?.member) setModalMember(data.member);
  };

  useEffect(() => {
    const saved = localStorage.getItem("user");
    if (saved) {
      const u = JSON.parse(saved);
      setUserInfo(u);
      const isAdmin = u.role === "ADMIN" || u.role === "OWNER";
      if (!isAdmin && u.branch_name) setBranch(u.branch_name);
    }
  }, []);

  useEffect(() => {
    if (!userInfo) return;
    load();
    intervalRef.current = setInterval(load, 10000);
    return () => clearInterval(intervalRef.current);
  }, [branch, userInfo]);

  const load = async () => {
    if (!userInfo) return;
    const branchQ = branch ? `&branch_name=${encodeURIComponent(branch)}` : "";
    const headers: Record<string, string> = {
      "x-user-role": userInfo.role || "",
      "x-user-branch": encodeURIComponent(userInfo.branch_name || ""),
    };
    const res = await fetch(`/api/attendance?today_only=Y&limit=100${branchQ}`, { headers });
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

        // 새 체크인마다 1분 타이머 리셋
        if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
        closeTimerRef.current = setTimeout(() => {
          window.close();
        }, 60000);
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

  // 같은 회원의 입장/퇴장을 한 줄로 합치기
  const mergedMap = new Map<number, any>();
  [...rows].reverse().forEach((r) => {
    if (r.result !== "SUCCESS" && r.result !== "CHECK_OUT") return;
    const id = r.member_id;
    if (!mergedMap.has(id)) {
      mergedMap.set(id, { ...r, checkin_time: null, checkout_time: null });
    }
    const entry = mergedMap.get(id)!;
    if (r.result === "SUCCESS") entry.checkin_time = r.checkin_time;
    if (r.result === "CHECK_OUT") entry.checkout_time = r.checkin_time;
  });
  const successRows = [...mergedMap.values()].sort((a, b) => {
    const ta = a.checkin_time || a.checkout_time || "";
    const tb = b.checkin_time || b.checkout_time || "";
    return new Date(tb).getTime() - new Date(ta).getTime();
  });

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
              fontSize: 18, fontWeight: 700, letterSpacing: 4,
              color: RESULT_LABEL[latest.result]?.color || "#fff",
              marginBottom: 20, padding: "6px 20px",
              border: `1px solid ${RESULT_LABEL[latest.result]?.color || "#fff"}`,
              borderRadius: 999,
            }}>
              {RESULT_LABEL[latest.result]?.text || latest.result}
            </div>

            {/* 이름 */}
            <div style={{ fontSize: 72, fontWeight: 900, letterSpacing: -2, lineHeight: 1.1, textAlign: "center", marginBottom: 8 }}>
              {latest.name || "미등록"}
            </div>

            {/* 시간 */}
            <div style={{ fontSize: 22, color: "#64748b", marginBottom: 32 }}>
              {fmt(latest.checkin_time)}
            </div>

            {/* 상세 정보 테이블 (이지스포 스타일) */}
            {latest.name && (
              <div style={{ width: "100%", maxWidth: 560, background: "#1e293b", borderRadius: 16, overflow: "hidden" }}>
                {/* 프로그램 행 */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 60px 60px 70px", borderBottom: "1px solid #0f172a" }}>
                  <div style={{ padding: "10px 16px", fontSize: 12, color: "#64748b", background: "#0f172a" }}>프로그램명</div>
                  <div style={{ padding: "10px 16px", fontSize: 12, color: "#64748b", background: "#0f172a" }}>(유효)사용기간</div>
                  <div style={{ padding: "10px 16px", fontSize: 12, color: "#64748b", background: "#0f172a", textAlign: "center" }}>잔여</div>
                  <div style={{ padding: "10px 16px", fontSize: 12, color: "#64748b", background: "#0f172a", textAlign: "center" }}>옷</div>
                  <div style={{ padding: "10px 16px", fontSize: 12, color: "#64748b", background: "#0f172a", textAlign: "center" }}>락카</div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 60px 60px 70px", borderBottom: "1px solid #0f172a" }}>
                  <div style={{ padding: "14px 16px", fontWeight: 700, fontSize: 16 }}>{latest.product_name || "-"}</div>
                  <div style={{ padding: "14px 16px", fontSize: 14, color: "#94a3b8" }}>
                    {latest.start_date?.slice(0, 10)} ~ {latest.end_date?.slice(0, 10)}
                  </div>
                  <div style={{ padding: "14px 16px", textAlign: "center", fontWeight: 900, fontSize: 16, color: "#f8fafc" }}>
                    {latest.pass_type === "COUNT"
                      ? `${latest.remaining_count}회`
                      : latest.end_date
                        ? `${Math.max(0, Math.ceil((new Date(latest.end_date).setHours(0,0,0,0) - new Date().setHours(0,0,0,0)) / 86400000))}일`
                        : "-"}
                  </div>
                  <div style={{ padding: "14px 16px", textAlign: "center", fontWeight: 900, fontSize: 20, color: latest.has_uniform ? "#22c55e" : "#475569" }}>
                    {latest.has_uniform ? "O" : "X"}
                  </div>
                  <div style={{ padding: "14px 16px", textAlign: "center", fontWeight: 900, fontSize: 16, color: latest.has_locker ? "#22c55e" : "#475569" }}>
                    {latest.has_locker ? (latest.locker_no || "O") : "X"}
                  </div>
                </div>
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

      {/* 회원 상세 모달 */}
      {modalMember && (
        <div
          onClick={() => setModalMember(null)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#1e293b", borderRadius: 20, padding: "40px 48px", minWidth: 400,
              color: "#f8fafc", position: "relative",
            }}
          >
            <button
              onClick={() => setModalMember(null)}
              style={{ position: "absolute", top: 16, right: 20, background: "none", border: "none", color: "#64748b", fontSize: 24, cursor: "pointer" }}
            >✕</button>
            <div style={{ fontSize: 36, fontWeight: 900, marginBottom: 24, textAlign: "center" }}>
              {modalMember.name}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 15 }}>
              {[
                ["지점", modalMember.branch_name],
                ["회원권", modalMember.product_name || "-"],
                ["연락처", modalMember.phone || "-"],
                ["출석번호", modalMember.checkin_code || "-"],
                ["시작일", modalMember.start_date?.slice(0, 10) || "-"],
                ["만료일", modalMember.end_date?.slice(0, 10) || "-"],
                ["운동복", modalMember.has_uniform ? "O" : "X"],
                ["락카", modalMember.locker_no || (modalMember.has_locker ? "O" : "X")],
              ].map(([label, val]) => (
                <div key={label} style={{ background: "#0f172a", borderRadius: 10, padding: "12px 16px" }}>
                  <div style={{ color: "#64748b", fontSize: 12, marginBottom: 4 }}>{label}</div>
                  <div style={{ fontWeight: 700 }}>{val}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 24, textAlign: "center" }}>
              <a
                href={`/member-detail?member_id=${modalMember.member_id}`}
                target="_blank"
                style={{ color: "#60a5fa", fontSize: 14, textDecoration: "none" }}
              >
                → 전체 상세 보기
              </a>
            </div>
          </div>
        </div>
      )}

      {/* 오른쪽: 출석 리스트 */}
      <div style={{ width: 320, display: "flex", flexDirection: "column", background: "#0a0f1e" }}>
        <div style={{ padding: "20px 20px 12px", fontSize: 13, fontWeight: 700, color: "#475569", letterSpacing: 2, borderBottom: "1px solid #1e293b" }}>
          오늘 출석 현황
        </div>
        {/* 헤더 */}
        {/* 헤더 */}
        <div style={{ display: "grid", gridTemplateColumns: "36px 1fr 90px 48px 48px", padding: "8px 16px", fontSize: 11, color: "#334155", borderBottom: "1px solid #1e293b" }}>
          <span>NO</span><span>이름</span><span>만료일/잔여</span><span style={{ textAlign: "right" }}>입장</span><span style={{ textAlign: "right" }}>퇴장</span>
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {successRows.length === 0 ? (
            <div style={{ padding: 24, color: "#334155", fontSize: 14, textAlign: "center" }}>아직 출석이 없습니다</div>
          ) : (
            successRows.map((r, i) => (
              <div key={r.member_id} style={{
                display: "grid",
                gridTemplateColumns: "36px 1fr 90px 48px 48px",
                alignItems: "center",
                padding: "9px 16px",
                borderBottom: "1px solid #0a0f1e",
                background: i === 0 ? "#1e293b" : "transparent",
                fontSize: 13,
              }}>
                <span style={{ color: "#475569" }}>{successRows.length - i}</span>
                <span
                  onClick={() => r.member_id && openMemberModal(r.member_id)}
                  style={{ fontWeight: 700, color: r.checkout_time ? "#3b82f6" : "#f8fafc", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: r.member_id ? "pointer" : "default" }}
                >
                  {r.name || "미등록"}
                </span>
                <span style={{ color: "#475569", fontSize: 12 }}>
                  {r.pass_type === "COUNT"
                    ? <span style={{ color: "#f59e0b" }}>{r.remaining_count}회 남음</span>
                    : (r.end_date?.slice(0, 10) || "-")}
                </span>
                <span style={{ color: "#22c55e", textAlign: "right" }}>
                  {fmt(r.checkin_time)}
                </span>
                <span style={{ color: "#3b82f6", textAlign: "right" }}>
                  {fmt(r.checkout_time)}
                </span>
              </div>
            ))
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
