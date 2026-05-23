"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { apiFetch } from "@/lib/api";

export default function AttendanceMonitorPage() {
  const [rows, setRows] = useState<any[]>([]);

  const getUser = () => {
    const savedUser = localStorage.getItem("user");
    return savedUser ? JSON.parse(savedUser) : null;
  };

  const loadAttendance = async () => {
    const user = getUser();

    let url = "/api/attendance";

    if (user && user.role !== "ADMIN" && user.role !== "OWNER") {
      url += `?branch_name=${encodeURIComponent(user.branch_name)}`;
    }

    const res = await apiFetch(url);
    const data = await res.json();

    setRows(data.rows || []);
  };

  useEffect(() => {
    loadAttendance();

    const timer = setInterval(() => {
      loadAttendance();
    }, 3000);

    return () => clearInterval(timer);
  }, []);

  const getResultText = (result: string) => {
    switch (result) {
      case "SUCCESS":
        return "출석 완료";

      case "NOT_FOUND":
        return "회원 없음";

      case "REST":
        return "휴회중";

      case "EXPIRED":
        return "기간 만료";

      case "NO_COUNT":
        return "횟수 부족";

      default:
        return result;
    }
  };

  const getResultColor = (result: string) => {
    switch (result) {
      case "SUCCESS":
        return "#2ee59d";

      default:
        return "#ff4d6d";
    }
  };

  return (
    <AppShell title="실시간 출석 모니터">
      <div className="card" style={{ marginBottom: 16 }}>
        <h2>실시간 출석 현황</h2>

        <p style={{ color: "#aaa" }}>
          최근 출석 50건 자동 새로고침
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gap: 16,
        }}
      >
        {rows.map((r) => (
          <div
            key={r.attendance_id}
            className="card"
            style={{
              borderLeft: `6px solid ${getResultColor(r.result)}`,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 900,
                  }}
                >
                  {r.name || "알 수 없는 사용자"}
                </div>

                <div
                  style={{
                    color: "#aaa",
                    marginTop: 4,
                  }}
                >
                  {r.branch_name || "-"} / {r.product_name || "-"}
                </div>
              </div>

              <div style={{ textAlign: "right" }}>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 900,
                    color: getResultColor(r.result),
                  }}
                >
                  {getResultText(r.result)}
                </div>

                <div
                  style={{
                    color: "#aaa",
                    marginTop: 4,
                  }}
                >
                  {new Date(r.checkin_time).toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}