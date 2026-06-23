"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";

const audio =
  typeof window !== "undefined" ? new Audio("/alert.mp3") : null;

const today = () => new Date().toISOString().slice(0, 10);

export default function AlertsFloating() {
  const [data, setData] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [morningOpen, setMorningOpen] = useState(false);
  const lastEventIdRef = useRef<number>(0);
  const lastReservationIdRef = useRef<number>(0);
  const isFirstLoadRef = useRef(true);

  const load = async () => {
    const res = await apiFetch("/api/alerts-center");
    const json = await res.json();
    if (!json.success) return;

    setData(json);

    // 새 홈페이지/네이버 예약 감지
    const newestReservation = json.reservations?.[0];
    if (
      newestReservation &&
      !isFirstLoadRef.current &&
      Number(newestReservation.reservation_id) > lastReservationIdRef.current
    ) {
      triggerAlert(`새 예약 접수`, `${newestReservation.branch_name} / ${newestReservation.customer_name} / ${newestReservation.reservation_time}`);
      setOpen(true);
    }
    if (newestReservation?.reservation_id) {
      lastReservationIdRef.current = Number(newestReservation.reservation_id);
    }

    // 새 수동 등록 예약 감지
    const newestEvent = json.newCalendarEvents?.[0];
    if (
      newestEvent &&
      !isFirstLoadRef.current &&
      Number(newestEvent.event_id) > lastEventIdRef.current
    ) {
      triggerAlert(`새 예약 등록`, `${newestEvent.branch_name} / ${newestEvent.customer_name} / ${newestEvent.reservation_time}`);
      setOpen(true);
    }
    if (newestEvent?.event_id) {
      lastEventIdRef.current = Number(newestEvent.event_id);
    }

    // 당일 아침 알림 (하루에 한 번)
    if (isFirstLoadRef.current) {
      const lastShownDate = localStorage.getItem("morning_alert_date");
      const todayStr = today();
      const todayTotal =
        (json.reservations?.length || 0) + (json.calendarEvents?.length || 0);

      if (lastShownDate !== todayStr && todayTotal > 0) {
        setMorningOpen(true);
        localStorage.setItem("morning_alert_date", todayStr);
      }

      isFirstLoadRef.current = false;
    }
  };

  const triggerAlert = (title: string, body: string) => {
    audio?.play?.().catch(() => {});
    if (Notification.permission === "granted") {
      new Notification(title, { body });
    }
  };

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, []);

  const reservationCount = data?.reservations?.length || 0;
  const calendarCount = data?.calendarEvents?.length || 0;
  const memberCount = data?.members?.length || 0;
  const crmCount = data?.crm?.length || 0;
  const total = reservationCount + calendarCount + memberCount + crmCount;

  return (
    <>
      {/* 당일 아침 알림 */}
      {morningOpen && data && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            display: "grid",
            placeItems: "center",
            zIndex: 99999,
          }}
        >
          <div
            style={{
              background: "#111827",
              border: "1px solid #374151",
              borderRadius: 24,
              padding: 28,
              width: 420,
              maxHeight: "80vh",
              overflow: "auto",
            }}
          >
            <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 6 }}>
              🌅 오늘의 예약 현황
            </div>
            <div style={{ color: "#94a3b8", marginBottom: 20, fontSize: 14 }}>
              {today()} 기준 예약 {reservationCount + calendarCount}건
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              {[...(data.reservations || []), ...(data.calendarEvents || [])]
                .sort((a, b) => (a.reservation_time || "").localeCompare(b.reservation_time || ""))
                .map((r: any, i: number) => (
                  <div
                    key={i}
                    style={{
                      background: "#1f2937",
                      borderRadius: 12,
                      padding: 12,
                      borderLeft: `5px solid ${r.event_id ? "#3b82f6" : "#22c55e"}`,
                    }}
                  >
                    <div style={{ fontWeight: 900 }}>{r.customer_name}</div>
                    <div style={{ color: "#94a3b8", fontSize: 13, marginTop: 4 }}>
                      {r.branch_name} / {r.reservation_time} / {r.source_type || "-"}
                    </div>
                    <div style={{ color: "#fbbf24", fontSize: 13, marginTop: 2 }}>
                      {r.status}
                    </div>
                  </div>
                ))}
            </div>

            <button
              className="btn"
              style={{ width: "100%", marginTop: 20 }}
              onClick={() => setMorningOpen(false)}
            >
              확인
            </button>
          </div>
        </div>
      )}

      {/* 실시간 알림 플로팅 */}
      {data && open && total > 0 && (
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
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ fontSize: 20, fontWeight: 900 }}>🔔 현재 알림 {total}건</div>
            <button className="btn secondary" onClick={() => setOpen(false)}>닫기</button>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            {data.reservations?.slice(0, 3).map((r: any) => (
              <div
                key={r.reservation_id}
                style={{ background: "#1f2937", borderRadius: 12, padding: 12, borderLeft: "5px solid #22c55e" }}
              >
                <div style={{ fontWeight: 900 }}>🌐 {r.customer_name}</div>
                <div style={{ color: "#9ca3af", marginTop: 4 }}>{r.branch_name}</div>
                <div style={{ color: "#22c55e", fontWeight: 800, marginTop: 4 }}>
                  {r.reservation_date?.slice(0, 10)} {r.reservation_time}
                </div>
                <div style={{ color: "#fbbf24", marginTop: 4 }}>{r.status}</div>
              </div>
            ))}

            {data.calendarEvents?.slice(0, 3).map((r: any) => (
              <div
                key={r.event_id}
                style={{ background: "#1f2937", borderRadius: 12, padding: 12, borderLeft: "5px solid #3b82f6" }}
              >
                <div style={{ fontWeight: 900 }}>📞 {r.customer_name}</div>
                <div style={{ color: "#9ca3af", marginTop: 4 }}>{r.branch_name}</div>
                <div style={{ color: "#3b82f6", fontWeight: 800, marginTop: 4 }}>
                  {r.reservation_date?.slice(0, 10)} {r.reservation_time}
                </div>
                <div style={{ color: "#fbbf24", marginTop: 4 }}>{r.status}</div>
              </div>
            ))}

            {memberCount > 0 && (
              <div style={{ background: "#1f2937", borderRadius: 12, padding: 12, borderLeft: "5px solid #ff4d6d" }}>
                ⚠️ 만료 임박 회원 {memberCount}명
              </div>
            )}

            {crmCount > 0 && (
              <div style={{ background: "#1f2937", borderRadius: 12, padding: 12, borderLeft: "5px solid #f72585" }}>
                📋 재연락 상담 {crmCount}건
              </div>
            )}
          </div>

          <button
            className="btn"
            style={{ width: "100%", marginTop: 12 }}
            onClick={() => { location.href = "/alerts-center"; }}
          >
            알림센터 바로가기
          </button>
        </div>
      )}
    </>
  );
}
