"use client";

import { useEffect, useState } from "react";

const today = new Date().toISOString().slice(0, 10);

export default function ReservationAlert() {
  const [rows, setRows] = useState<any[]>([]);
  const [visible, setVisible] = useState(true);

  const getUser = () => {
    const savedUser = localStorage.getItem("user");
    return savedUser ? JSON.parse(savedUser) : null;
  };

  const load = async () => {
    const user = getUser();

    let url = "/api/naver-reservations";

    if (user && user.role !== "ADMIN" && user.role !== "OWNER") {
      url += `?branch_name=${encodeURIComponent(user.branch_name)}`;
    }

    const res = await fetch(url);
    const data = await res.json();

    const now = new Date();

const todayRows = (data.rows || []).filter((r: any) => {
    if (
        r.reservation_date?.slice(0, 10) !== today ||
        r.status === "취소" ||
        r.status === "노쇼"
    ) {
        return false;
    }

    if (!r.reservation_time) {
        return true;
    }

    try {
        const [hour, minute] = r.reservation_time
        .replace("시", "")
        .replace("분", "")
        .split(":")
        .map(Number);

        const reservationDate = new Date();
        reservationDate.setHours(hour || 0);
        reservationDate.setMinutes(minute || 0);
        reservationDate.setSeconds(0);

        const diffMs = now.getTime() - reservationDate.getTime();

        const diffMinutes = diffMs / 1000 / 60;

        return diffMinutes <= 5;
    } catch {
        return true;
    }
});

    setRows(todayRows);
  };

  useEffect(() => {
    load();

    const timer = setInterval(() => {
      load();
    }, 30000);

    return () => clearInterval(timer);
  }, []);

  if (!visible || rows.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        right: 20,
        bottom: 20,
        width: 360,
        zIndex: 9999,
        background: "#111827",
        borderRadius: 18,
        padding: 16,
        boxShadow: "0 0 30px rgba(0,0,0,0.4)",
        border: "1px solid #374151",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 900 }}>
          오늘 예약 {rows.length}건
        </div>

        <button
          className="btn secondary"
          onClick={() => setVisible(false)}
        >
          닫기
        </button>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {rows.slice(0, 5).map((r) => (
          <div
            key={r.reservation_id}
            style={{
              padding: 12,
              borderRadius: 12,
              background: "#1f2937",
              borderLeft: "5px solid #2ee59d",
            }}
          >
            <div style={{ fontWeight: 900, fontSize: 18 }}>
              {r.customer_name}
            </div>

            <div style={{ color: "#aaa", marginTop: 4 }}>
              {r.branch_name} / {r.reservation_time || "-"}
            </div>

            <div
              style={{
                color: "#2ee59d",
                marginTop: 4,
                fontWeight: 900,
              }}
            >
              {r.status}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}