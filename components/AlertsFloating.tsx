"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

const audio =
  typeof window !== "undefined"
    ? new Audio("/alert.mp3")
    : null;

export default function AlertsFloating() {
  const [data, setData] = useState<any>(null);
  const [open, setOpen] = useState(true);
  const [lastReservationId, setLastReservationId] = useState<number>(0);

  const load = async () => {
    const res = await apiFetch("/api/alerts-center");
    const json = await res.json();

    if (!json.success) return;

    setData(json);

    const newestReservation = json.reservations?.[0];

    if (
      newestReservation &&
      lastReservationId !== 0 &&
      Number(newestReservation.reservation_id) > Number(lastReservationId)
    ) {
      audio?.play?.().catch(() => {});

      if (Notification.permission === "granted") {
        new Notification("새 예약 접수", {
          body: `${newestReservation.branch_name || "-"} / ${
            newestReservation.customer_name || "-"
          } / ${newestReservation.reservation_time || "-"}`,
        });
      }

      setOpen(true);
    }

    if (newestReservation?.reservation_id) {
      setLastReservationId(Number(newestReservation.reservation_id));
    }
  };

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    load();

    const timer = setInterval(load, 30000);

    return () => clearInterval(timer);
  }, [lastReservationId]);

  if (!data || !open) return null;

  const reservationCount = data.reservations?.length || 0;
  const memberCount = data.members?.length || 0;
  const crmCount = data.crm?.length || 0;

  const total = reservationCount + memberCount + crmCount;

  if (total === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        right: 20,
        bottom: 20,
        width: 360,
        zIndex: 9999,
        background: "#111827",
        border: "1px solid #374151",
        borderRadius: 20,
        padding: 16,
        boxShadow: "0 0 30px rgba(0,0,0,0.45)",
        color: "white",
      }}
    >
      <div
        className="row"
        style={{
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 900 }}>
          실시간 알림 {total}건
        </div>

        <button className="btn secondary" onClick={() => setOpen(false)}>
          닫기
        </button>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {reservationCount > 0 && (
          <div
            style={{
              background: "#1f2937",
              borderRadius: 12,
              padding: 12,
              borderLeft: "5px solid #2ee59d",
            }}
          >
            오늘 예약 {reservationCount}건
          </div>
        )}

        {memberCount > 0 && (
          <div
            style={{
              background: "#1f2937",
              borderRadius: 12,
              padding: 12,
              borderLeft: "5px solid #ff4d6d",
            }}
          >
            관리 필요 회원 {memberCount}명
          </div>
        )}

        {crmCount > 0 && (
          <div
            style={{
              background: "#1f2937",
              borderRadius: 12,
              padding: 12,
              borderLeft: "5px solid #f72585",
            }}
          >
            재연락 상담 {crmCount}건
          </div>
        )}
      </div>

      <button
        className="btn"
        style={{
          width: "100%",
          marginTop: 12,
        }}
        onClick={() => {
          location.href = "/alerts-center";
        }}
      >
        알림센터 보기
      </button>
    </div>
  );
}