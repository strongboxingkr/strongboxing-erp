"use client";

import { useEffect, useRef, useState } from "react";
import AppShell from "@/components/AppShell";
import { apiFetch } from "@/lib/api";

const money = (v: any) =>
  `${Number(v || 0).toLocaleString()}원`;

// ── 출석 달력 컴포넌트 ──────────────────────────────────
function AttendanceCalendar({
  checkins, memberId, passType, onDeleted,
}: {
  checkins: any[];
  memberId: any;
  passType: string;
  onDeleted: () => void;
}) {
  const now = new Date();
  const todayStr = now.toLocaleDateString("sv-SE");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-based
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"month" | "year">("month");

  // 날짜별 출석 맵
  const byDate: Record<string, any[]> = {};
  checkins.forEach((c) => {
    const raw: string = c.checkin_time || "";
    const d = raw.length >= 10 ? raw.slice(0, 10) : new Date(c.checkin_time).toLocaleDateString("sv-SE");
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(c);
  });

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
    setSelectedDate(null);
  };
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
    setSelectedDate(null);
  };

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const pad = (n: number) => String(n).padStart(2, "0");
  const monthTotal = Object.entries(byDate).filter(([d]) =>
    d.startsWith(`${year}-${pad(month + 1)}`)
  ).reduce((s, [, arr]) => s + arr.filter((c) => c.result === "SUCCESS").length, 0);

  const selectedCheckins = selectedDate ? (byDate[selectedDate] || []) : [];

  return (
    <div className="card" style={{ borderRadius: 12, marginBottom: 18, padding: 0, overflow: "hidden", maxWidth: 980 }}>
      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderBottom: "1px solid #e5e7eb" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={prevMonth} style={btnStyle}>‹</button>
          <span style={{ fontSize: 15, fontWeight: 700, minWidth: 72, textAlign: "center" }}>
            {year}.{pad(month + 1)}
          </span>
          <button onClick={nextMonth} style={btnStyle}>›</button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, color: "#6b7280" }}>
            {viewMode === "month" ? <>이번 달 출석 <strong style={{ color: "#2563eb" }}>{monthTotal}</strong>회</> : <>{year}년 총 출석 <strong style={{ color: "#2563eb" }}>{Object.entries(byDate).filter(([d]) => d.startsWith(`${year}-`)).reduce((s, [, arr]) => s + arr.filter((c: any) => c.result === "SUCCESS").length, 0)}</strong>회</>}
          </span>
          <button onClick={() => setViewMode(v => v === "month" ? "year" : "month")}
            style={{ fontSize: 11, padding: "2px 8px", border: "1px solid #d1d5db", borderRadius: 5, background: "#fff", cursor: "pointer", color: "#374151" }}>
            {viewMode === "month" ? "연간 뷰" : "월별 뷰"}
          </button>
        </div>
      </div>

      {/* 연간 뷰 */}
      {viewMode === "year" && (
        <div style={{ padding: "14px 16px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
            {Array.from({ length: 12 }, (_, mi) => {
              const prefix = `${year}-${pad(mi + 1)}`;
              const monthDays: Record<number, number> = {};
              Object.entries(byDate).filter(([d]) => d.startsWith(prefix)).forEach(([d, arr]) => {
                const day = Number(d.slice(8, 10));
                monthDays[day] = (monthDays[day] || 0) + arr.filter((c: any) => c.result === "SUCCESS").length;
              });
              const total = Object.values(monthDays).reduce((a, b) => a + b, 0);
              const daysInMon = new Date(year, mi + 1, 0).getDate();
              const firstDow = new Date(year, mi, 1).getDay();
              const cells2: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMon }, (_, i) => i + 1)];
              while (cells2.length % 7 !== 0) cells2.push(null);
              return (
                <div key={mi} style={{ border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
                  <div style={{ padding: "6px 10px", background: "#f8fafc", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{mi + 1}월</span>
                    {total > 0 && <span style={{ fontSize: 11, color: "#2563eb", fontWeight: 600 }}>{total}회</span>}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", padding: "4px 2px 2px" }}>
                    {["일","월","화","수","목","금","토"].map((d, i) => (
                      <div key={d} style={{ textAlign: "center", fontSize: 9, color: i === 0 ? "#ef4444" : i === 6 ? "#3b82f6" : "#9ca3af", paddingBottom: 2 }}>{d}</div>
                    ))}
                    {cells2.map((day, i) => {
                      if (!day) return <div key={i} style={{ minHeight: 20 }} />;
                      const cnt = monthDays[day] || 0;
                      const dow = i % 7;
                      return (
                        <div key={i} style={{ textAlign: "center", fontSize: 10, minHeight: 20, lineHeight: "20px",
                          color: cnt > 0 ? "#fff" : dow === 0 ? "#ef4444" : dow === 6 ? "#3b82f6" : "#374151",
                          background: cnt > 0 ? "#2563eb" : undefined, borderRadius: cnt > 0 ? "50%" : undefined,
                          margin: cnt > 0 ? "auto" : undefined, width: cnt > 0 ? 18 : undefined, height: cnt > 0 ? 18 : undefined,
                          display: cnt > 0 ? "flex" : undefined, alignItems: cnt > 0 ? "center" : undefined, justifyContent: cnt > 0 ? "center" : undefined,
                        }}>
                          {day}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {viewMode === "month" && (<>
      <div style={{ padding: "0 0 0" }}>
        {/* 요일 헤더 */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
          {["일", "월", "화", "수", "목", "금", "토"].map((d, i) => (
            <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 600,
              color: i === 0 ? "#ef4444" : i === 6 ? "#3b82f6" : "#9ca3af", padding: "8px 0 5px" }}>
              {d}
            </div>
          ))}
        </div>

        {/* 날짜 셀 */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderTop: "1px solid #f3f4f6" }}>
          {cells.map((day, i) => {
            if (!day) return (
              <div key={i} style={{ borderRight: i % 7 !== 6 ? "1px solid #f3f4f6" : undefined, borderBottom: "1px solid #f3f4f6", minHeight: 44 }} />
            );
            const dateStr = `${year}-${pad(month + 1)}-${pad(day)}`;
            const records = byDate[dateStr] || [];
            const hasAttendance = records.length > 0;
            const isSelected = selectedDate === dateStr;
            const isToday = dateStr === todayStr;
            const dow = i % 7;
            const inCnt = records.filter((r: any) => r.result === "SUCCESS").length;
            const outCnt = records.filter((r: any) => r.result === "CHECK_OUT").length;
            return (
              <div
                key={i}
                onClick={() => hasAttendance && setSelectedDate(isSelected ? null : dateStr)}
                style={{
                  borderRight: dow !== 6 ? "1px solid #f3f4f6" : undefined,
                  borderBottom: "1px solid #f3f4f6",
                  minHeight: 44,
                  padding: "4px 5px 3px",
                  cursor: hasAttendance ? "pointer" : "default",
                  background: isSelected ? "#eff6ff" : hasAttendance ? "#f0f9ff" : undefined,
                }}
              >
                {/* 날짜 숫자 */}
                <div style={{
                  fontSize: 12,
                  fontWeight: isToday ? 700 : 400,
                  color: isToday ? "#fff" : dow === 0 ? "#ef4444" : dow === 6 ? "#3b82f6" : "#374151",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: 20, height: 20, borderRadius: "50%",
                  background: isToday ? "#2563eb" : undefined,
                  lineHeight: 1,
                }}>
                  {day}
                </div>
                {/* 출석 표시 — 텍스트만 (점 중복 제거) */}
                {hasAttendance && (
                  <div style={{ marginTop: 1 }}>
                    {inCnt > 0 && <div style={{ fontSize: 10, color: isSelected ? "#1d4ed8" : "#2563eb", fontWeight: 600, lineHeight: 1.3 }}>입장 {inCnt}회</div>}
                    {outCnt > 0 && <div style={{ fontSize: 10, color: "#d97706", fontWeight: 600, lineHeight: 1.3 }}>퇴장 {outCnt}회</div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 선택된 날짜 상세 */}
      {selectedDate && (
        <div style={{ borderTop: "1px solid #e5e7eb", padding: "12px 16px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: "#374151" }}>
            {selectedDate} 출석 상세 ({selectedCheckins.length}건)
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            {selectedCheckins.map((c) => (
              <div key={c.attendance_id} style={{
                background: "#f8fafc", borderRadius: 8, padding: "10px 14px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                border: "1px solid #e5e7eb",
              }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>
                    {new Date(c.checkin_time).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                  <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                    {c.result === "CHECK_OUT" ? "운동 종료 (퇴장)" : c.result === "SUCCESS" ? "출석 완료 (입장)" : c.result}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                  {passType === "COUNT" && (
                    <div style={{ fontSize: 10, color: "#d97706", textAlign: "right", lineHeight: 1.3 }}>
                      횟수권 출석 취소가 일시 제한됨
                    </div>
                  )}
                  <button
                    style={{ padding: "3px 10px", fontSize: 12, border: "1px solid #fca5a5", borderRadius: 5, background: "#fff", cursor: "pointer", color: "#ef4444" }}
                    onClick={async () => {
                      if (!confirm("이 출석 기록을 삭제할까요?")) return;
                      const res = await apiFetch("/api/attendance/delete", {
                        method: "POST",
                        body: JSON.stringify({ attendance_id: c.attendance_id, member_id: memberId, pass_type: passType }),
                      });
                      const json = await res.json();
                      if (json.success) {
                        onDeleted();
                      } else if (json.requiresManualReview) {
                        alert(json.message || "차감된 이용권을 확인할 수 없어 자동 취소할 수 없습니다. 관리자 확인이 필요합니다.");
                      } else {
                        alert(json.message || "삭제 실패");
                      }
                    }}
                  >삭제</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {checkins.length === 0 && viewMode === "month" && (
        <div style={{ color: "#9ca3af", padding: "20px 16px", fontSize: 14 }}>출석 기록이 없습니다.</div>
      )}

      {/* 월별 출석 상세 목록 */}
      {(() => {
        const monthPrefix = `${year}-${pad(month + 1)}`;
        // 이번 달 출석 기록만, 최신순
        const monthCheckins = checkins
          .filter(c => {
            const raw: string = c.checkin_time || "";
            const d = raw.length >= 10 ? raw.slice(0, 10) : new Date(c.checkin_time).toLocaleDateString("sv-SE");
            return d.startsWith(monthPrefix);
          })
          .slice()
          .sort((a, b) => new Date(b.checkin_time).getTime() - new Date(a.checkin_time).getTime());

        if (monthCheckins.length === 0) return null;

        // 날짜별로 그룹핑해서 입장/퇴장 쌍으로 표시
        const grouped: Record<string, { ins: any[]; outs: any[] }> = {};
        monthCheckins.forEach(c => {
          const raw: string = c.checkin_time || "";
          const d = raw.length >= 10 ? raw.slice(0, 10) : new Date(c.checkin_time).toLocaleDateString("sv-SE");
          if (!grouped[d]) grouped[d] = { ins: [], outs: [] };
          if (c.result === "CHECK_OUT") grouped[d].outs.push(c);
          else grouped[d].ins.push(c);
        });

        const rows: Array<{ dateStr: string; inTime: string; outTime: string }> = [];
        Object.entries(grouped)
          .sort(([a], [b]) => b.localeCompare(a))
          .forEach(([dateStr, { ins, outs }]) => {
            // 입장은 첫 번째, 퇴장은 마지막 1개만 표시 (중복 방지)
            const inRec = ins[0];
            const outRec = outs[outs.length - 1];
            rows.push({
              dateStr,
              inTime: inRec ? new Date(inRec.checkin_time).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }) : "—",
              outTime: outRec ? new Date(outRec.checkin_time).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }) : "—",
            });
          });

        return (
          <div style={{ borderTop: "1px solid #e5e7eb" }}>
            <div style={{ padding: "10px 16px 6px", fontSize: 13, fontWeight: 600, color: "#6b7280" }}>
              {year}.{pad(month + 1)} 출석 상세 내역
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                    <th style={{ padding: "8px 16px", textAlign: "left", color: "#9ca3af", fontWeight: 600 }}>날짜</th>
                    <th style={{ padding: "8px 16px", textAlign: "left", color: "#9ca3af", fontWeight: 600 }}>입장 시간</th>
                    <th style={{ padding: "8px 16px", textAlign: "left", color: "#9ca3af", fontWeight: 600 }}>퇴장 시간</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "10px 16px", color: "#374151", whiteSpace: "nowrap" }}>{row.dateStr}</td>
                      <td style={{ padding: "10px 16px", color: "#2563eb", whiteSpace: "nowrap" }}>{row.inTime}</td>
                      <td style={{ padding: "10px 16px", color: row.outTime === "—" ? "#d1d5db" : "#374151", whiteSpace: "nowrap" }}>{row.outTime}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}
      </>)}
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  background: "none", border: "1px solid #e2e8f0", borderRadius: 6,
  padding: "3px 10px", cursor: "pointer", fontSize: 15, color: "#374151",
};

// 결제 액션 버튼 — PC: 한 줄, 모바일: 수정+더보기
function PayActions({ payment, openMenuId, setOpenMenuId, onEdit, onCancel, onRefund, onDelete }: {
  payment: any; openMenuId: number | null; setOpenMenuId: (id: number | null) => void;
  onEdit: () => void; onCancel: () => Promise<void>; onRefund?: () => void; onDelete: () => Promise<void>;
}) {
  const isOpen = openMenuId === payment.payment_id;
  const btnBase: React.CSSProperties = { padding: "3px 9px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 5, background: "#fff", cursor: "pointer", color: "#374151", whiteSpace: "nowrap" };

  return (
    <>
      {/* PC: 버튼 한 줄 */}
      <div className="pay-actions-pc" style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <button style={btnBase} onClick={onEdit}>수정</button>
        <button style={btnBase} onClick={onCancel}>결제 취소</button>
        {onRefund && <button style={btnBase} onClick={onRefund}>환불</button>}
        <button style={{ ...btnBase, color: "#dc2626", border: "1px solid #fca5a5" }} onClick={onDelete}>삭제</button>
      </div>
      {/* 모바일: 수정 + 더보기 */}
      <div className="pay-actions-mobile" style={{ display: "none", gap: 4, alignItems: "center", position: "relative" }}>
        <button style={btnBase} onClick={onEdit}>수정</button>
        <button style={btnBase} onClick={() => setOpenMenuId(isOpen ? null : payment.payment_id)}>⋯</button>
        {isOpen && (
          <div style={{
            position: "fixed", zIndex: 9999,
            background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8,
            boxShadow: "0 8px 24px rgba(0,0,0,0.15)", minWidth: 130, overflow: "hidden",
            // 위치는 JS로 조정되지 않고 근사치로 처리 — 실제로는 portal 없이도 fixed가 viewport 기준
          }}>
            <button style={{ width: "100%", padding: "11px 16px", textAlign: "left", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#374151" }}
              onClick={() => { setOpenMenuId(null); onCancel(); }}>결제 취소</button>
            {onRefund && (
              <button style={{ width: "100%", padding: "11px 16px", textAlign: "left", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#374151" }}
                onClick={() => { setOpenMenuId(null); onRefund(); }}>환불</button>
            )}
            <div style={{ height: 1, background: "#f3f4f6" }} />
            <button style={{ width: "100%", padding: "11px 16px", textAlign: "left", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#dc2626" }}
              onClick={() => { setOpenMenuId(null); onDelete(); }}>삭제</button>
          </div>
        )}
      </div>
    </>
  );
}

// 변경된 필드만 추출해서 읽기 좋게 표시
const FIELD_LABEL: Record<string, string> = {
  name: "이름", phone: "전화번호", gender: "성별", birth_date: "생년월일",
  product_name: "상품", start_date: "시작일", end_date: "종료일",
  remaining_count: "잔여 횟수", status: "상태", branch_name: "지점",
  coach_name: "담당자", locker_no: "락커", locker_number: "락커",
  locker_end_date: "락커 종료일", memo: "메모", pass_type: "권종",
  has_sms: "입장 문자", has_exit_sms: "퇴장 문자", has_locker: "락커 여부",
  emergency_contact: "비상연락처", address: "주소",
};
const STATUS_KO: Record<string, string> = { ACTIVE: "정상", EXPIRED: "만료", REST: "휴회" };
function formatVal(k: string, v: any): string {
  if (v === null || v === undefined || v === "") return "(없음)";
  if (k === "status") return STATUS_KO[String(v)] || String(v);
  if (typeof v === "boolean" || v === 0 || v === 1) return v ? "예" : "아니오";
  if (typeof v === "string" && v.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  return String(v);
}
function diffHistory(before: any, after: any): { label: string; from: string; to: string }[] {
  if (!before || !after || typeof before !== "object" || typeof after !== "object") return [];
  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
  return keys
    .filter(k => FIELD_LABEL[k] && String(before[k]) !== String(after[k]))
    .map(k => ({ label: FIELD_LABEL[k], from: formatVal(k, before[k]), to: formatVal(k, after[k]) }));
}

// 변경이력 행 컴포넌트
function HistoryRow({ datetime, typeLabel, memo, performer, hasDetail, beforeValue, afterValue }: {
  datetime: string; typeLabel: string; memo: string; performer: string | null;
  hasDetail: boolean; beforeValue?: any; afterValue?: any; detail?: any;
}) {
  const [expanded, setExpanded] = useState(false);
  const diffs = expanded ? diffHistory(beforeValue, afterValue) : [];
  return (
    <>
      <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
        <td style={{ padding: "10px 14px", whiteSpace: "nowrap", color: "#6b7280", fontSize: 13 }}>{datetime}</td>
        <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
          <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 4, background: "#f1f5f9", color: "#374151", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>
            {typeLabel}
          </span>
        </td>
        <td style={{ padding: "10px 14px", color: "#374151", minWidth: 120 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13 }}>{memo || typeLabel}</span>
            {hasDetail && (
              <button onClick={() => setExpanded(v => !v)} style={{ flexShrink: 0, padding: "2px 7px", fontSize: 11, border: "1px solid #d1d5db", borderRadius: 4, background: "#fff", cursor: "pointer", color: "#6b7280", whiteSpace: "nowrap" }}>
                {expanded ? "닫기" : "상세"}
              </button>
            )}
          </div>
        </td>
        <td style={{ padding: "10px 14px", color: "#6b7280", fontSize: 13, whiteSpace: "nowrap" }}>
          {performer || <span style={{ color: "#d1d5db" }}>-</span>}
        </td>
      </tr>
      {expanded && hasDetail && (
        <tr style={{ borderBottom: "1px solid #f3f4f6", background: "#f8fafc" }}>
          <td colSpan={4} style={{ padding: "10px 16px 12px" }}>
            {diffs.length > 0 ? (
              <table style={{ fontSize: 13, borderCollapse: "collapse", width: "100%" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "3px 10px 3px 0", color: "#9ca3af", fontWeight: 600, fontSize: 11, whiteSpace: "nowrap" }}>항목</th>
                    <th style={{ textAlign: "left", padding: "3px 10px 3px 0", color: "#9ca3af", fontWeight: 600, fontSize: 11 }}>변경 전</th>
                    <th style={{ textAlign: "left", padding: "3px 0", color: "#9ca3af", fontWeight: 600, fontSize: 11 }}>변경 후</th>
                  </tr>
                </thead>
                <tbody>
                  {diffs.map((d, i) => (
                    <tr key={i}>
                      <td style={{ padding: "2px 10px 2px 0", color: "#374151", fontWeight: 600, whiteSpace: "nowrap" }}>{d.label}</td>
                      <td style={{ padding: "2px 10px 2px 0", color: "#6b7280", wordBreak: "break-word" }}>{d.from}</td>
                      <td style={{ padding: "2px 0", color: "#111827", fontWeight: 500, wordBreak: "break-word" }}>{d.to}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ fontSize: 13, color: "#6b7280" }}>{memo || "상세 내용 없음"}</div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

// 변경이력 타입 한글 매핑 (실제 DB 값 기준)
const historyTypeLabel: Record<string, string> = {
  REGISTER: "회원 등록",
  UPDATE: "회원정보 수정",
  HOLD_RELEASE: "휴회·재개",
  NOTE: "상담 메모",
  // 추후 추가될 수 있는 타입
  PAYMENT: "결제 등록",
  PAYMENT_UPDATE: "결제 수정",
  PAYMENT_CANCEL: "결제 취소",
  REFUND: "환불",
  PAYMENT_DELETE: "결제 삭제",
  PASS_REGISTER: "회원권 등록",
  PASS_EXTEND: "회원권 연장",
  REST: "휴회",
  RESUME: "휴회 재개",
  BULK_EXTEND: "기간 일괄 연장",
  RENEWAL: "재등록",
};

// 출석 기록에 해당하는 타입 (변경이력에서 숨김 — 화면 표시만 제외)
const ATT_TYPES = new Set(["ATTENDANCE"]);
// ──────────────────────────────────────────────────────

export default function MemberDetailPage() {
  const [memberId, setMemberId] = useState("");
  const [inputId, setInputId] = useState("");
  const [data, setData] = useState<any>(null);
  const [memo, setMemo] = useState("");

  const [notes, setNotes] = useState<any[]>([]);
  const [files, setFiles] = useState<any[]>([]);

  const [checkins, setCheckins] = useState<any[]>([]);
  const [tab, setTab] = useState("INFO");
  const [histories, setHistories] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [editPayment, setEditPayment] = useState<any>(null);
  const [editPayForm, setEditPayForm] = useState({ product_name: "", final_amount: "", payment_method: "CARD", payment_date: "", memo: "" });
  const [addPayModal, setAddPayModal] = useState(false);
  const [addPayForm, setAddPayForm] = useState({ product_name: "", final_amount: "", payment_method: "CARD", payment_date: new Date().toISOString().slice(0,10), memo: "" });
  // 환불 모달: refundTarget에 원결제 행 저장
  const [refundTarget, setRefundTarget] = useState<any>(null);
  const [refundForm, setRefundForm] = useState({ refund_amount: "", refund_reason: "" });
  const [refundSubmitting, setRefundSubmitting] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState<any>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [showReregModal, setShowReregModal] = useState(false);
  const [reregForm, setReregForm] = useState<any>({ product_name: "", weekly_limit: null as number | null, final_amount: "", amount: "", discount_amount: 0, payment_method: "CARD", payment_date: new Date().toISOString().slice(0,10), start_date: "", end_date: "", memo: "", extend_locker: false, locker_end_date: "" });
  const [showHoldModal, setShowHoldModal] = useState(false);
  const [holdForm, setHoldForm] = useState({ hold_start: "", hold_end: "", reason: "" });
  const [holdSaving, setHoldSaving] = useState(false);
  const [reregSaving, setReregSaving] = useState(false);
  const [memberLockers, setMemberLockers] = useState<any[]>([]);
  const [availableLockers, setAvailableLockers] = useState<{ locker_zone: string | null; locker_no: number }[]>([]);
  const [showLockerPicker, setShowLockerPicker] = useState<"edit" | "rereg" | null>(null);
  const tabBarRef = useRef<HTMLDivElement>(null);

  const [uploading, setUploading] =
    useState(false);

  const [fileForm, setFileForm] =
    useState({
      file_type: "입관서",
      memo: "",
    });

  const [noteForm, setNoteForm] =
    useState({
      note_type: "상담",
      content: "",
    });

  const loadNotes = async (
    id: string
  ) => {
    const res = await apiFetch(
      `/api/member-notes?member_id=${id}`
    );

    const json =
      await res.json();

    setNotes(json.rows || []);
  };

  const loadCheckins =
    async (id: string) => {
      const res = await apiFetch(
        `/api/checkins/member?member_id=${id}`
      );

      const json =
        await res.json();

      setCheckins(
        json.rows || []
      );
    };

    const loadFiles = async (
      id: string
    ) => {
      const res = await apiFetch(
        `/api/member-files?member_id=${id}`
      );

      const json =
        await res.json();

      setFiles(json.rows || []);
    };

    const loadHistories = async (id: string) => {
    const res = await apiFetch(`/api/member-histories?member_id=${id}`);
    const json = await res.json();
    setHistories(json.rows || []);
  };

  const loadPayments = async (id: string) => {
    const res = await apiFetch(`/api/payments?member_id=${id}`);
    const json = await res.json();
    setPayments(json.rows || []);
  };

  useEffect(() => {
    apiFetch("/api/settings?option_type=PASS_PRODUCT").then(r => r.json()).then(d => setProducts(d.rows || []));
    apiFetch("/api/settings?option_type=BRANCH").then(r => r.json()).then(d => setBranches(d.rows || []));
  }, []);

  const uploadFile = async (
    e: any
  ) => {
    const file =
      e.target.files?.[0];

    if (!file) return;

    if (!data?.member?.member_id)
      return;

    setUploading(true);

    try {
      const formData =
        new FormData();

      formData.append(
        "file",
        file
      );

      formData.append(
        "member_id",
        data.member.member_id
      );

      formData.append(
        "file_type",
        fileForm.file_type
      );

      formData.append(
        "memo",
        fileForm.memo
      );

      const res = await fetch(
        "/api/member-files/upload",
        {
          method: "POST",
          body: formData,
        }
      );

      const json =
        await res.json();

      if (json.success) {
        alert(
          "파일 업로드 완료!"
        );

        setFileForm({
          file_type: "입관서",
          memo: "",
        });

        loadFiles(
          String(
            data.member.member_id
          )
        );
      } else {
        alert(
          json.message ||
            "업로드 실패"
        );
      }
    } finally {
      setUploading(false);
    }
  };

  const load = async () => {
    if (!memberId) return;

    const res = await apiFetch(
      `/api/members/detail?member_id=${memberId}`
    );

    const json =
      await res.json();

    if (json.success) {
      setData(json);

      setMemo(
        json.member.memo || ""
      );

      loadNotes(memberId);
      loadFiles(memberId);
      loadCheckins(memberId);
      loadHistories(memberId);
      loadPayments(memberId);
      apiFetch(`/api/lockers?member_id=${memberId}`).then(r => r.json()).then(d => setMemberLockers(d.rows || []));

    } else {
      alert(
        json.message ||
          "조회 실패"
      );
    }
  };

  const loadAvailableLockers = async (branchName: string) => {
    const [lockersRes, zonesRes] = await Promise.all([
      apiFetch(`/api/lockers?branch_name=${encodeURIComponent(branchName)}`),
      apiFetch(`/api/locker-zones?branch_name=${encodeURIComponent(branchName)}`),
    ]);
    const lockersJson = await lockersRes.json();
    const zonesJson = await zonesRes.json();
    const occupied = new Set(
      (lockersJson.rows || []).filter((r: any) => r.member_id).map((r: any) => Number(r.locker_no))
    );
    const zones: any[] = zonesJson.rows || [];
    const multiZone = zones.length > 1;
    const empty: { locker_zone: string | null; locker_no: number }[] = [];
    for (const zone of zones) {
      for (let no = Number(zone.start_no); no <= Number(zone.end_no); no++) {
        if (!occupied.has(no)) empty.push({ locker_zone: multiZone ? zone.zone_name : null, locker_no: no });
      }
    }
    setAvailableLockers(empty);
  };

  const saveMemo = async () => {
    if (!data?.member?.member_id)
      return;

    const res = await apiFetch(
      "/api/members/update-memo",
      {
        method: "POST",
        body: JSON.stringify({
          member_id:
            data.member.member_id,
          memo,
        }),
      }
    );

    const json =
      await res.json();

    if (json.success) {
      alert(
        "메모 저장 완료!"
      );

      load();
    } else {
      alert(
        json.message ||
          "저장 실패"
      );
    }
  };

  const addNote = async () => {
    if (!data?.member?.member_id)
      return;

    if (
      !noteForm.content.trim()
    ) {
      alert(
        "상담 내용을 입력해주세요."
      );

      return;
    }

    const res = await apiFetch(
      "/api/member-notes/add",
      {
        method: "POST",
        body: JSON.stringify({
          member_id:
            data.member.member_id,
          note_type:
            noteForm.note_type,
          content:
            noteForm.content,
        }),
      }
    );

    const json =
      await res.json();

    if (json.success) {
      setNoteForm({
        note_type: "상담",
        content: "",
      });

      loadNotes(
        String(
          data.member.member_id
        )
      );
    } else {
      alert(
        json.message ||
          "추가 실패"
      );
    }
  };

  useEffect(() => {
    const params =
      new URLSearchParams(
        window.location.search
      );

    const id =
      params.get("member_id");

    if (id) {
      setMemberId(id);
      // 텍스트박스는 비워둠 — URL에서 자동 조회
    }
  }, []);

  useEffect(() => {
    if (memberId) {
      load();
    }
  }, [memberId]);

  const todayStr = new Date().toISOString().slice(0, 10);

  const getMemberStatus = (m: any) => {
    if (m.status === "REST") return { text: "휴회중", color: "#f59e0b" };
    const endStr = m.end_date?.slice(0, 10);
    if (!endStr || endStr < todayStr) return { text: "만료", color: "#ef4444" };
    const diff = Math.ceil((new Date(endStr).getTime() - new Date(todayStr).getTime()) / 86400000);
    if (diff <= 7) return { text: "만료임박", color: "#ff4d6d" };
    return { text: "정상", color: "#22c55e" };
  };

  const getRemaining = (m: any) => {
    if (m.status === "REST") return { text: "휴회중", color: "#f59e0b" };
    if (m.pass_type === "COUNT") {
      const c = Number(m.remaining_count ?? 0);
      return c > 0 ? { text: `${c}회`, color: "#60a5fa" } : { text: "0회", color: "#ef4444" };
    }
    const endStr = m.end_date?.slice(0, 10);
    if (!endStr) return { text: "-", color: "#666" };
    const diff = Math.ceil((new Date(endStr).getTime() - new Date(todayStr).getTime()) / 86400000);
    if (diff < 0) return { text: "만료", color: "#ef4444" };
    if (diff === 0) return { text: "오늘 만료", color: "#ff4d6d" };
    return { text: `${diff}일`, color: diff <= 7 ? "#ff4d6d" : diff <= 30 ? "#f59e0b" : "#22c55e" };
  };

  return (
    <AppShell title="회원 상세">
      {/* 상단 네비 */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <button className="btn secondary" onClick={() => history.back()}
          style={{ fontSize: 13, padding: "5px 14px", height: 32 }}>
          ← 목록으로
        </button>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
          <input className="input" placeholder="다른 회원 ID"
            value={inputId}
            onChange={(e) => { setInputId(e.target.value); setMemberId(e.target.value); }}
            style={{ width: 130, height: 32, fontSize: 12, padding: "0 8px" }}
          />
          <button className="btn secondary" onClick={load}
            style={{ height: 32, fontSize: 12, padding: "0 12px" }}>
            조회
          </button>
        </div>
      </div>

      {data && (
        <>
          {/* 통합 요약 패널 */}
          <div className="card" style={{ marginBottom: 8, padding: "16px 18px", borderRadius: 10 }}>
            {/* 1행: 이름 / 상태 배지들 / 수정 버튼 오른쪽 */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
              <span style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.2 }}>{data.member.name}</span>
              {(() => {
                const st = getMemberStatus(data.member);
                return <span style={{ background: `${st.color}18`, color: st.color, padding: "2px 8px", borderRadius: 999, fontSize: 12, fontWeight: 600 }}>{st.text}</span>;
              })()}
              {Number(data.member.remaining_count || 0) > 0 && Number(data.member.remaining_count) <= 3 && (
                <span style={{ background: "rgba(255,77,109,.12)", color: "#ff4d6d", padding: "2px 8px", borderRadius: 999, fontSize: 12, fontWeight: 600 }}>횟수부족</span>
              )}
              <span style={{ fontSize: 13, color: "#6b7280" }}>{data.member.branch_name}</span>
              <span style={{ fontSize: 13, color: "#6b7280" }}>{data.member.phone}</span>
              <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
                <button className="btn" style={{ fontSize: 12, padding: "4px 14px", height: 30, background: "#2563eb" }}
                  onClick={() => {
                    const m = data.member;
                    const today = new Date().toISOString().slice(0,10);
                    setReregForm({ product_name: m.product_name || "", final_amount: "", amount: "", discount_amount: 0, payment_method: "CARD", payment_date: today, start_date: m.end_date ? m.end_date.slice(0,10) : today, end_date: "", memo: "", extend_locker: false, locker_end_date: "" });
                    setShowReregModal(true);
                  }}>재등록</button>
                <button className="btn secondary" style={{ fontSize: 12, padding: "4px 12px", height: 30 }}
                  onClick={() => {
                    const m = data.member;
                    setEditForm({ branch_name: m.branch_name || "", name: m.name || "", phone: m.phone || "", checkin_code: m.checkin_code || "", member_no: m.member_no || "", gender: m.gender || "", birth_date: m.birth_date?.slice(0,10) || "", locker_number: m.locker_no ? String(m.locker_no).replace(/^[^\d]*-/, "") : "", coach_name: m.staff_name || "", product_name: m.product_name || "", pass_type: m.pass_type || "PERIOD", weekly_limit: m.weekly_limit ?? (m.product_name?.match(/주(\d)회/)?.[1] != null ? Number(m.product_name!.match(/주(\d)회/)![1]) : null), start_date: m.start_date?.slice(0,10) || "", end_date: m.end_date?.slice(0,10) || "", remaining_count: m.remaining_count ?? 0, has_sms: m.checkin_sms_enabled ?? m.attendance_sms_enabled ?? 0, has_exit_sms: m.checkout_sms_enabled ?? 0, has_sportswear: m.has_uniform ?? 0, has_locker: m.has_locker ?? 0, locker_end_date: m.locker_end_date?.slice(0,10) || m.end_date?.slice(0,10) || "", notes: m.memo || "" });
                    setShowEditModal(true);
                  }}>회원정보 수정</button>
              </div>
            </div>

            {/* 구분선 */}
            <div style={{ borderTop: "1px solid #f3f4f6", margin: "10px 0 10px" }} />

            {/* 2행: 식별정보 / 회원권 두 그룹 */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "12px 32px" }}>
              {/* 회원 식별정보 */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 20px", alignItems: "center" }}>
                <SumItem label="회원번호" value={data.member.member_no || "-"} />
                <SumItem label="출석번호" value={data.member.checkin_code || "-"} />
                <SumItem label="담당자" value={data.member.staff_name || "-"} />
              </div>

              <div className="sum-divider" style={{ width: 1, background: "#e5e7eb", alignSelf: "stretch", flexShrink: 0 }} />

              {/* 현재 회원권 */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 20px", alignItems: "center" }}>
                <SumItem label="상품" value={data.member.product_name || "-"} />
                <SumItem label="이용기간" value={
                  (data.member.start_date?.slice(0,10) || "-") + " ~ " + (data.member.end_date?.slice(0,10) || "-")
                } nowrap />
                <SumItem label="잔여" valueEl={(() => { const r = getRemaining(data.member); return <strong style={{ color: r.color, fontSize: 14 }}>{r.text}</strong>; })()} />
                <SumItem label="락커" value={data.member.locker_no || "없음"} />
              </div>

              <div className="sum-divider" style={{ width: 1, background: "#e5e7eb", alignSelf: "stretch", flexShrink: 0 }} />

              {/* 이용 옵션 */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                {[
                  { label: "입장문자", on: !!data.member.checkin_sms_enabled },
                  { label: "퇴장문자", on: !!data.member.checkout_sms_enabled },
                  { label: "운동복", on: !!data.member.has_uniform },
                  { label: "락커", on: !!data.member.has_locker },
                ].map(({ label, on }) => (
                  <span key={label} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: on ? "#eff6ff" : "#f3f4f6", color: on ? "#2563eb" : "#9ca3af", border: `1px solid ${on ? "#bfdbfe" : "#e5e7eb"}`, fontWeight: on ? 600 : 400, whiteSpace: "nowrap" }}>
                    {on ? "✓ " : ""}{label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* 탭 바 */}
          <div ref={tabBarRef} style={{ overflowX: "auto", borderBottom: "1px solid #e5e7eb", marginBottom: 12 }}>
            <div style={{ display: "flex", minWidth: "max-content" }}>
              {[
                ["INFO", "기본정보"],
                ["PAY", "결제내역"],
                ["ATT", "출석기록"],
                ["LOCKER", "락커"],
                ["NOTE", "상담/메모"],
                ["FILE", "입관서/파일"],
                ["HISTORY", "변경이력"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => {
                    setTab(key);
                    // 탭 전환 시 탭바 위치로 스크롤 (헤더 오프셋 고려)
                    setTimeout(() => {
                      if (tabBarRef.current) {
                        const top = tabBarRef.current.getBoundingClientRect().top + window.scrollY - 60;
                        window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
                      }
                    }, 50);
                  }}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    padding: "0 16px", height: 44, fontSize: 14,
                    fontWeight: tab === key ? 700 : 400,
                    color: tab === key ? "#2563eb" : "#6b7280",
                    borderBottom: tab === key ? "2px solid #2563eb" : "2px solid transparent",
                    whiteSpace: "nowrap",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {tab === "FILE" && (
            <div className="card" style={{ borderRadius: 8, marginBottom: 12, padding: "16px 18px" }}>
              {/* 파일 업로드 행 */}
              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6, fontWeight: 600 }}>파일 추가</div>
              <div style={{ display: "grid", gridTemplateColumns: "140px 1fr auto", gap: 8, alignItems: "center", marginBottom: 16 }}>
                <select className="input" value={fileForm.file_type} onChange={(e) => setFileForm({ ...fileForm, file_type: e.target.value })} style={{ fontSize: 14, height: 36 }}>
                  <option>입관서</option>
                  <option>개인정보동의서</option>
                  <option>인바디</option>
                  <option>회원사진</option>
                  <option>기타</option>
                </select>
                <input className="input" placeholder="메모" value={fileForm.memo} onChange={(e) => setFileForm({ ...fileForm, memo: e.target.value })} style={{ fontSize: 14, height: 36 }} />
                <label className="btn" style={{ cursor: "pointer", height: 36, fontSize: 13, padding: "0 16px", display: "flex", alignItems: "center", whiteSpace: "nowrap" }}>
                  {uploading ? "업로드중..." : "파일 업로드"}
                  <input type="file" accept="image/*,.pdf" hidden onChange={uploadFile} />
                </label>
              </div>

              {/* 구분선 */}
              <div style={{ borderTop: "1px solid #e5e7eb", marginBottom: 14 }} />

              {/* 파일 목록 */}
              {files.length === 0 && <div style={{ color: "#9ca3af", fontSize: 14 }}>업로드된 파일이 없습니다.</div>}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
                {files.map((f) => (
                  <a key={f.file_id} href={f.file_url} target="_blank" style={{ display: "block", background: "var(--panel2)", border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 12px", textDecoration: "none", color: "var(--text)" }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#2563eb", background: "#eff6ff", display: "inline-block", padding: "1px 7px", borderRadius: 4, marginBottom: 6 }}>{f.file_type}</div>
                    <div style={{ fontSize: 13, color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.file_name}</div>
                    {f.memo && <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>{f.memo}</div>}
                  </a>
                ))}
              </div>
            </div>
          )}

          {tab === "ATT" && (
            <AttendanceCalendar
              checkins={checkins}
              memberId={data?.member?.member_id}
              passType={data?.member?.pass_type}
              onDeleted={load}
            />
          )}

          {tab === "PAY" && (
            <div className="card" style={{ borderRadius: 12, marginBottom: 18, padding: 0, overflow: "visible" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: "1px solid #e5e7eb" }}>
                <span style={{ fontWeight: 700, fontSize: 15 }}>결제내역</span>
                <div style={{ display: "flex", gap: 6 }}>
                  {data?.member?.status !== "REST" && (
                    <button className="btn secondary" style={{ fontSize: 13, padding: "5px 14px", borderRadius: 6, color: "#d97706", border: "1px solid #fde68a" }}
                      onClick={() => { const today = new Date().toISOString().slice(0,10); setHoldForm({ hold_start: today, hold_end: today, reason: "" }); setShowHoldModal(true); }}>
                      정지(휴회)
                    </button>
                  )}
                  <button className="btn" style={{ fontSize: 13, padding: "5px 14px", borderRadius: 6 }} onClick={() => { setAddPayForm({ product_name: "", final_amount: "", payment_method: "CARD", payment_date: new Date().toISOString().slice(0,10), memo: "" }); setAddPayModal(true); }}>+ 기타 결제</button>
                </div>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                      <th style={{ padding: "10px 16px", textAlign: "left", color: "#6b7280", fontWeight: 600, whiteSpace: "nowrap" }}>결제일</th>
                      <th style={{ padding: "10px 16px", textAlign: "left", color: "#6b7280", fontWeight: 600 }}>상품</th>
                      <th style={{ padding: "10px 16px", textAlign: "right", color: "#6b7280", fontWeight: 600, whiteSpace: "nowrap" }}>금액</th>
                      <th style={{ padding: "10px 16px", textAlign: "left", color: "#6b7280", fontWeight: 600, whiteSpace: "nowrap" }}>결제수단</th>
                      <th style={{ padding: "10px 16px", textAlign: "right", color: "#6b7280", fontWeight: 600, whiteSpace: "nowrap" }}>관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.length === 0 && (
                      <tr><td colSpan={5} style={{ padding: "24px 16px", color: "#9ca3af", textAlign: "center" }}>결제내역이 없습니다.</td></tr>
                    )}
                    {payments.map((p) => {
                      const isCancelled = String(p.memo || "").startsWith("[취소]");
                      const methodLabel = p.payment_method === "CARD" ? "카드" : p.payment_method === "CASH" ? "현금" : p.payment_method === "TRANSFER" ? "계좌이체" : p.payment_method;
                      return (
                        <tr key={p.payment_id} style={{ borderBottom: "1px solid #f3f4f6", opacity: isCancelled ? 0.6 : 1, background: isCancelled ? "#fef2f2" : undefined }}>
                          <td style={{ padding: "12px 16px", whiteSpace: "nowrap", color: "#374151" }}>{p.payment_date?.slice(0, 10)}</td>
                          <td style={{ padding: "12px 16px", color: "#111827" }}>
                            {p.product_name || "-"}
                            {isCancelled && <span style={{ marginLeft: 6, color: "#ef4444", fontSize: 11, fontWeight: 600 }}>취소됨</span>}
                          </td>
                          <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 700, whiteSpace: "nowrap" }}>
                            {isCancelled ? <s style={{ color: "#ef4444" }}>{money(p.refund_amount)}</s> : money(p.final_amount)}
                          </td>
                          <td style={{ padding: "12px 16px", color: "#374151", whiteSpace: "nowrap" }}>{methodLabel}</td>
                          <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                            {!isCancelled && (
                              <PayActions
                                payment={p}
                                openMenuId={openMenuId}
                                setOpenMenuId={setOpenMenuId}
                                onEdit={() => { setEditPayment(p); setEditPayForm({ product_name: p.product_name || "", final_amount: String(p.final_amount || ""), payment_method: p.payment_method || "CARD", payment_date: p.payment_date?.slice(0, 10) || "", memo: p.memo || "" }); }}
                                onCancel={async () => {
                                  if (!confirm(`${p.product_name} 결제를 취소할까요?`)) return;
                                  const res = await apiFetch("/api/payments/cancel", { method: "POST", body: JSON.stringify({ payment_id: p.payment_id }) });
                                  const json = await res.json();
                                  if (json.success) load(); else alert(json.message || "취소 실패");
                                }}
                                onRefund={p.pass_type ? () => { setRefundTarget(p); setRefundForm({ refund_amount: "", refund_reason: "" }); } : undefined}
                                onDelete={async () => {
                                  if (!confirm(`${p.product_name} 결제를 완전 삭제할까요?\n삭제 후 복구 불가합니다.`)) return;
                                  const res = await apiFetch(`/api/payments/delete?payment_id=${p.payment_id}`, { method: "DELETE" });
                                  const json = await res.json();
                                  if (json.success) load(); else alert(json.message || "삭제 실패");
                                }}
                              />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {tab === "LOCKER" && (
            <div className="card" style={{ borderRadius: 8, marginBottom: 12, padding: "16px 18px" }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>락커 현황</div>
              {memberLockers.length === 0 ? (
                <div style={{ color: "#9ca3af", fontSize: 14 }}>배정된 락커가 없습니다.</div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                        <th style={{ padding: "8px 14px", textAlign: "left", color: "#6b7280", fontWeight: 600 }}>구역</th>
                        <th style={{ padding: "8px 14px", textAlign: "left", color: "#6b7280", fontWeight: 600 }}>번호</th>
                        <th style={{ padding: "8px 14px", textAlign: "left", color: "#6b7280", fontWeight: 600 }}>시작일</th>
                        <th style={{ padding: "8px 14px", textAlign: "left", color: "#6b7280", fontWeight: 600 }}>종료일</th>
                        <th style={{ padding: "8px 14px", textAlign: "left", color: "#6b7280", fontWeight: 600 }}>메모</th>
                      </tr>
                    </thead>
                    <tbody>
                      {memberLockers.map((l: any, i: number) => {
                        const today = new Date().toISOString().slice(0, 10);
                        const isExpired = l.end_date && l.end_date.slice(0, 10) < today;
                        return (
                          <tr key={i} style={{ borderBottom: "1px solid #f3f4f6", opacity: isExpired ? 0.6 : 1 }}>
                            <td style={{ padding: "10px 14px" }}>{l.locker_zone || "—"}</td>
                            <td style={{ padding: "10px 14px", fontWeight: 700 }}>{l.locker_no}</td>
                            <td style={{ padding: "10px 14px" }}>{l.start_date?.slice(0, 10) || "—"}</td>
                            <td style={{ padding: "10px 14px" }}>
                              {l.end_date?.slice(0, 10) || "—"}
                              {isExpired && <span style={{ marginLeft: 6, fontSize: 11, color: "#ef4444", fontWeight: 600 }}>만료</span>}
                            </td>
                            <td style={{ padding: "10px 14px", color: "#6b7280" }}>{l.memo || ""}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === "NOTE" && (
            <div className="card" style={{ borderRadius: 8, marginBottom: 12, padding: "16px 18px" }}>
              {/* 회원 메모 */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6, fontWeight: 600 }}>회원 메모</div>
                <textarea
                  className="input"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="회원 메모"
                  style={{ width: "100%", minHeight: 72, fontSize: 14, resize: "vertical" }}
                />
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
                  <button className="btn secondary" onClick={saveMemo} style={{ fontSize: 13, padding: "5px 16px", height: 34 }}>메모 저장</button>
                </div>
              </div>

              {/* 구분선 */}
              <div style={{ borderTop: "1px solid #e5e7eb", marginBottom: 14 }} />

              {/* 상담기록 추가 */}
              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6, fontWeight: 600 }}>상담기록 추가</div>
              <div style={{ display: "grid", gridTemplateColumns: "140px 1fr auto", gap: 8, alignItems: "center" }}>
                <select className="input" value={noteForm.note_type} onChange={(e) => setNoteForm({ ...noteForm, note_type: e.target.value })} style={{ fontSize: 14, height: 36 }}>
                  <option>상담</option>
                  <option>문의</option>
                  <option>주의사항</option>
                  <option>기타</option>
                </select>
                <input className="input" placeholder="상담 내용 입력" value={noteForm.content} onChange={(e) => setNoteForm({ ...noteForm, content: e.target.value })} style={{ fontSize: 14, height: 36 }} />
                <button className="btn" onClick={addNote} style={{ height: 36, fontSize: 13, padding: "0 16px", whiteSpace: "nowrap" }}>추가</button>
              </div>

              {/* 상담 목록 */}
              <div style={{ marginTop: 14 }}>
                {notes.length === 0 && <div style={{ color: "#9ca3af", fontSize: 14 }}>상담기록이 없습니다.</div>}
                {notes.map((n) => (
                  <div key={n.note_id} style={{ borderBottom: "1px solid #f3f4f6", padding: "10px 0" }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 3 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#2563eb", background: "#eff6ff", padding: "1px 7px", borderRadius: 4 }}>{n.note_type}</span>
                      <span style={{ fontSize: 11, color: "#9ca3af" }}>{n.created_at ? new Date(n.created_at).toLocaleString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : ""}</span>
                    </div>
                    <div style={{ fontSize: 14, color: "#374151", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{n.content}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {tab === "INFO" && (
            <div className="card" style={{ borderRadius: 8, marginBottom: 12, padding: "16px 18px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "0 24px" }}>
                <Info label="성별" value={data.member.gender || "-"} />
                <Info label="생년월일" value={data.member.birth_date?.slice(0, 10) || "-"} />
                <Info label="가입일" value={data.member.join_date?.slice(0, 10) || "-"} />
                <Info label="상태" value={
                  data.member.status === "ACTIVE" ? "정상"
                  : data.member.status === "EXPIRED" ? "만료"
                  : data.member.status === "REST" ? "휴회"
                  : data.member.status || "-"
                } />
                <Info label="주소" value={data.member.address || "-"} wide />
              </div>
            </div>
          )}

          {tab === "HISTORY" && (() => {
            const visibleHistories = histories.filter(h => {
              const t = (h.history_type || h.action_type || "").toUpperCase();
              return !ATT_TYPES.has(t);
            });
            return (
              <div className="card" style={{ borderRadius: 12, marginBottom: 18, padding: 0, overflow: "visible" }}>
                <div style={{ padding: "14px 18px", borderBottom: "1px solid #e5e7eb" }}>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>변경이력</span>
                  <span style={{ marginLeft: 8, fontSize: 13, color: "#9ca3af" }}>일반 입장·퇴장은 출석기록 탭에서 확인</span>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", minWidth: 480, borderCollapse: "collapse", fontSize: 14 }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                        <th style={{ padding: "10px 16px", textAlign: "left", color: "#6b7280", fontWeight: 600, whiteSpace: "nowrap" }}>일시</th>
                        <th style={{ padding: "10px 16px", textAlign: "left", color: "#6b7280", fontWeight: 600, whiteSpace: "nowrap" }}>구분</th>
                        <th style={{ padding: "10px 16px", textAlign: "left", color: "#6b7280", fontWeight: 600, minWidth: 140 }}>변경 내용</th>
                        <th style={{ padding: "10px 16px", textAlign: "left", color: "#6b7280", fontWeight: 600, whiteSpace: "nowrap" }}>처리자</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleHistories.length === 0 && (
                        <tr><td colSpan={4} style={{ padding: "24px 16px", color: "#9ca3af", textAlign: "center" }}>변경이력이 없습니다.</td></tr>
                      )}
                      {visibleHistories.map((h) => {
                        const rawType = h.history_type || h.action_type || "";
                        const typeLabel = historyTypeLabel[rawType] || rawType || "변경";
                        const memo = h.memo || h.action_memo || "";
                        const performer = h.created_by || null;
                        const hasDetail = h.old_value || h.new_value;
                        return (
                          <HistoryRow
                            key={h.history_id}
                            datetime={h.created_at ? new Date(h.created_at).toLocaleString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : ""}
                            typeLabel={typeLabel}
                            memo={memo}
                            performer={performer}
                            hasDetail={hasDetail}
                            beforeValue={h.old_value}
                            afterValue={h.new_value}
                            detail={h.action_memo}
                          />
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}
        </>
      )}
      {/* 결제 추가 모달 */}
      {addPayModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="card" style={{ width: 420, maxWidth: "95vw", borderRadius: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ margin: 0 }}>결제 추가</h2>
              <button onClick={() => setAddPayModal(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "var(--muted)" }}>✕</button>
            </div>
            <div style={{ display: "grid", gap: 12 }}>
              <input
                className="input"
                placeholder="상품명 직접 입력 (예: 주3회 차액, 핸드랩)"
                value={addPayForm.product_name}
                onChange={e => setAddPayForm({ ...addPayForm, product_name: e.target.value })}
                list="product-list"
              />
              <datalist id="product-list">
                {products.map((p: any) => <option key={p.option_id} value={p.option_name} />)}
              </datalist>
              <input className="input" type="number" placeholder="결제금액" value={addPayForm.final_amount} onChange={e => setAddPayForm({ ...addPayForm, final_amount: e.target.value })} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {([["CARD","카드"],["CASH","현금"],["TRANSFER","계좌이체"]] as const).map(([m, l]) => (
                  <button key={m} className={addPayForm.payment_method === m ? "btn" : "btn secondary"} onClick={() => setAddPayForm({ ...addPayForm, payment_method: m })}>{l}</button>
                ))}
              </div>
              <input className="input" type="date" value={addPayForm.payment_date} onChange={e => setAddPayForm({ ...addPayForm, payment_date: e.target.value })} />
              <textarea className="input" placeholder="메모" value={addPayForm.memo} onChange={e => setAddPayForm({ ...addPayForm, memo: e.target.value })} style={{ minHeight: 60 }} />
              <button className="btn" style={{ fontSize: 16 }} onClick={async (e) => {
                if (!addPayForm.product_name) return alert("상품을 선택해주세요.");
                if (!addPayForm.final_amount) return alert("결제금액을 입력해주세요.");
                const btn = e.currentTarget;
                btn.disabled = true;
                try {
                  const res = await apiFetch("/api/payments/add", {
                    method: "POST",
                    body: JSON.stringify({
                      member_id: data?.member?.member_id,
                      branch_name: data?.member?.branch_name,
                      product_name: addPayForm.product_name,
                      amount: Number(addPayForm.final_amount),
                      final_amount: Number(addPayForm.final_amount),
                      discount_amount: 0,
                      payment_method: addPayForm.payment_method,
                      payment_date: addPayForm.payment_date,
                      memo: addPayForm.memo,
                      payment_purpose: products.some((p: any) => p.option_name === addPayForm.product_name) ? "PASS" : "GENERAL",
                    }),
                  });
                  const json = await res.json();
                  if (json.success) { alert("결제 추가 완료!"); setAddPayModal(false); loadPayments(String(data?.member?.member_id)); }
                  else alert(json.message || "추가 실패");
                } finally {
                  btn.disabled = false;
                }
              }}>저장</button>
            </div>
          </div>
        </div>
      )}
      {/* 결제 수정 모달 */}
      {editPayment && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="card" style={{ width: 420, maxWidth: "95vw", borderRadius: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ margin: 0 }}>결제 수정</h2>
              <button onClick={() => setEditPayment(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "var(--muted)" }}>✕</button>
            </div>
            <div style={{ display: "grid", gap: 12 }}>
              <input className="input" placeholder="상품명" value={editPayForm.product_name} onChange={e => setEditPayForm({ ...editPayForm, product_name: e.target.value })} />
              <input className="input" type="number" placeholder="결제금액" value={editPayForm.final_amount} onChange={e => setEditPayForm({ ...editPayForm, final_amount: e.target.value })} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {([["CARD","카드"],["CASH","현금"],["TRANSFER","계좌이체"]] as const).map(([m, l]) => (
                  <button key={m} className={editPayForm.payment_method === m ? "btn" : "btn secondary"} onClick={() => setEditPayForm({ ...editPayForm, payment_method: m })}>{l}</button>
                ))}
              </div>
              <input className="input" type="date" value={editPayForm.payment_date} onChange={e => setEditPayForm({ ...editPayForm, payment_date: e.target.value })} />
              <textarea className="input" placeholder="메모" value={editPayForm.memo} onChange={e => setEditPayForm({ ...editPayForm, memo: e.target.value })} style={{ minHeight: 80 }} />
              <button className="btn" style={{ fontSize: 16 }} onClick={async () => {
                const res = await apiFetch("/api/payments", {
                  method: "PUT",
                  body: JSON.stringify({ payment_id: editPayment.payment_id, ...editPayForm, final_amount: Number(editPayForm.final_amount) }),
                });
                const json = await res.json();
                if (json.success) { alert("수정 완료!"); setEditPayment(null); load(); }
                else alert(json.message || "수정 실패");
              }}>저장</button>
            </div>
          </div>
        </div>
      )}
      {/* 환불 모달 */}
      {refundTarget && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="card" style={{ width: 440, maxWidth: "95vw", borderRadius: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ margin: 0 }}>환불 처리</h2>
              <button onClick={() => setRefundTarget(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "var(--muted)" }}>✕</button>
            </div>
            <div style={{ background: "var(--panel2)", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13 }}>
              <div style={{ color: "#888", fontSize: 11, marginBottom: 4 }}>원결제</div>
              <div><b>#{refundTarget.payment_id}</b> {refundTarget.product_name || "결제"}</div>
              <div style={{ color: "#888", fontSize: 12 }}>결제금액: {Number(refundTarget.final_amount).toLocaleString()}원</div>
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              <input
                className="input"
                type="number"
                placeholder="환불 금액"
                value={refundForm.refund_amount}
                onChange={e => setRefundForm({ ...refundForm, refund_amount: e.target.value })}
              />
              <input
                className="input"
                placeholder="환불 사유 (선택)"
                value={refundForm.refund_reason}
                onChange={e => setRefundForm({ ...refundForm, refund_reason: e.target.value })}
              />
              {refundTarget.pass_type && (
                <div style={{ background: "#f0fdf4", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#166534" }}>
                  회원권 해지는 금액 환불 후 회원 수정 화면에서 별도로 조정해 주세요.
                  (원결제와 현재 회원권의 연결을 신뢰할 수 있게 확인할 수 없어 자동 해지를 지원하지 않습니다.)
                </div>
              )}
              <button
                className="btn"
                style={{ fontSize: 15 }}
                disabled={refundSubmitting || !refundForm.refund_amount}
                onClick={async () => {
                  if (refundSubmitting) return;
                  if (!refundForm.refund_amount || Number(refundForm.refund_amount) <= 0) {
                    alert("환불 금액을 입력해주세요.");
                    return;
                  }
                  setRefundSubmitting(true);
                  try {
                    const res = await apiFetch("/api/member-refund", {
                      method: "POST",
                      body: JSON.stringify({
                        member_id: data?.member?.member_id,
                        payment_id: refundTarget.payment_id,
                        refund_amount: Number(refundForm.refund_amount),
                        refund_reason: refundForm.refund_reason || undefined,
                      }),
                    });
                    const json = await res.json();
                    if (json.success) {
                      alert(json.message || "환불 처리 완료");
                      setRefundTarget(null);
                      load();
                      loadPayments(String(data?.member?.member_id));
                    } else {
                      alert(json.message || "환불 실패");
                    }
                  } catch {
                    alert("환불 요청 중 오류가 발생했습니다.");
                  } finally {
                    setRefundSubmitting(false);
                  }
                }}
              >
                {refundSubmitting ? "처리 중..." : "환불 확인"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 재등록 모달 */}
      {showReregModal && data?.member && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowReregModal(false); }}>
          <div style={{ background: "#fff", borderRadius: 12, width: "100%", maxWidth: 600, maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 8px 40px rgba(0,0,0,.18)" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>회원권 재등록</div>
                <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>{data.member.name} · 현재: {data.member.product_name} · 만료: {data.member.end_date?.slice(0,10) || "-"}</div>
              </div>
              <button onClick={() => setShowReregModal(false)} style={{ background: "none", border: "none", fontSize: 20, color: "#9ca3af", cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14, overflowY: "auto", flex: 1 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 4 }}>프로그램 <span style={{ color: "#dc2626" }}>*</span></div>
                  <select className="input" value={reregForm.product_name} onChange={e => setReregForm({ ...reregForm, product_name: e.target.value })}>
                    <option value="">선택</option>
                    {products.filter((p: any) => p.option_value === "PERIOD").map((p: any) => <option key={p.option_id} value={p.option_name}>{p.option_name}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 4 }}>주N회 제한</div>
                  <select className="input" value={reregForm.weekly_limit ?? ""} onChange={e => setReregForm({ ...reregForm, weekly_limit: e.target.value === "" ? null : Number(e.target.value) })}>
                    <option value="">--</option>
                    <option value="1">주1회</option>
                    <option value="2">주2회</option>
                    <option value="3">주3회</option>
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 4 }}>시작일</div>
                  <input className="input" type="date" value={reregForm.start_date} onChange={e => setReregForm({ ...reregForm, start_date: e.target.value })} />
                  <div style={{ fontSize: 11, color: "#6b7280", marginTop: 3 }}>만료일 이후 선택 시 이어붙이기됩니다.</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 4 }}>결제일</div>
                  <input className="input" type="date" value={reregForm.payment_date} onChange={e => setReregForm({ ...reregForm, payment_date: e.target.value })} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 4 }}>실결제금액 <span style={{ color: "#dc2626" }}>*</span></div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input className="input" type="number" placeholder="0" style={{ fontWeight: 700 }} value={reregForm.final_amount} onChange={e => setReregForm({ ...reregForm, final_amount: e.target.value, amount: e.target.value })} />
                    <span style={{ fontSize: 13, color: "#6b7280", whiteSpace: "nowrap" }}>원</span>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 4 }}>결제수단</div>
                  <select className="input" value={reregForm.payment_method} onChange={e => setReregForm({ ...reregForm, payment_method: e.target.value })}>
                    <option value="CARD">카드</option>
                    <option value="CASH">현금</option>
                    <option value="TRANSFER">계좌이체</option>
                  </select>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 4 }}>메모 <span style={{ fontWeight: 400, color: "#9ca3af" }}>(선택)</span></div>
                <textarea className="input" placeholder="메모" rows={2} style={{ resize: "vertical" }} value={reregForm.memo} onChange={e => setReregForm({ ...reregForm, memo: e.target.value })} />
              </div>
              {/* 락커 섹션 */}
              <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 10 }}>락커 등록</div>
                {data.member.locker_no ? (
                  <div style={{ padding: "12px 14px", background: "#f8fafc", borderRadius: 8, border: "1px solid #e5e7eb" }}>
                    <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>현재 락커: <strong>{data.member.locker_no}</strong></div>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 14 }}>
                      <input type="checkbox" checked={reregForm.extend_locker} onChange={e => setReregForm({ ...reregForm, extend_locker: e.target.checked })} />
                      락커 기간도 함께 연장
                    </label>
                    {reregForm.extend_locker && (
                      <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <div>
                          <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 3 }}>락커 종료일</div>
                          <input className="input" type="date" value={reregForm.locker_end_date} onChange={e => setReregForm({ ...reregForm, locker_end_date: e.target.value })} />
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ padding: "12px 14px", background: "#f8fafc", borderRadius: 8, border: "1px solid #e5e7eb" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 14, marginBottom: 10 }}>
                      <input type="checkbox" checked={!!reregForm.new_locker} onChange={e => {
                        const checked = e.target.checked;
                        setReregForm({ ...reregForm, new_locker: checked ? { locker_no: "", locker_zone: "", start_date: reregForm.start_date || "", end_date: "" } : null });
                        if (checked && data?.member?.branch_name) {
                          loadAvailableLockers(data.member.branch_name).then(() => setShowLockerPicker("rereg"));
                        } else {
                          setShowLockerPicker(null);
                        }
                      }} />
                      새 락커 함께 배정
                    </label>
                    {reregForm.new_locker && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <div>
                          <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 3 }}>락커 선택</div>
                          <div style={{ display: "flex", gap: 6 }}>
                            <input className="input" placeholder="번호 직접 입력" value={reregForm.new_locker.locker_no} onChange={e => { setReregForm({ ...reregForm, new_locker: { ...reregForm.new_locker, locker_no: e.target.value, locker_zone: "" } }); setShowLockerPicker(null); }} />
                            <button type="button" className="btn secondary" style={{ fontSize: 12, height: 38, padding: "0 10px", whiteSpace: "nowrap" }}
                              onClick={() => {
                                if (showLockerPicker === "rereg") { setShowLockerPicker(null); return; }
                                loadAvailableLockers(data.member.branch_name).then(() => setShowLockerPicker("rereg"));
                              }}>빈 락커</button>
                          </div>
                          {showLockerPicker === "rereg" && (
                            <div style={{ marginTop: 6, maxHeight: 160, overflowY: "auto", border: "1px solid #e5e7eb", borderRadius: 6, background: "#fff" }}>
                              {availableLockers.length === 0
                                ? <div style={{ padding: "8px 12px", fontSize: 12, color: "#9ca3af" }}>빈 락커 없음</div>
                                : availableLockers.map(l => (
                                  <div key={`${l.locker_zone}-${l.locker_no}`}
                                    style={{ padding: "7px 12px", fontSize: 13, cursor: "pointer", borderBottom: "1px solid #f3f4f6" }}
                                    onClick={() => {
                                      const locker_no = l.locker_zone ? `${l.locker_zone}-${l.locker_no}` : String(l.locker_no);
                                      setReregForm({ ...reregForm, new_locker: { ...reregForm.new_locker, locker_no, locker_zone: l.locker_zone || "" } });
                                      setShowLockerPicker(null);
                                    }}>
                                    {l.locker_zone ? `${l.locker_zone}-${l.locker_no}` : l.locker_no}번
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>
                        <div>
                          <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 3 }}>종료일</div>
                          <input className="input" type="date" value={reregForm.new_locker.end_date} onChange={e => setReregForm({ ...reregForm, new_locker: { ...reregForm.new_locker, end_date: e.target.value } })} />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div style={{ padding: "12px 20px", borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "flex-end", gap: 8, flexShrink: 0 }}>
              <button className="btn secondary" style={{ height: 38, fontSize: 14, padding: "0 18px" }} onClick={() => setShowReregModal(false)}>취소</button>
              <button className="btn" style={{ height: 38, fontSize: 14, padding: "0 18px" }} disabled={reregSaving} onClick={async () => {
                if (!reregForm.product_name) { alert("상품을 선택해주세요"); return; }
                if (!reregForm.final_amount) { alert("결제금액을 입력해주세요"); return; }
                setReregSaving(true);
                const m = data.member;
                const payload: any = {
                  member_id: m.member_id,
                  branch_name: m.branch_name,
                  payment_date: reregForm.payment_date,
                  start_date: reregForm.start_date || reregForm.payment_date,
                  payment_method: reregForm.payment_method,
                  product_name: reregForm.product_name,
                  weekly_limit: reregForm.weekly_limit,
                  amount: Number(reregForm.final_amount),
                  discount_amount: 0,
                  final_amount: Number(reregForm.final_amount),
                  memo: reregForm.memo,
                  payment_purpose: "PASS",
                };
                if (reregForm.extend_locker && m.locker_no) {
                  payload.extend_locker = true;
                  payload.locker_end_date = reregForm.locker_end_date || reregForm.start_date || reregForm.payment_date;
                }
                const res = await apiFetch("/api/payments/add", { method: "POST", body: JSON.stringify(payload) });
                const json = await res.json();
                if (json.success && reregForm.new_locker?.locker_no) {
                  await apiFetch("/api/lockers/assign", { method: "POST", body: JSON.stringify({
                    branch_name: m.branch_name,
                    locker_zone: reregForm.new_locker.locker_zone || "A",
                    locker_no: reregForm.new_locker.locker_no,
                    member_id: m.member_id,
                    member_name: m.name,
                    gender: m.gender,
                    start_date: reregForm.new_locker.start_date || null,
                    end_date: reregForm.new_locker.end_date || null,
                  }) });
                }
                setReregSaving(false);
                if (json.success) { alert("재등록 완료!" + (reregForm.new_locker?.locker_no ? " (락커 배정 포함)" : "")); setShowReregModal(false); location.reload(); }
                else alert(json.message || "재등록 실패");
              }}>{reregSaving ? "처리 중..." : "재등록 저장"}</button>
            </div>
          </div>
        </div>
      )}

      {/* 정지(휴회) 모달 */}
      {showHoldModal && data?.member && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowHoldModal(false); }}>
          <div style={{ background: "#fff", borderRadius: 12, width: "100%", maxWidth: 420, padding: 28, boxShadow: "0 8px 40px rgba(0,0,0,.18)" }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>정지(휴회) 등록</div>
            <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 20 }}>{data.member.name} · 만료일: {data.member.end_date?.slice(0,10) || "-"}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>휴회 시작일 <span style={{ color: "#dc2626" }}>*</span></div>
                <input className="input" type="date" value={holdForm.hold_start} onChange={e => setHoldForm({ ...holdForm, hold_start: e.target.value })} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>휴회 종료일 <span style={{ color: "#dc2626" }}>*</span></div>
                <input className="input" type="date" value={holdForm.hold_end} onChange={e => setHoldForm({ ...holdForm, hold_end: e.target.value })} />
                {holdForm.hold_start && holdForm.hold_end && holdForm.hold_end >= holdForm.hold_start && (
                  <div style={{ fontSize: 12, color: "#2563eb", marginTop: 4 }}>
                    {Math.floor((new Date(holdForm.hold_end).getTime() - new Date(holdForm.hold_start).getTime()) / 86400000) + 1}일 정지 → 만료일 자동 연장
                  </div>
                )}
              </div>
              <div>
                <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>사유</div>
                <input className="input" placeholder="휴회 사유 (선택)" value={holdForm.reason} onChange={e => setHoldForm({ ...holdForm, reason: e.target.value })} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 20, justifyContent: "flex-end" }}>
              <button className="btn secondary" onClick={() => setShowHoldModal(false)}>취소</button>
              <button className="btn" style={{ background: "#d97706" }} disabled={holdSaving} onClick={async () => {
                if (!holdForm.hold_start || !holdForm.hold_end) { alert("휴회 시작일과 종료일을 입력해주세요"); return; }
                setHoldSaving(true);
                const res = await apiFetch("/api/members/hold", { method: "POST", body: JSON.stringify({ member_id: data.member.member_id, hold_start: holdForm.hold_start, hold_end: holdForm.hold_end, reason: holdForm.reason }) });
                const json = await res.json();
                setHoldSaving(false);
                if (json.success) { alert(`휴회 등록 완료. 만료일: ${json.old_end_date?.slice(0,10)} → ${json.new_end_date?.slice(0,10)}`); setShowHoldModal(false); load(); }
                else alert(json.message || "휴회 처리 실패");
              }}>{holdSaving ? "처리 중..." : "정지 등록"}</button>
            </div>
          </div>
        </div>
      )}

      {/* 회원 수정 인라인 모달 */}
      {showEditModal && editForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowEditModal(false); }}>
          <div style={{ background: "var(--bg)", borderRadius: 16, width: "100%", maxWidth: 860, maxHeight: "92vh", display: "flex", flexDirection: "column", boxShadow: "0 8px 48px rgba(0,0,0,.28)", overflow: "hidden" }}>
            {/* 헤더 */}
            <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: "var(--fg)" }}>회원 수정</span>
              <button onClick={() => setShowEditModal(false)} style={{ background: "none", border: "none", fontSize: 20, color: "var(--muted)", cursor: "pointer", lineHeight: 1, padding: 4 }}>✕</button>
            </div>

            {/* 본문 */}
            <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1 }}>
              <style>{`
                .emd-label { font-size: 13px; font-weight: 600; color: var(--muted); margin-bottom: 5px; display: block; }
                .emd-section-title { font-size: 12px; font-weight: 700; color: #6b7280; letter-spacing: .05em; text-transform: uppercase; padding-bottom: 6px; border-bottom: 1px solid var(--line); margin-bottom: 14px; }
                .emd-grid4 { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 12px; }
                .emd-field input, .emd-field select, .emd-field textarea { width: 100%; box-sizing: border-box; height: 38px; padding: 0 10px; font-size: 14px; border: 1px solid #d1d5db; border-radius: 6px; background: var(--bg); color: var(--fg); outline: none; transition: border-color .15s; }
                .emd-field input:focus, .emd-field select:focus { border-color: #3b82f6; }
                .emd-field textarea { height: auto; min-height: 68px; padding: 8px 10px; line-height: 1.5; resize: vertical; }
                .emd-opt-row { display: flex; flex-wrap: wrap; gap: 10px; }
                .emd-opt-label { display: flex; align-items: center; gap: 7px; font-size: 14px; color: var(--fg); cursor: pointer; padding: 7px 12px; border: 1px solid var(--line); border-radius: 8px; user-select: none; }
                .emd-opt-label input[type=checkbox] { width: 16px; height: 16px; margin: 0; accent-color: #3b82f6; }
                @media (max-width: 640px) { .emd-grid4 { grid-template-columns: repeat(2, minmax(0,1fr)); } }
              `}</style>

              {/* 기본 정보 */}
              <div style={{ marginBottom: 20 }}>
                <div className="emd-section-title">기본 정보</div>
                <div className="emd-grid4">
                  <div className="emd-field">
                    <label className="emd-label">지점</label>
                    <select value={editForm.branch_name} onChange={e => setEditForm({...editForm, branch_name: e.target.value})}>
                      {branches.map((b: any) => <option key={b.option_id} value={b.option_name}>{b.option_name}</option>)}
                    </select>
                  </div>
                  <div className="emd-field">
                    <label className="emd-label">이름 *</label>
                    <input placeholder="홍길동" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} />
                  </div>
                  <div className="emd-field">
                    <label className="emd-label">전화번호</label>
                    <input placeholder="010-0000-0000" value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} />
                  </div>
                  <div className="emd-field">
                    <label className="emd-label">출석번호</label>
                    <input placeholder="숫자 최대 8자리" maxLength={8} value={editForm.checkin_code} onChange={e => setEditForm({...editForm, checkin_code: e.target.value.replace(/[^0-9]/g, "").slice(0, 8)})} />
                  </div>
                  <div className="emd-field">
                    <label className="emd-label">성별</label>
                    <select value={editForm.gender} onChange={e => setEditForm({...editForm, gender: e.target.value})}>
                      <option value="">선택</option>
                      <option value="남">남</option>
                      <option value="여">여</option>
                    </select>
                  </div>
                  <div className="emd-field">
                    <label className="emd-label">생년월일</label>
                    <input type="date" value={editForm.birth_date} onChange={e => setEditForm({...editForm, birth_date: e.target.value})} />
                  </div>
                  <div className="emd-field">
                    <label className="emd-label">라커번호</label>
                    <input placeholder="미지정" value={editForm.locker_number} onChange={e => setEditForm({...editForm, locker_number: e.target.value})} />
                  </div>
                  <div className="emd-field">
                    <label className="emd-label">담당자</label>
                    <input placeholder="담당 직원명" value={editForm.coach_name} onChange={e => setEditForm({...editForm, coach_name: e.target.value})} />
                  </div>
                </div>
              </div>

              {/* 회원권 정보 */}
              <div style={{ marginBottom: 20 }}>
                <div className="emd-section-title">회원권 정보</div>
                <div className="emd-grid4" style={{ marginBottom: 12 }}>
                  <div className="emd-field">
                    <label className="emd-label">프로그램</label>
                    <select value={editForm.product_name} onChange={e => {
                      const name = e.target.value;
                      const prod = products.find((p: any) => p.option_name === name);
                      const passType = prod?.option_value === "DAILY" ? "DAILY" : editForm.weekly_limit != null ? "COUNT" : "PERIOD";
                      setEditForm({...editForm, product_name: name, pass_type: passType});
                    }}>
                      <option value="">선택</option>
                      {products.filter((p: any) => p.option_value === "PERIOD").map((p: any) => <option key={p.option_id} value={p.option_name}>{p.option_name}</option>)}
                    </select>
                  </div>
                  <div className="emd-field">
                    <label className="emd-label">횟수제한</label>
                    <select value={editForm.weekly_limit ?? ""} onChange={e => {
                      const val = e.target.value === "" ? null : Number(e.target.value);
                      const prod = products.find((p: any) => p.option_name === editForm.product_name);
                      const passType = prod?.option_value === "DAILY" ? "DAILY" : val != null ? "COUNT" : "PERIOD";
                      setEditForm({...editForm, weekly_limit: val, pass_type: passType});
                    }}>
                      <option value="">--</option>
                      <option value="1">주1회</option>
                      <option value="2">주2회</option>
                      <option value="3">주3회</option>
                    </select>
                  </div>
                  <div className="emd-field">
                    <label className="emd-label">시작일</label>
                    <input type="date" value={editForm.start_date} onChange={e => {
                      const newStart = e.target.value;
                      if (editForm.end_date) {
                        const diff = new Date(editForm.end_date).getTime() - new Date(editForm.start_date).getTime();
                        const newEnd = new Date(new Date(newStart).getTime() + diff).toISOString().slice(0,10);
                        setEditForm({...editForm, start_date: newStart, end_date: newEnd, locker_end_date: editForm.locker_end_date ? newEnd : ""});
                      } else {
                        setEditForm({...editForm, start_date: newStart});
                      }
                    }} />
                  </div>
                  <div className="emd-field">
                    <label className="emd-label">만료일</label>
                    <input type="date" value={editForm.end_date} onChange={e => setEditForm({...editForm, end_date: e.target.value, locker_end_date: editForm.locker_end_date ? e.target.value : ""})} />
                  </div>
                  <div className="emd-field">
                    <label className="emd-label">잔여횟수</label>
                    <input type="number" placeholder="0" value={editForm.remaining_count} onChange={e => setEditForm({...editForm, remaining_count: Number(e.target.value)})} />
                  </div>
                </div>
              </div>

              {/* 이용 옵션 */}
              <div style={{ marginBottom: 20 }}>
                <div className="emd-section-title">이용 옵션</div>
                <div className="emd-opt-row">
                  <label className="emd-opt-label">
                    <input type="checkbox" checked={!!editForm.has_sms} onChange={e => setEditForm({...editForm, has_sms: e.target.checked ? 1 : 0})} />
                    입장 문자
                  </label>
                  <label className="emd-opt-label">
                    <input type="checkbox" checked={!!editForm.has_exit_sms} onChange={e => setEditForm({...editForm, has_exit_sms: e.target.checked ? 1 : 0})} />
                    운동 종료 문자
                  </label>
                  <label className="emd-opt-label">
                    <input type="checkbox" checked={!!editForm.has_sportswear} onChange={e => setEditForm({...editForm, has_sportswear: e.target.checked ? 1 : 0})} />
                    운동복 대여
                  </label>
                  <label className="emd-opt-label">
                    <input type="checkbox" checked={!!editForm.has_locker} onChange={e => {
                      const checked = e.target.checked;
                      setEditForm({...editForm, has_locker: checked ? 1 : 0, locker_number: checked ? editForm.locker_number : ""});
                      if (checked && data?.member?.branch_name) {
                        loadAvailableLockers(data.member.branch_name).then(() => setShowLockerPicker("edit"));
                      } else {
                        setShowLockerPicker(null);
                      }
                    }} />
                    라카 사용
                  </label>
                </div>
                {!!editForm.has_locker && (
                  <div style={{ marginTop: 10, padding: "10px 14px", background: "var(--panel2)", border: "1px solid var(--line)", borderRadius: 8, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
                    <div>
                      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>락커 번호</div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <input className="emd-field" style={{ width: 90, height: 36, padding: "0 10px", fontSize: 14, border: "1px solid #d1d5db", borderRadius: 6, background: "var(--bg)", color: "var(--fg)" }}
                          placeholder="예) 27" value={editForm.locker_number || ""}
                          onChange={e => { setEditForm({...editForm, locker_number: e.target.value}); setShowLockerPicker(null); }} />
                        <button type="button" className="btn secondary" style={{ fontSize: 12, height: 36, padding: "0 10px", whiteSpace: "nowrap" }}
                          onClick={() => {
                            if (showLockerPicker === "edit") { setShowLockerPicker(null); return; }
                            loadAvailableLockers(data.member.branch_name).then(() => setShowLockerPicker("edit"));
                          }}>빈 락커</button>
                      </div>
                      {showLockerPicker === "edit" && (
                        <div style={{ marginTop: 6, maxHeight: 160, overflowY: "auto", border: "1px solid var(--line)", borderRadius: 6, background: "var(--bg)" }}>
                          {availableLockers.length === 0
                            ? <div style={{ padding: "8px 12px", fontSize: 12, color: "var(--muted)" }}>빈 락커 없음</div>
                            : availableLockers.map(l => (
                              <div key={`${l.locker_zone}-${l.locker_no}`}
                                style={{ padding: "7px 12px", fontSize: 13, cursor: "pointer", borderBottom: "1px solid var(--line)" }}
                                onClick={() => { setEditForm({...editForm, locker_number: l.locker_zone ? `${l.locker_zone}-${l.locker_no}` : String(l.locker_no)}); setShowLockerPicker(null); }}>
                                {l.locker_zone ? `${l.locker_zone}-${l.locker_no}` : l.locker_no}번
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>락커 종료일</div>
                      <input type="date" style={{ height: 36, padding: "0 10px", fontSize: 14, border: "1px solid #d1d5db", borderRadius: 6, background: "var(--bg)", color: "var(--fg)" }}
                        value={editForm.locker_end_date || ""} onChange={e => setEditForm({...editForm, locker_end_date: e.target.value})} />
                    </div>
                  </div>
                )}
              </div>

              {/* 메모 */}
              <div>
                <div className="emd-section-title">메모</div>
                <div className="emd-field">
                  <textarea placeholder="특이사항, 참고 내용" value={editForm.notes} onChange={e => setEditForm({...editForm, notes: e.target.value})} />
                </div>
              </div>
            </div>

            {/* 하단 버튼 */}
            <div style={{ padding: "14px 24px", borderTop: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 8, flexShrink: 0, background: "var(--bg)" }}>
              <button className="btn secondary" style={{ fontSize: 13, height: 36, padding: "0 16px" }} onClick={() => setShowEditModal(false)}>취소</button>
              <button className="btn secondary" style={{ fontSize: 13, height: 36, padding: "0 16px", color: "#ef4444" }} onClick={async () => {
                if (!confirm(`${data.member.name} 회원을 삭제 처리할까요?`)) return;
                const res = await apiFetch("/api/members/delete", { method: "POST", body: JSON.stringify({ member_id: data.member.member_id }) });
                const json = await res.json();
                if (json.success) { alert("회원 삭제 완료"); location.href = "/members"; }
                else alert(json.message || "회원 삭제 실패");
              }}>삭제</button>
              <div style={{ marginLeft: "auto" }}>
                <button className="btn" disabled={editSaving} style={{ fontSize: 13, height: 36, padding: "0 20px", fontWeight: 700 }} onClick={async () => {
                  setEditSaving(true);
                  const payload = {
                    member_id: data.member.member_id,
                    branch_name: editForm.branch_name,
                    name: editForm.name,
                    phone: editForm.phone,
                    checkin_code: editForm.checkin_code,
                    gender: editForm.gender,
                    birth_date: editForm.birth_date,
                    locker_no: editForm.locker_number,
                    locker_end_date: editForm.locker_end_date,
                    staff_name: editForm.coach_name,
                    product_name: editForm.product_name,
                    pass_type: editForm.pass_type,
                    weekly_limit: editForm.weekly_limit,
                    start_date: editForm.start_date,
                    end_date: editForm.end_date,
                    remaining_count: editForm.remaining_count,
                    has_uniform: editForm.has_sportswear,
                    has_locker: editForm.has_locker,
                    attendance_sms_enabled: editForm.has_sms,
                    checkin_sms_enabled: editForm.has_sms,
                    checkout_sms_enabled: editForm.has_exit_sms,
                    memo: editForm.notes,
                    payment_changed: false,
                  };
                  const res = await apiFetch("/api/members/update", { method: "POST", body: JSON.stringify(payload) });
                  const json = await res.json();
                  setEditSaving(false);
                  if (json.success) { setShowEditModal(false); location.reload(); }
                  else alert(json.message || "저장 실패");
                }}>{editSaving ? "저장 중..." : "수정 저장"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
function SumItem({ label, value, valueEl, nowrap }: { label: string; value?: string; valueEl?: JSX.Element; nowrap?: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 4, fontSize: 13, whiteSpace: nowrap ? "nowrap" : undefined }}>
      <span style={{ color: "#9ca3af", fontWeight: 400 }}>{label}</span>
      {valueEl ?? <strong style={{ fontWeight: 600, color: "#111827" }}>{value}</strong>}
    </span>
  );
}

function Info({ label, value, wide }: { label: string; value: any; wide?: boolean }) {
  return (
    <div style={{ padding: "6px 0", gridColumn: wide ? "1 / -1" : undefined }}>
      <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, color: "#111827", wordBreak: "break-word" }}>{value}</div>
    </div>
  );
}