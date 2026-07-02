"use client";

import "react-calendar/dist/Calendar.css";

import { useEffect, useState } from "react";
import Calendar from "react-calendar";
import Holidays from "date-holidays";
import { apiFetch } from "@/lib/api";
import AppShell from "@/components/AppShell";

const holidays = new Holidays("KR");

export default function NaverCalendarPage() {
  const [value, setValue] = useState<any>(new Date());
  const [rows, setRows] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [branch, setBranch] = useState("전체");
  const [user, setUser] = useState<any>(null);
  const [mobile, setMobile] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [smsModal, setSmsModal] = useState<{ msg: string; pendingStatus: string } | null>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem("user");

    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }

    const checkMobile = () => {
      setMobile(window.innerWidth < 900);
    };

    checkMobile();

    window.addEventListener("resize", checkMobile);

    return () => {
      window.removeEventListener(
        "resize",
        checkMobile
      );
    };
  }, []);

  const isAdminOrOwner =
    user?.role === "ADMIN" ||
    user?.role === "OWNER";

  const toDateKey = (d: Date) => {
    const y = d.getFullYear();
    const m = String(
      d.getMonth() + 1
    ).padStart(2, "0");
    const day = String(
      d.getDate()
    ).padStart(2, "0");

    return `${y}-${m}-${day}`;
  };

  const selectedDate = toDateKey(
    Array.isArray(value) ? value[0] : value
  );

  const todayKey = toDateKey(
    new Date()
  );

  const isHoliday = (date: Date) => {
    return !!holidays.isHoliday(
      date
    );
  };

  const loadBranches = async () => {
    const res = await apiFetch(
      "/api/settings?option_type=BRANCH"
    );

    const data = await res.json();

    setBranches(data.rows || []);
  };

  const loadReservations = async () => {
      let url =
        "/api/calendar-events";

    if (
      !isAdminOrOwner &&
      user?.branch_name
    ) {
      url += `?branch_name=${encodeURIComponent(
        user.branch_name
      )}`;
    } else if (branch !== "전체") {
      url += `?branch_name=${encodeURIComponent(
        branch
      )}`;
    }

    const res = await apiFetch(url);

    const data = await res.json();

    setRows(data.rows || []);
  };

  useEffect(() => {
    loadBranches();
  }, []);

  useEffect(() => {
    if (user) {
      loadReservations();
    }
  }, [branch, user]);

  const selectedRows = rows
    .filter(
      (r) =>
        r.start_datetime?.slice(0, 10) === selectedDate &&
        r.status !== "취소" &&
        r.status !== "痍⑥냼"
    )
    .sort((a, b) =>
      String(a.start_datetime || "9999-99-99 99:99").localeCompare(
        String(b.start_datetime || "9999-99-99 99:99")
      )
    );
    
    const getTypeCounts = (targetRows: any[]) => {
      return {
        naver: targetRows.filter((r) =>
          String(r.event_type || "").includes("NAVER")
        ).length,
        kakao: targetRows.filter((r) =>
          String(r.event_type || "").includes("KAKAO")
        ).length,
        homepage: targetRows.filter((r) =>
          String(r.event_type || "").includes("HOMEPAGE")
        ).length,
        phone: targetRows.filter((r) =>
          String(r.event_type || "").includes("PHONE")
        ).length,
      };
    };

    const selectedTypeCounts = getTypeCounts(selectedRows);

  const getCount = (date: Date) => {
    const target = toDateKey(date);

    return rows.filter(
      (r) =>
        r.start_datetime?.slice(
          0,
          10
        ) === target
    ).length;
  };

  const getRowsByDate = (date: Date) => {
    const target = toDateKey(date);

    return rows.filter(
      (r) => r.start_datetime?.slice(0, 10) === target && r.status !== "취소" && r.status !== "痍⑥냼"
    );
  };

  const getStatusColor = (
    status: string
  ) => {
    if (status === "예약접수")
      return "#3b82f6";

    if (status === "예약확정")
      return "#22c55e";

    if (status === "확인완료")
      return "#8b5cf6";

    if (status === "상담완료")
      return "#f59e0b";

    if (status === "노쇼")
      return "#ef4444";

    if (status === "취소")
      return "#9ca3af";

    return "#aaa";
  };


