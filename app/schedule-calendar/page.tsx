"use client";

import { useEffect, useMemo, useState } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";

const today = new Date();

const formatDate = (date: Date) => {
  return date.toISOString().slice(0, 10);
};

const formatTime = (v: string) => {
  if (!v) return "-";
  return v.slice(0, 5);
};

export default function ScheduleCalendarPage() {
  const [value, setValue] = useState<Date>(today);

  const [reservations, setReservations] = useState<any[]>([]);
  const [lessons, setLessons] = useState<any[]>([]);

  const [selectedDate, setSelectedDate] = useState(formatDate(today));

  const load = async () => {
    const [rRes, lRes] = await Promise.all([
      fetch("/api/naver-reservations"),
      fetch("/api/lessons"),
    ]);

    const rJson = await rRes.json();
    const lJson = await lRes.json();

    setReservations(rJson.rows || []);
    setLessons(lJson.rows || []);
  };

  useEffect(() => {
    load();
  }, []);

  const selectedReservations = useMemo(() => {
    return reservations.filter(
      (r) =>
        r.reservation_date?.slice(0, 10) === selectedDate
    );
  }, [reservations, selectedDate]);

  const selectedLessons = useMemo(() => {
    return lessons.filter(
      (l) =>
        l.lesson_date?.slice(0, 10) === selectedDate
    );
  }, [lessons, selectedDate]);

  const dayCounts = useMemo(() => {
    const map: any = {};

    reservations.forEach((r) => {
      const d = r.reservation_date?.slice(0, 10);

      if (!d) return;

      map[d] = (map[d] || 0) + 1;
    });

    lessons.forEach((l) => {
      const d = l.lesson_date?.slice(0, 10);

      if (!d) return;

      map[d] = (map[d] || 0) + 1;
    });

    return map;
  }, [reservations, lessons]);

  return (
    <div
      style={{
        padding: 24,
        background: "#020617",
        minHeight: "100vh",
        color: "white",
      }}
    >
      <h1
        style={{
          marginTop: 0,
          fontSize: 36,
          fontWeight: 900,
          marginBottom: 20,
        }}
      >
        예약 / PT 캘린더
      </h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "420px 1fr",
          gap: 20,
        }}
      >
        <div
          style={{
            background: "#111827",
            padding: 18,
            borderRadius: 20,
            border: "1px solid #273244",
          }}
        >
          <Calendar
            onChange={(v: any) => {
              setValue(v);

              const d = formatDate(v);
              setSelectedDate(d);
            }}
            value={value}
            locale="ko-KR"
            tileContent={({ date, view }) => {
              if (view !== "month") return null;

              const key = formatDate(date);
              const count = dayCounts[key] || 0;

              if (!count) return null;

              return (
                <div
                  style={{
                    marginTop: 4,
                    fontSize: 11,
                    color: "#2ee59d",
                    fontWeight: 900,
                  }}
                >
                  {count}건
                </div>
              );
            }}
          />
        </div>

        <div
          style={{
            display: "grid",
            gap: 16,
            alignContent: "start",
          }}
        >
          <div
            style={{
              background: "#111827",
              borderRadius: 20,
              padding: 18,
              border: "1px solid #273244",
            }}
          >
            <h2
              style={{
                marginTop: 0,
                marginBottom: 18,
                fontSize: 28,
              }}
            >
              {selectedDate} 일정
            </h2>

            <div
              style={{
                display: "grid",
                gap: 12,
              }}
            >
              {selectedReservations.map((r) => (
                <div
                  key={`r-${r.reservation_id}`}
                  style={{
                    background: "#0b1220",
                    borderRadius: 16,
                    padding: 14,
                    borderLeft: "5px solid #3b82f6",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 900,
                        fontSize: 18,
                      }}
                    >
                      네이버 예약
                    </div>

                    <div
                      style={{
                        color: "#3b82f6",
                        fontWeight: 900,
                      }}
                    >
                      {formatTime(r.reservation_time)}
                    </div>
                  </div>

                  <div style={{ marginTop: 8 }}>
                    예약자: <b>{r.customer_name}</b>
                  </div>

                  <div style={{ marginTop: 6 }}>
                    상품: {r.reservation_product || "-"}
                  </div>

                  <div style={{ marginTop: 6 }}>
                    지점: {r.branch_name || "-"}
                  </div>

                  <div style={{ marginTop: 6 }}>
                    상태: {r.status}
                  </div>
                </div>
              ))}

              {selectedLessons.map((l) => (
                <div
                  key={`l-${l.lesson_id}`}
                  style={{
                    background: "#0b1220",
                    borderRadius: 16,
                    padding: 14,
                    borderLeft: "5px solid #22c55e",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 900,
                        fontSize: 18,
                      }}
                    >
                      PT / 수업
                    </div>

                    <div
                      style={{
                        color: "#22c55e",
                        fontWeight: 900,
                      }}
                    >
                      {formatTime(l.lesson_time)}
                    </div>
                  </div>

                  <div style={{ marginTop: 8 }}>
                    회원: <b>{l.member_name}</b>
                  </div>

                  <div style={{ marginTop: 6 }}>
                    코치: {l.coach_name || "-"}
                  </div>

                  <div style={{ marginTop: 6 }}>
                    종류: {l.lesson_type || "-"}
                  </div>

                  <div style={{ marginTop: 6 }}>
                    상태: {l.status || "-"}
                  </div>
                </div>
              ))}

              {selectedReservations.length === 0 &&
                selectedLessons.length === 0 && (
                  <div
                    style={{
                      background: "#111827",
                      borderRadius: 16,
                      padding: 30,
                      textAlign: "center",
                      color: "#aaa",
                    }}
                  >
                    일정이 없습니다.
                  </div>
                )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}