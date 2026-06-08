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
    new Date(value)
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
        r.start_datetime?.slice(
          0,
          10
        ) === selectedDate
    )
    .sort((a, b) =>
      String(a.start_datetime || "9999-99-99 99:99").localeCompare(
        String(b.start_datetime || "9999-99-99 99:99")
      )
    );

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
            onChange={setValue}
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
            tileContent={({
              date,
            }) => {
              const count =
                getCount(date);

              if (
                count === 0
              )
                return null;

              return (
                <div className="calendar-count">
                  {count}건
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
          </div>

          {selectedRows.length ===
          0 ? (
            <div
              style={{
                padding: 40,
                borderRadius: 18,
                background:
                  "#0b1220",
                color: "#888",
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
                    style={{
                      padding: 18,
                      borderRadius: 22,
                      background:
                        "#0f172a",
                      border:
                        "1px solid #273244",
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
                            color:
                              "#aaa",
                            marginTop: 10,
                          }}
                        >
                          {r.branch_name ||
                            "-"}
                        </div>

                        <div
                          style={{
                            color:
                              "#aaa",
                            marginTop: 6,
                          }}
                        >
                          {
                            r.title || r.memo || "-"
                          }
                        </div>

                        <div
                          style={{
                            color:
                              "#94a3b8",
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
                      {r.created_at
                        ?.slice(0, 16)
                        .replace(
                          "T",
                          " "
                        ) || "-"}
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}