const getTypeInfo = (r: any) => {
  const type = String(r.event_type || r.source_type || "");

  if (type.includes("NAVER")) {
    return { label: "네이버", color: "#22c55e" };
  }

  if (type.includes("HOMEPAGE")) {
    return { label: "홈페이지", color: "#3b82f6" };
  }

  if (type.includes("KAKAO")) {
    return { label: "카카오", color: "#facc15" };
  }

  if (type.includes("PHONE")) {
    return { label: "전화예약", color: "#f97316" };
  }

  return { label: "예약", color: "#94a3b8" };
};

  return (
    <AppShell title="예약 캘린더">
      <div
        className="card"
        style={{
          marginBottom: 18,
          borderRadius: 24,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 34,
                fontWeight: 900,
              }}
            >
              예약 캘린더
            </h1>

            <p
              style={{
                color: "#aaa",
                marginTop: 8,
              }}
            >
              날짜 선택 시 예약이
              카드형으로 표시됩니다.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            {isAdminOrOwner && (
              <select
                className="input"
                style={{
                  width: 220,
                }}
                value={branch}
                onChange={(e) =>
                  setBranch(
                    e.target.value
                  )
                }
              >
                <option>전체</option>

                {branches.map((b) => (
                  <option
                    key={b.option_id}
                  >
                    {
                      b.option_name
                    }
                  </option>
                ))}
              </select>
            )}

            <button
              className="btn secondary"
              onClick={
                loadReservations
              }
            >
              새로고침
            </button>
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            mobile
              ? "1fr"
              : "1.2fr 1fr",
          gap: 18,
          alignItems: "start",
        }}
      >
        <div
          className="card calendar-big"
          style={{
            borderRadius: 24,
            overflow: "hidden",
          }}
        >
          <Calendar
            onChange={(v) => setValue(v)}
            value={value}
            locale="ko-KR"
            calendarType="gregory"
            formatDay={(_, date) =>
              `${date.getDate()}`
            }
            tileClassName={({
              date,
              view,
            }) => {
              if (
                view !== "month"
              )
                return "";

              const key =
                toDateKey(date);

              if (
                key === todayKey
              )
                return "today";

              if (
                isHoliday(date)
              )
                return "holiday";

              if (
                date.getDay() ===
                0
              )
                return "sunday";

              if (
                date.getDay() ===
                6
              )
                return "saturday";

              return "";
            }}
            tileContent={({ date }) => {
              const dayRows = getRowsByDate(date);
              const count = dayRows.length;

              if (count === 0) return null;

              const typeCounts = getTypeCounts(dayRows);

              const dots = [
                ...Array(typeCounts.naver).fill("#22c55e"),
                ...Array(typeCounts.kakao).fill("#facc15"),
                ...Array(typeCounts.homepage).fill("#3b82f6"),
                ...Array(typeCounts.phone).fill("#f97316"),
              ].slice(0, 8);

              return (
                <div style={{ marginTop: 6 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      gap: 3,
                      flexWrap: "wrap",
                      marginBottom: 4,
                    }}
                  >
                    {dots.map((color, i) => (
                      <span
                        key={i}
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 999,
                          background: color,
                          display: "inline-block",
                        }}
                      />
                    ))}
                  </div>

                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 900,
                      color: count >= 5 ? "#ff4d6d" : "#2ee59d",
                    }}
                  >
                    {count >= 5 ? `🔥${count}건` : `${count}건`}
                  </div>
                </div>
              );
            }}
          />
        </div>

        <div
          className="card"
          style={{
            borderRadius: 24,
          }}
        >
          <div
            style={{
              marginBottom: 16,
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: 30,
                fontWeight: 900,
              }}
            >
              {selectedDate}
            </h2>

            <p
              style={{
                color: "#aaa",
                marginTop: 8,
              }}
            >
              총{" "}
              {
                selectedRows.length
              }
              건 예약
            </p>

            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                marginTop: 10,
              }}
            >
              {selectedTypeCounts.naver > 0 && (
                <span style={{ color: "#22c55e", fontWeight: 900 }}>
                  네이버 {selectedTypeCounts.naver}
                </span>
              )}

              {selectedTypeCounts.kakao > 0 && (
                <span style={{ color: "#facc15", fontWeight: 900 }}>
                  카카오 {selectedTypeCounts.kakao}
                </span>
              )}

              {selectedTypeCounts.homepage > 0 && (
                <span style={{ color: "#3b82f6", fontWeight: 900 }}>
                  홈페이지 {selectedTypeCounts.homepage}
                </span>
              )}

              {selectedTypeCounts.phone > 0 && (
                <span style={{ color: "#f97316", fontWeight: 900 }}>
                  전화 {selectedTypeCounts.phone}
                </span>
              )}
            </div>
          </div>

          {selectedRows.length ===
          0 ? (
            <div
              style={{
                padding: 40,
                borderRadius: 18,
                background: "var(--panel)",
                color: "var(--muted)",
                textAlign:
                  "center",
              }}
            >
              예약이 없습니다.
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gap: 12,
              }}
            >
              {selectedRows.map(
                (r) => (
                  <div
                    key={
                      r.event_id
                    }
                    onClick={() => setSelected(r)}
                    style={{
                      padding: 18,
                      borderRadius: 22,
                      cursor: "pointer",
                      background: "var(--panel)",
                      border: "1px solid var(--line)",
                      borderLeft: `7px solid ${getStatusColor(
                        r.status
                      )}`,
                    }}
                  >
                    <div
                      style={{
                        display:
                          "flex",
                        justifyContent:
                          "space-between",
                        gap: 10,
                        alignItems:
                          "start",
                        flexWrap:
                          "wrap",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: 26,
                            fontWeight: 900,
                          }}
                        >
                          {r.start_datetime?.slice(11, 16) ||
                            "-"}
                        </div>

                        <div
                          style={{
                            marginTop: 8,
                            fontSize: 22,
                            fontWeight: 900,
                          }}
                        >
                          {r.customer_name ||
                            "-"}
                        </div>

                        <div
                          style={{
                            color: "var(--muted)",
                            marginTop: 10,
                          }}
                        >
                          {r.branch_name ||
                            "-"}
                        </div>

                        <div
                          style={{
                            color: "var(--muted)",
                            marginTop: 6,
                          }}
                        >
                          {
                            r.title || r.memo || "-"
                          }
                        </div>

                        <div
                          style={{
                            color: "var(--muted)",
                            marginTop: 10,
                          }}
                        >
                          📞{" "}
                          {r.phone ||
                            "-"}
                        </div>
                      </div>

                      <div
                        style={{
                          display:
                            "grid",
                          gap: 10,
                        }}
                      >
                        {(() => {
                          const type = getTypeInfo(r);

                          return (
                            <div
                              style={{
                                padding: "8px 14px",
                                borderRadius: 999,
                                background: `${type.color}22`,
                                color: type.color,
                                fontWeight: 900,
                                textAlign: "center",
                              }}
                            >
                              {type.label}
                            </div>
                          );
                        })()}

                        <div
                          style={{
                            padding:
                              "8px 14px",
                            borderRadius: 999,
                            background: `${getStatusColor(
                              r.status
                            )}22`,
                            color:
                              getStatusColor(
                                r.status
                              ),
                            fontWeight: 900,
                            textAlign:
                              "center",
                          }}
                        >
                          ●{" "}
                          {
                            r.status
                          }
                        </div>

                        <button
                          className="btn secondary"
                          onClick={() => {
                            location.href = `/crm`;
                          }}
                        >
                          CRM 보기
                        </button>
                      </div>
                    </div>

                    <div
                      style={{
                        marginTop: 14,
                        color:
                          "#64748b",
                        fontSize: 13,
                      }}
                    >
                      예약 생성:
                      {" "}
                      {
                        r.created_at
                          ? r.created_at.slice(0, 16).replace("T", " ")
                          : "-"
                      }
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>
      
      {smsModal && selected && (
        <div
          onClick={() => setSmsModal(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            display: "grid",
            placeItems: "center",
            zIndex: 10000,
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="card"
            style={{ width: "100%", maxWidth: 520, borderRadius: 24 }}
          >
            <h3 style={{ marginTop: 0, marginBottom: 4 }}>📱 문자 내용 확인 및 수정</h3>
            <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 14 }}>
              수신: {selected.phone} ({selected.customer_name})
            </p>
            <textarea
              value={smsModal.msg}
              onChange={(e) => setSmsModal({ ...smsModal, msg: e.target.value })}
              style={{
                width: "100%",
                minHeight: 260,
                background: "var(--panel)",
                color: "var(--text)",
                border: "1px solid var(--line)",
                borderRadius: 12,
                padding: "14px 16px",
                fontSize: 14,
                fontFamily: "inherit",
                resize: "vertical",
                lineHeight: 1.6,
                marginBottom: 16,
              }}
            />
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="btn secondary" onClick={() => setSmsModal(null)}>취소</button>
              <button
                className="btn secondary"
                onClick={async () => {
                  const res = await apiFetch("/api/calendar-events/edit", {
                    method: "POST",
                    body: JSON.stringify({
                      event_id: selected.event_id,
                      customer_name: selected.customer_name,
                      phone: selected.phone,
                      start_datetime: selected.start_datetime,
                      event_type: selected.event_type,
                      status: smsModal.pendingStatus,
                      memo: selected.memo,
                    }),
                  });
                  const json = await res.json();
                  setSmsModal(null);
                  setSelected(null);
                  loadReservations();
                  alert(json.success ? "예약확정 완료 (문자 미발송)" : json.message || "처리 실패");
                }}
              >
                문자 없이 확정
              </button>
              <button
                className="btn"
                onClick={async () => {
                  const res = await apiFetch("/api/calendar-events/edit", {
                    method: "POST",
                    body: JSON.stringify({
                      event_id: selected.event_id,
                      customer_name: selected.customer_name,
                      phone: selected.phone,
                      start_datetime: selected.start_datetime,
                      event_type: selected.event_type,
                      status: smsModal.pendingStatus,
                      memo: selected.memo,
                    }),
                  });
                  const json = await res.json();
                  if (!json.success) { alert(json.message || "처리 실패"); return; }

                  const smsRes = await apiFetch("/api/sms/send-reservation", {
                    method: "POST",
                    body: JSON.stringify({
                      phone: selected.phone,
                      branch_name: selected.branch_name,
                      message: smsModal.msg,
                      receiver_name: selected.customer_name,
                    }),
                  });
                  const smsJson = await smsRes.json();

                  setSmsModal(null);
                  setSelected(null);
                  loadReservations();
                  alert(smsJson.skipped ? "예약확정 완료 (5분 이내 중복 문자 방지)" : "예약확정 및 안내문자 발송 완료");
                }}
              >
                발송 및 확정
              </button>
            </div>
          </div>
        </div>
      )}

      {selected && (
        <div
          onClick={() => setSelected(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            display: "grid",
            placeItems: "center",
            zIndex: 9999,
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="card"
            style={{
              width: "100%",
              maxWidth: 620,
              borderRadius: 24,
            }}
          >
            <h2 style={{ marginTop: 0 }}>{selected.customer_name || "-"}</h2>

            <input className="input" value={selected.customer_name || ""} onChange={(e) => setSelected({ ...selected, customer_name: e.target.value })} placeholder="이름" style={{ marginBottom: 10 }} />
            <input className="input" value={selected.phone || ""} onChange={(e) => setSelected({ ...selected, phone: e.target.value })} placeholder="전화번호" style={{ marginBottom: 10 }} />
            <input className="input" type="datetime-local" value={selected.start_datetime?.slice(0, 16) || ""} onChange={(e) => setSelected({ ...selected, start_datetime: e.target.value })} style={{ marginBottom: 10 }} />

            <div style={{ marginTop: 4, marginBottom: 10, color: "#94a3b8", fontSize: 13 }}>
              지점 : {selected.branch_name || "-"} &nbsp;|&nbsp; 출처 : {getTypeInfo(selected).label} &nbsp;|&nbsp; 상태 : {selected.status || "-"}
            </div>

            <textarea
              className="input"
              value={selected.memo || ""}
              onChange={(e) => setSelected({ ...selected, memo: e.target.value })}
              placeholder="메모"
              style={{ width: "100%", minHeight: 100, resize: "none", marginBottom: 10 }}
            />

            <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
              {["예약접수", "예약확정", "상담완료", "노쇼", "취소"].map((s) => (
                <button
                  key={s}
                  className={selected.status === s ? "btn" : "btn secondary"}
                  onClick={async () => {
                    if (s === "예약확정") {
                      const dt = selected.start_datetime || "";
                      const date = dt.slice(0, 10);
                      const time = dt.slice(11, 16);
                      const smsMsg = `[스트롱복싱 ${selected.branch_name}]

${selected.customer_name}님 예약이 확정되었습니다.

방문일시 : ${date} ${time}
예약내용 : ${selected.title || "방문 상담"}

예약하신 시간에 뵙겠습니다.

감사합니다 🥊
스트롱복싱 ${selected.branch_name}`;

                      setSmsModal({ msg: smsMsg, pendingStatus: s });
                      return;
                    }

                    const res = await apiFetch("/api/calendar-events/edit", {
                      method: "POST",
                      body: JSON.stringify({
                        event_id: selected.event_id,
                        customer_name: selected.customer_name,
                        phone: selected.phone,
                        start_datetime: selected.start_datetime,
                        event_type: selected.event_type,
                        status: s,
                        memo: selected.memo,
                      }),
                    });
                    const json = await res.json();
                    if (json.success) {
                      alert(`${s} 처리 완료`);
                      setSelected(null);
                      loadReservations();
                    } else {
                      alert(json.message || "처리 실패");
                    }
                  }}
                >
                  {s}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 18 }}>
              <button className="btn secondary" onClick={() => setSelected(null)}>닫기</button>
              <button className="btn" onClick={async () => {
                const res = await apiFetch("/api/calendar-events/edit", {
                  method: "POST",
                  body: JSON.stringify({
                    event_id: selected.event_id,
                    customer_name: selected.customer_name,
                    phone: selected.phone,
                    start_datetime: selected.start_datetime,
                    event_type: selected.event_type,
                    status: selected.status,
                    memo: selected.memo,
                  }),
                });
                const json = await res.json();
                if (json.success) { alert("저장 완료"); setSelected(null); loadReservations(); }
                else alert(json.message || "저장 실패");
              }}>저장</button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}