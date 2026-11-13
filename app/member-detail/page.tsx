"use client";

import { useEffect, useState } from "react";
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
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-based
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // 날짜별 출석 맵
  const byDate: Record<string, any[]> = {};
  checkins.forEach((c) => {
    // checkin_time이 "2026-11-08 05:25:00" 형식이면 앞 10자리만 사용
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

  // 달력 생성
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const pad = (n: number) => String(n).padStart(2, "0");
  const monthTotal = Object.entries(byDate).filter(([d]) =>
    d.startsWith(`${year}-${pad(month + 1)}`)
  ).reduce((s, [, arr]) => s + arr.length, 0);

  const selectedCheckins = selectedDate ? (byDate[selectedDate] || []) : [];

  return (
    <div className="card" style={{ borderRadius: 24, marginBottom: 18 }}>
      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>출석 기록</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: "#888" }}>이번 달 {monthTotal}회</span>
          <button onClick={prevMonth} style={btnStyle}>◀</button>
          <span style={{ fontSize: 14, fontWeight: 700, minWidth: 80, textAlign: "center" }}>
            {year}.{pad(month + 1)}
          </span>
          <button onClick={nextMonth} style={btnStyle}>▶</button>
        </div>
      </div>

      {/* 요일 헤더 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
        {["일", "월", "화", "수", "목", "금", "토"].map((d, i) => (
          <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 700,
            color: i === 0 ? "#ef4444" : i === 6 ? "#2563eb" : "#888", padding: "2px 0" }}>
            {d}
          </div>
        ))}
      </div>

      {/* 날짜 셀 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const dateStr = `${year}-${pad(month + 1)}-${pad(day)}`;
          const records = byDate[dateStr] || [];
          const hasAttendance = records.length > 0;
          const isSelected = selectedDate === dateStr;
          const dow = i % 7;
          return (
            <div
              key={i}
              onClick={() => setSelectedDate(isSelected ? null : dateStr)}
              style={{
                borderRadius: 8, padding: "6px 2px", textAlign: "center", cursor: hasAttendance ? "pointer" : "default",
                background: isSelected ? "#2563eb" : hasAttendance ? "#dbeafe" : "transparent",
                border: isSelected ? "2px solid #1d4ed8" : "2px solid transparent",
                transition: "background 0.1s",
              }}
            >
              <div style={{
                fontSize: 13, fontWeight: hasAttendance ? 800 : 400,
                color: isSelected ? "#fff" : dow === 0 ? "#ef4444" : dow === 6 ? "#2563eb" : hasAttendance ? "#1d4ed8" : "#374151",
              }}>{day}</div>
              {hasAttendance && (() => {
                const inCnt = records.filter((r: any) => r.result === "SUCCESS").length;
                const outCnt = records.filter((r: any) => r.result === "CHECK_OUT").length;
                return (
                  <div style={{ fontSize: 9, lineHeight: 1.4, marginTop: 1 }}>
                    {inCnt > 0 && <div style={{ color: isSelected ? "#bfdbfe" : "#2563eb", fontWeight: 700 }}>입 {inCnt}</div>}
                    {outCnt > 0 && <div style={{ color: isSelected ? "#fde68a" : "#d97706", fontWeight: 700 }}>출 {outCnt}</div>}
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>

      {/* 선택된 날짜 상세 */}
      {selectedDate && (
        <div style={{ marginTop: 14, borderTop: "1px solid var(--border, #e5e7eb)", paddingTop: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: "#374151" }}>
            {selectedDate} 출석 ({selectedCheckins.length}건)
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {selectedCheckins.map((c) => (
              <div key={c.attendance_id} style={{
                background: "var(--panel2, #f8fafc)", borderRadius: 10, padding: "10px 14px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>
                    {new Date(c.checkin_time).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                  <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>
                    {c.result === "CHECK_OUT" ? "운동 종료" : c.result === "SUCCESS" ? "출석 완료" : c.result}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                  {passType === "COUNT" && (
                    <div style={{ fontSize: 10, color: "#d97706", textAlign: "right", lineHeight: 1.3 }}>
                      횟수권 출석 취소가 일시 제한됨
                    </div>
                  )}
                  <button
                    className="btn secondary"
                    style={{ fontSize: 12, padding: "4px 10px", color: "#ef4444" }}
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

      {checkins.length === 0 && (
        <div style={{ color: "#888", marginTop: 12 }}>출석 기록이 없습니다.</div>
      )}
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  background: "none", border: "1px solid #e2e8f0", borderRadius: 6,
  padding: "2px 8px", cursor: "pointer", fontSize: 13, color: "#374151",
};
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
  const [addPayForm, setAddPayForm] = useState({ product_name: "", final_amount: "", payment_method: "CARD", payment_date: new Date().toISOString().slice(0,10), start_date: "", memo: "", payment_purpose: "PASS" as "PASS" | "GENERAL" });
  // 환불 모달: refundTarget에 원결제 행 저장
  const [refundTarget, setRefundTarget] = useState<any>(null);
  const [refundForm, setRefundForm] = useState({ refund_amount: "", refund_reason: "" });
  const [refundSubmitting, setRefundSubmitting] = useState(false);
  const [products, setProducts] = useState<any[]>([]);

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

    } else {
      alert(
        json.message ||
          "조회 실패"
      );
    }
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
          {/* 컴팩트 헤더 */}
          <div className="card" style={{ marginBottom: 8, padding: "12px 16px", borderRadius: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 24, fontWeight: 900 }}>{data.member.name}</span>
              {(() => {
                const st = getMemberStatus(data.member);
                return (
                  <span style={{ background: `${st.color}22`, color: st.color, padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 900 }}>
                    {st.text}
                  </span>
                );
              })()}
              {Number(data.member.remaining_count || 0) > 0 && Number(data.member.remaining_count) <= 3 && (
                <span style={{ background: "rgba(255,77,109,.15)", color: "#ff4d6d", padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 900 }}>횟수부족</span>
              )}
              <button className="btn secondary"
                style={{ fontSize: 12, padding: "3px 12px", height: 28, marginLeft: 4 }}
                onClick={() => location.href = `/members?member_id=${data.member.member_id}&return=detail`}>
                수정
              </button>
              <span style={{ fontSize: 13, color: "#9ca3af" }}>
                {data.member.branch_name} · {data.member.phone}
              </span>
            </div>
            <div style={{ marginTop: 8, display: "flex", gap: 20, flexWrap: "wrap", fontSize: 13 }}>
              <span><span style={{ color: "#6b7280" }}>회원번호 </span><strong>{data.member.member_no || "-"}</strong></span>
              <span><span style={{ color: "#6b7280" }}>출석번호 </span><strong>{data.member.checkin_code || "-"}</strong></span>
              <span><span style={{ color: "#6b7280" }}>담당자 </span><strong>{data.member.staff_name || "-"}</strong></span>
            </div>
          </div>

          {/* 이용정보 띠 */}
          <div className="card" style={{ marginBottom: 10, padding: "10px 16px", borderRadius: 14 }}>
            <div style={{ display: "flex", gap: 32, flexWrap: "wrap", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 3 }}>회원권</div>
                <div style={{ fontWeight: 800, fontSize: 15 }}>{data.member.product_name || "-"}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 3 }}>이용기간</div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>
                  {data.member.start_date?.slice(0, 10) || "-"} ~ {data.member.end_date?.slice(0, 10) || "-"}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 3 }}>잔여</div>
                {(() => {
                  const r = getRemaining(data.member);
                  return <div style={{ fontWeight: 800, fontSize: 15, color: r.color }}>{r.text}</div>;
                })()}
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 3 }}>락카</div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{data.member.locker_no || "없음"}</div>
              </div>
            </div>
          </div>

          <div
            className="card"
            style={{
              borderRadius: 14,
              marginBottom: 10,
              padding: "8px 12px",
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            {[
              ["INFO", "기본정보"],
              ["PAY", "결제내역"],
              ["ATT", "출석기록"],
              ["NOTE", "상담/메모"],
              ["FILE", "입관서/파일"],
              ["HISTORY", "변경이력"],
            ].map(([key, label]) => (
              <button
                key={key}
                className={tab === key ? "btn" : "btn secondary"}
                onClick={() => setTab(key)}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "FILE" && (
            <div
              className="card"
              style={{
                borderRadius: 24,
                marginBottom: 18,
              }}
            >
              <h2
                style={{
                  marginTop: 0,
                }}
              >
                입관서 / 회원자료
              </h2>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "160px 1fr auto",
                  gap: 12,
                  marginBottom: 18,
                }}
              >
                <select
                  className="input"
                  value={
                    fileForm.file_type
                  }
                  onChange={(e) =>
                    setFileForm({
                      ...fileForm,
                      file_type:
                        e.target
                          .value,
                    })
                  }
                >
                  <option>
                    입관서
                  </option>

                  <option>
                    개인정보동의서
                  </option>

                  <option>
                    인바디
                  </option>

                  <option>
                    회원사진
                  </option>

                  <option>
                    기타
                  </option>
                </select>

                <input
                  className="input"
                  placeholder="메모"
                  value={
                    fileForm.memo
                  }
                  onChange={(e) =>
                    setFileForm({
                      ...fileForm,
                      memo:
                        e.target
                          .value,
                    })
                  }
                />

                <label
                  className="btn"
                  style={{
                    cursor:
                      "pointer",
                  }}
                >
                  {uploading
                    ? "업로드중..."
                    : "사진 업로드"}

                  <input
                    type="file"
                    accept="image/*,.pdf"
                    hidden
                    onChange={
                      uploadFile
                    }
                  />
                </label>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fill,minmax(220px,1fr))",
                  gap: 14,
                }}
              >
                {files.map((f) => (
                  <a
                    key={f.file_id}
                    href={f.file_url}
                    target="_blank"
                    style={{
                      background:
                        "var(--panel2)",
                      borderRadius: 18,
                      padding: 14,
                      textDecoration:
                        "none",
                      color: "var(--text)",
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 900,
                        fontSize: 18,
                      }}
                    >
                      {
                        f.file_type
                      }
                    </div>

                    <div
                      style={{
                        marginTop: 8,
                        color:
                          "#888",
                        fontSize: 13,
                      }}
                    >
                      {
                        f.file_name
                      }
                    </div>

                    <div
                      style={{
                        marginTop: 10,
                        color:
                          "#aaa",
                        fontSize: 13,
                        whiteSpace:
                          "pre-wrap",
                      }}
                    >
                      {f.memo}
                    </div>
                  </a>
                ))}

                {files.length ===
                  0 && (
                  <div
                    style={{
                      color:
                        "#888",
                    }}
                  >
                    업로드된 파일이
                    없습니다.
                  </div>
                )}
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
            <div
              className="card"
              style={{
                borderRadius: 24,
                marginBottom: 18,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h2 style={{ margin: 0 }}>결제내역</h2>
                <button className="btn" style={{ fontSize: 13, padding: "6px 14px" }} onClick={() => { const nextDay = data?.member?.end_date ? data.member.end_date.slice(0,10) : new Date().toISOString().slice(0,10); setAddPayForm({ product_name: "", final_amount: "", payment_method: "CARD", payment_date: new Date().toISOString().slice(0,10), start_date: nextDay, memo: "", payment_purpose: "PASS" }); setAddPayModal(true); }}>+ 결제 추가</button>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "100px 1fr 100px 90px 180px",
                  gap: 8,
                  padding: "10px 12px",
                  color: "#888",
                  fontWeight: 700,
                  borderBottom:
                    "1px solid #374151",
                }}
              >
                <div>결제일</div>
                <div>상품</div>
                <div>금액</div>
                <div>수단</div>
                <div>관리</div>
              </div>

              <div
                style={{
                  display: "grid",
                  gap: 8,
                  marginTop: 10,
                }}
              >
                {payments.map((p) => {
                  const isCancelled = String(p.memo || "").startsWith("[취소]");
                  return (
                  <div
                    key={p.payment_id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "100px 1fr 100px 90px 180px",
                      gap: 8,
                      background: isCancelled ? "rgba(239,68,68,0.07)" : "var(--panel2)",
                      borderRadius: 12,
                      padding: 12,
                      alignItems: "center",
                      opacity: isCancelled ? 0.6 : 1,
                    }}
                  >
                    <div style={{ fontSize: 13 }}>
                      {p.payment_date?.slice(0, 10)}
                    </div>
                    <div style={{ fontSize: 13, minWidth: 0, wordBreak: "break-word" }}>
                      {p.product_name || "-"}
                      {isCancelled && <span style={{ marginLeft: 6, color: "#ef4444", fontWeight: 700, fontSize: 11 }}>취소됨</span>}
                    </div>
                    <div style={{ fontWeight: 900 }}>
                      {isCancelled ? <s style={{ color: "#ef4444" }}>{money(p.refund_amount)}</s> : money(p.final_amount)}
                    </div>
                    <div style={{ fontSize: 13 }}>
                      {p.payment_method === "CARD" ? "카드" : p.payment_method === "CASH" ? "현금" : p.payment_method === "TRANSFER" ? "계좌이체" : p.payment_method}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
                      {!isCancelled && (
                        <>
                          <button
                            className="btn secondary"
                            style={{ fontSize: 11, padding: "3px 8px" }}
                            onClick={() => {
                              setEditPayment(p);
                              setEditPayForm({
                                product_name: p.product_name || "",
                                final_amount: String(p.final_amount || ""),
                                payment_method: p.payment_method || "CARD",
                                payment_date: p.payment_date?.slice(0, 10) || "",
                                memo: p.memo || "",
                              });
                            }}
                          >
                            수정
                          </button>
                          <button
                            className="btn secondary"
                            style={{ fontSize: 11, padding: "3px 8px", color: "#ef4444" }}
                            onClick={async () => {
                              if (!confirm(`${p.product_name} 결제를 취소할까요?`)) return;
                              const res = await apiFetch("/api/payments/cancel", {
                                method: "POST",
                                body: JSON.stringify({ payment_id: p.payment_id }),
                              });
                              const json = await res.json();
                              if (json.success) load();
                              else alert(json.message || "취소 실패");
                            }}
                          >
                            취소
                          </button>
                          {/* 환불: pass_type 있는 결제(회원권)에만 표시 */}
                          {p.pass_type && (
                            <button
                              className="btn secondary"
                              style={{ fontSize: 11, padding: "3px 8px", color: "#7c3aed" }}
                              onClick={() => {
                                setRefundTarget(p);
                                setRefundForm({ refund_amount: "", refund_reason: "" });
                              }}
                            >
                              환불
                            </button>
                          )}
                          <button
                            className="btn"
                            style={{ fontSize: 11, padding: "3px 8px", background: "#ef4444", marginLeft: 8 }}
                            onClick={async () => {
                              if (!confirm(`${p.product_name} 결제를 완전 삭제할까요?\n삭제 후 복구 불가합니다.`)) return;
                              const res = await apiFetch(`/api/payments/delete?payment_id=${p.payment_id}`, { method: "DELETE" });
                              const json = await res.json();
                              if (json.success) load();
                              else alert(json.message || "삭제 실패");
                            }}
                          >
                            삭제
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  );
                })}

                {payments.length ===
                  0 && (
                  <div
                    style={{
                      color: "#888",
                    }}
                  >
                    결제내역이
                    없습니다.
                  </div>
                )}
              </div>
            </div>
          )}
          {tab === "NOTE" && (
            <div
              className="card"
              style={{
                borderRadius: 24,
                marginBottom: 18,
              }}
            >
              <h2 style={{ marginTop: 0 }}>
                상담 / 메모
              </h2>

              <textarea
                className="input"
                value={memo}
                onChange={(e) =>
                  setMemo(e.target.value)
                }
                placeholder="회원 메모"
                style={{
                  width: "100%",
                  minHeight: 100,
                }}
              />

              <button
                className="btn"
                onClick={saveMemo}
                style={{
                  marginTop: 10,
                }}
              >
                메모 저장
              </button>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "160px 1fr auto",
                  gap: 12,
                  marginTop: 20,
                }}
              >
                <select
                  className="input"
                  value={
                    noteForm.note_type
                  }
                  onChange={(e) =>
                    setNoteForm({
                      ...noteForm,
                      note_type:
                        e.target.value,
                    })
                  }
                >
                  <option>
                    상담
                  </option>

                  <option>
                    문의
                  </option>

                  <option>
                    주의사항
                  </option>

                  <option>
                    기타
                  </option>
                </select>

                <input
                  className="input"
                  placeholder="상담 내용 입력"
                  value={
                    noteForm.content
                  }
                  onChange={(e) =>
                    setNoteForm({
                      ...noteForm,
                      content:
                        e.target.value,
                    })
                  }
                />

                <button
                  className="btn"
                  onClick={addNote}
                >
                  추가
                </button>
              </div>

              <div
                style={{
                  display: "grid",
                  gap: 8,
                  marginTop: 18,
                }}
              >
                {notes.map((n) => (
                  <div
                    key={n.note_id}
                    style={{
                      background:
                        "var(--panel2)",
                      borderRadius: 12,
                      padding: 12,
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 900,
                      }}
                    >
                      {n.note_type}
                    </div>

                    <div
                      style={{
                        marginTop: 6,
                        whiteSpace:
                          "pre-wrap",
                      }}
                    >
                      {n.content}
                    </div>

                    <div
                      style={{
                        marginTop: 6,
                        color: "#666",
                        fontSize: 12,
                      }}
                    >
                      {n.created_at
                        ? new Date(
                            n.created_at
                          ).toLocaleString()
                        : ""}
                    </div>
                  </div>
                ))}

                {notes.length ===
                  0 && (
                  <div
                    style={{
                      color: "#888",
                    }}
                  >
                    상담기록이
                    없습니다.
                  </div>
                )}
              </div>
            </div>
          )}
          {tab === "INFO" && (
            <div className="card" style={{ borderRadius: 14, marginBottom: 16, padding: "14px 16px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
                <Info label="성별" value={data.member.gender || "-"} />
                <Info label="생년월일" value={data.member.birth_date?.slice(0, 10) || "-"} />
                <Info label="비상연락처" value={data.member.emergency_contact || "-"} />
                <Info label="가입일" value={data.member.join_date?.slice(0, 10) || "-"} />
                <Info label="상태" value={
                  data.member.status === "ACTIVE" ? "정상"
                  : data.member.status === "EXPIRED" ? "만료"
                  : data.member.status === "REST" ? "휴회"
                  : data.member.status || "-"
                } />
                <Info label="주소" value={data.member.address || "-"} />
              </div>
            </div>
          )}

          {tab === "HISTORY" && (
            <div
              className="card"
              style={{
                borderRadius: 24,
                marginBottom: 18,
              }}
            >
              <h2 style={{ marginTop: 0 }}>
                변경이력
              </h2>

              <div style={{ display: "grid", gap: 10 }}>
                {histories.map((h) => {
                  const type = h.history_type || h.action_type || "";
                  const typeLabel: Record<string, string> = {
                    HOLD: "휴회", HOLD_RELEASE: "휴회 해제",
                    PAYMENT: "회원권 결제", DAILY_PASS: "일일권 결제",
                    REGISTER: "회원권 등록", RENEW: "회원권 재등록",
                    EXTEND: "기간 연장", BULK_EXTEND: "일괄 연장",
                    CANCEL: "결제 취소", CORRECTION: "수동 수정",
                    UPDATE: "정보 수정", IMPORT: "데이터 가져오기",
                    LOCKER_EXTEND: "라커 기간 연장",
                  };
                  const typeColor: Record<string, string> = {
                    HOLD: "#f59e0b", HOLD_RELEASE: "#10b981",
                    PAYMENT: "#3b82f6", DAILY_PASS: "#6366f1",
                    REGISTER: "#3b82f6", RENEW: "#3b82f6",
                    CANCEL: "#ef4444",
                  };

                  // UPDATE 타입: old/new JSON diff로 변경 필드 추출
                  let diffLines: string[] = [];
                  if (type === "UPDATE" && h.old_value && h.new_value) {
                    try {
                      const oldJ = typeof h.old_value === "string" ? JSON.parse(h.old_value) : h.old_value;
                      const newJ = typeof h.new_value === "string" ? JSON.parse(h.new_value) : h.new_value;
                      const fieldLabel: Record<string, string> = {
                        end_date: "만료일", start_date: "시작일", product_name: "회원권",
                        remaining_count: "잔여횟수", status: "상태",
                        name: "이름", phone: "전화번호", birth_date: "생년월일",
                        gender: "성별", address: "주소", staff_name: "담당자",
                      };
                      const statusLabel: Record<string, string> = {
                        ACTIVE: "정상", REST: "휴회중", EXPIRED: "만료", DELETED: "삭제",
                      };
                      for (const [k, label] of Object.entries(fieldLabel)) {
                        const ov = oldJ[k] ?? "";
                        const nv = newJ[k] ?? "";
                        const ovStr = String(ov).slice(0, 10);
                        const nvStr = String(nv).slice(0, 10);
                        if (ovStr !== nvStr && nvStr !== "") {
                          const fmt = (v: string) => k === "status" ? (statusLabel[v] || v) : v;
                          diffLines.push(`${label}: ${fmt(ovStr) || "없음"} → ${fmt(nvStr)}`);
                        }
                      }
                    } catch {}
                  }

                  return (
                    <div key={h.history_id} style={{ background: "var(--panel2)", borderRadius: 14, padding: 14, borderLeft: `3px solid ${typeColor[type] || "var(--border, #e5e7eb)"}` }}>
                      <div style={{ fontWeight: 900, fontSize: 15, color: typeColor[type] || undefined }}>
                        {typeLabel[type] || type || "변경"}
                      </div>
                      {type === "HOLD" || type === "HOLD_RELEASE" ? (
                        <div style={{ marginTop: 6, fontSize: 13, color: "var(--muted, #888)", whiteSpace: "pre-wrap" }}>
                          {h.action_memo || "-"}
                        </div>
                      ) : diffLines.length > 0 ? (
                        <div style={{ marginTop: 6, fontSize: 13, color: "var(--muted, #888)" }}>
                          {diffLines.map((l, i) => <div key={i}>{l}</div>)}
                        </div>
                      ) : (h.action_memo && h.action_memo !== "회원정보 수정") ? (
                        <div style={{ marginTop: 6, fontSize: 13, color: "var(--muted, #888)" }}>{h.action_memo}</div>
                      ) : null}
                      <div style={{ marginTop: 8, color: "#999", fontSize: 12 }}>
                        {h.created_at ? new Date(h.created_at).toLocaleString("ko-KR") : ""}
                        {h.created_by ? ` · ${h.created_by}` : ""}
                      </div>
                    </div>
                  );
                })}

                {histories.length ===
                  0 && (
                  <div
                    style={{
                      color: "#888",
                    }}
                  >
                    변경이력이
                    없습니다.
                  </div>
                )}
              </div>
            </div>
          )}
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
              <select className="input" value={addPayForm.product_name} onChange={e => {
                const val = e.target.value;
                const passProduct = products.find((p: any) => p.option_name === val);
                const generalItems = ["락커 이용료", "운동복 이용료", "수건 이용료"];
                const isGeneral = generalItems.includes(val);
                setAddPayForm({
                  ...addPayForm,
                  product_name: val,
                  payment_purpose: isGeneral ? "GENERAL" : "PASS",
                  final_amount: passProduct?.amount ? String(passProduct.amount) : addPayForm.final_amount,
                });
              }}>
                <option value="">상품 선택</option>
                <optgroup label="회원권">
                  {products.filter((p: any) => p.option_name !== "일일권").map((p: any) => <option key={p.option_id} value={p.option_name}>{p.option_name}</option>)}
                </optgroup>
                <optgroup label="일일권">
                  {products.filter((p: any) => p.option_name === "일일권").map((p: any) => <option key={p.option_id} value={p.option_name}>{p.option_name}</option>)}
                </optgroup>
                <optgroup label="기타">
                  <option value="락커 이용료">락커 이용료</option>
                  <option value="운동복 이용료">운동복 이용료</option>
                  <option value="수건 이용료">수건 이용료</option>
                </optgroup>
              </select>
              <input className="input" type="number" placeholder="결제금액" value={addPayForm.final_amount} onChange={e => setAddPayForm({ ...addPayForm, final_amount: e.target.value })} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {([["CARD","카드"],["CASH","현금"],["TRANSFER","계좌이체"]] as const).map(([m, l]) => (
                  <button key={m} className={addPayForm.payment_method === m ? "btn" : "btn secondary"} onClick={() => setAddPayForm({ ...addPayForm, payment_method: m })}>{l}</button>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>결제일</div>
                  <input className="input" type="date" value={addPayForm.payment_date} onChange={e => setAddPayForm({ ...addPayForm, payment_date: e.target.value })} />
                </div>
                {addPayForm.payment_purpose === "PASS" && addPayForm.product_name !== "일일권" && (
                  <div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>시작일</div>
                    <input className="input" type="date" value={addPayForm.start_date} onChange={e => setAddPayForm({ ...addPayForm, start_date: e.target.value })} />
                  </div>
                )}
              </div>
              <textarea className="input" placeholder="메모" value={addPayForm.memo} onChange={e => setAddPayForm({ ...addPayForm, memo: e.target.value })} style={{ minHeight: 60 }} />
              <button className="btn" style={{ fontSize: 16 }} onClick={async (e) => {
                if (!addPayForm.product_name) return alert(addPayForm.payment_purpose === "PASS" ? "상품을 선택해주세요." : "항목명을 입력해주세요.");
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
                      start_date: addPayForm.payment_purpose === "PASS" && addPayForm.start_date ? addPayForm.start_date : undefined,
                      memo: addPayForm.memo,
                      payment_purpose: addPayForm.payment_purpose,
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
    </AppShell>
  );
}
function Info({
  label,
  value,
}: {
  label: string;
  value: any;
}) {
  return (
    <div
      style={{
        background: "var(--panel2)",
        borderRadius: 8,
        padding: "8px 10px",
        minHeight: 42,
      }}
    >
      <div style={{ color: "#888", fontSize: 12 }}>{label}</div>
      <div style={{ marginTop: 3, fontWeight: 800, fontSize: 13 }}>{value}</div>
    </div>
  );
}