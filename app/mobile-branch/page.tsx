"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

const today = new Date().toISOString().slice(0, 10);

const menus = [
  ["회원관리", "/mobile-members"],
  ["출석관리", "/mobile-attendance"],
  ["결제관리", "/mobile-payments"],
  ["CRM", "/mobile-crm"],
  ["네이버예약", "/naver-calendar"],
  ["문자관리", "/sms"],
  ["회원만료", "/member-expiring"],
  ["일일마감", "/daily-closing"],
];

const money = (v: any) => `${Number(v || 0).toLocaleString()}원`;

export default function MobileBranchPage() {
  const [data, setData] = useState<any>(null);
  const [reservations, setReservations] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [showConsult, setShowConsult] = useState(false);

  const [consultForm, setConsultForm] = useState({
    customer_name: "",
    phone: "",
    inquiry_channel: "전화문의",
    memo: "",
    reservation_date: today,
    reservation_time: "",
    branch_name: "",
  });

  const getUser = () => {
    const savedUser = localStorage.getItem("user");
    return savedUser ? JSON.parse(savedUser) : null;
  };

  const load = async () => {
    const user = getUser();
    const branch = user?.branch_name || "";

    const dashboardRes = await apiFetch(
      `/api/dashboard?start_date=${today}&end_date=${today}&branch_name=${encodeURIComponent(branch)}`
    );
    const dashboardJson = await dashboardRes.json();
    setData(dashboardJson);

    const reservationRes = await apiFetch(
      `/api/naver-reservations?branch_name=${encodeURIComponent(branch)}`
    );
    const reservationJson = await reservationRes.json();

    setReservations(
      (reservationJson.rows || []).filter(
        (r: any) => r.reservation_date?.slice(0, 10) === today
      )
    );

    const alertRes = await apiFetch(
      `/api/member-alerts?branch_name=${encodeURIComponent(branch)}`
    );
    const alertJson = await alertRes.json();
    setAlerts(alertJson.rows || []);
  };

  const saveConsult = async () => {
    const user = getUser();
    const targetBranch = user?.branch_name;

    if (!consultForm.customer_name.trim()) {
      alert("이름을 입력해주세요.");
      return;
    }

    const res = await apiFetch("/api/crm/add", {
      method: "POST",
      body: JSON.stringify({
        branch_name: targetBranch,
        customer_name: consultForm.customer_name,
        phone: consultForm.phone,
        inquiry_type: "신규상담",
        inquiry_channel: consultForm.inquiry_channel,
        status: "방문예약",
        next_contact_date: consultForm.reservation_date,
        memo: [
          `예약일시: ${consultForm.reservation_date} ${consultForm.reservation_time || "-"}`,
          "",
          consultForm.memo,
        ].join("\n"),
        auto_create_member: false,
        go_payment_after_save: false,
      }),
    });

    const json = await res.json();

    if (json.success) {
      await apiFetch("/api/calendar-events/add", {
        method: "POST",
        body: JSON.stringify({
          branch_name: targetBranch,
          event_type: "PHONE",
          title: `전화예약 - ${consultForm.customer_name}`,
          customer_name: consultForm.customer_name,
          phone: consultForm.phone,
          start_datetime: `${consultForm.reservation_date}T${consultForm.reservation_time || "00:00"}`,
          memo: consultForm.memo,
          status: "예약확정",
          source_type: "PHONE_RESERVATION",
          source_id: "",
        }),
      });

      alert("상담 등록 완료!");
      setShowConsult(false);
      setConsultForm({
        customer_name: "",
        phone: "",
        inquiry_channel: "전화문의",
        memo: "",
        reservation_date: today,
        reservation_time: "",
        branch_name: "",
      });
    } else {
      alert(json.message || "상담 등록 실패");
    }
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, []);

  if (!data) return <div style={{ padding: 20, color: "white" }}>로딩중...</div>;

  const user = getUser();

  return (
    <div style={{ minHeight: "100vh", background: "#08090d", color: "white", padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 900 }}>
            STRONG <span style={{ color: "#2ee59d" }}>BRANCH</span>
          </div>
          <div style={{ marginTop: 4, color: "#888" }}>{user?.branch_name}</div>
        </div>

        <div style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", padding: "8px 14px", borderRadius: 999, color: "#aaa", fontSize: 13 }}>
          관장 모바일
        </div>
      </div>

      <div style={{ background: "linear-gradient(135deg, rgba(46,229,157,0.22), rgba(17,24,39,1))", borderRadius: 28, padding: 24, marginBottom: 20 }}>
        <div style={{ color: "#d1fae5" }}>오늘 총매출</div>
        <div style={{ marginTop: 10, fontSize: 42, fontWeight: 900 }}>{money(data.sales)}</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 20 }}>
          <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 18, padding: 16 }}>
            <div style={{ color: "#aaa", fontSize: 13 }}>신규회원</div>
            <div style={{ marginTop: 8, fontSize: 28, fontWeight: 900 }}>{data.new_members || 0}명</div>
          </div>

          <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 18, padding: 16 }}>
            <div style={{ color: "#aaa", fontSize: 13 }}>오늘 출석</div>
            <div style={{ marginTop: 8, fontSize: 28, fontWeight: 900 }}>{data.checkins || 0}명</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ borderRadius: 24, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 24, fontWeight: 900 }}>빠른 상담등록</div>
          <button className="btn" onClick={() => setShowConsult(!showConsult)}>
            {showConsult ? "닫기" : "상담등록"}
          </button>
        </div>

        {showConsult && (
          <div style={{ display: "grid", gap: 10 }}>
            <input className="input" placeholder="이름" value={consultForm.customer_name} onChange={(e) => setConsultForm({ ...consultForm, customer_name: e.target.value })} />
            <input className="input" placeholder="전화번호" value={consultForm.phone} onChange={(e) => setConsultForm({ ...consultForm, phone: e.target.value })} />

            <select className="input" value={consultForm.inquiry_channel} onChange={(e) => setConsultForm({ ...consultForm, inquiry_channel: e.target.value })}>
              <option>전화문의</option>
              <option>인스타</option>
              <option>블로그</option>
              <option>지인</option>
              <option>현장문의</option>
            </select>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <input className="input" type="date" value={consultForm.reservation_date} onChange={(e) => setConsultForm({ ...consultForm, reservation_date: e.target.value })} />
              <input className="input" type="time" value={consultForm.reservation_time} onChange={(e) => setConsultForm({ ...consultForm, reservation_time: e.target.value })} />
            </div>

            <textarea className="input" placeholder="상담 메모" value={consultForm.memo} onChange={(e) => setConsultForm({ ...consultForm, memo: e.target.value })} style={{ minHeight: 90 }} />

            <button className="btn" onClick={saveConsult}>상담 저장</button>
          </div>
        )}
      </div>

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 24, fontWeight: 900, marginBottom: 14 }}>빠른 메뉴</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {menus.map(([title, href]) => (
            <Link key={title} href={href} style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 20, padding: 20, textDecoration: "none" }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: "white" }}>{title}</div>
              <div style={{ marginTop: 8, color: "#888", fontSize: 13 }}>바로 이동</div>
            </Link>
          ))}
        </div>
      </div>

      <div style={{ background: "#111827", borderRadius: 24, padding: 18, marginBottom: 18 }}>
        <div style={{ fontSize: 24, fontWeight: 900, marginBottom: 14 }}>오늘 예약</div>

        {reservations.length === 0 ? (
          <div style={{ color: "#888" }}>오늘 예약이 없습니다.</div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {reservations.map((r) => (
              <div key={r.reservation_id} style={{ background: "#1f2937", borderRadius: 18, padding: 16, borderLeft: "6px solid #2ee59d" }}>
                <div style={{ fontSize: 24, fontWeight: 900 }}>
                  {r.reservation_time || "-"} / {r.customer_name}
                </div>
                <div style={{ color: "#aaa", marginTop: 8 }}>{r.phone}</div>
                <div style={{ color: "#2ee59d", marginTop: 8, fontWeight: 900 }}>{r.status}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ background: "#111827", borderRadius: 24, padding: 18 }}>
        <div style={{ fontSize: 24, fontWeight: 900, marginBottom: 14 }}>관리 필요 회원</div>

        {alerts.length === 0 ? (
          <div style={{ color: "#888" }}>관리 필요 회원이 없습니다.</div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {alerts.slice(0, 5).map((m) => (
              <div key={m.member_id} style={{ background: "#1f2937", borderRadius: 18, padding: 16, borderLeft: "6px solid #ff4d6d" }}>
                <div style={{ fontSize: 22, fontWeight: 900 }}>{m.name}</div>
                <div style={{ color: "#aaa", marginTop: 8 }}>{m.phone}</div>
                <div style={{ color: "#ff4d6d", marginTop: 8, fontWeight: 900 }}>
                  {m.alert_type || "관리 필요"}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div
        style={{
          textAlign: "center",
          paddingTop: 30,
          paddingBottom: 90,
        }}
      >
        <Link
          href="/dashboard"
          style={{
            color: "#666",
            fontSize: 13,
            textDecoration: "underline",
          }}
        >
          PC버전 보기
        </Link>
      </div>

      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "#0f172a",
          borderTop: "1px solid #1f2937",
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          padding: "10px 0",
          zIndex: 999,
        }}
      >
        <Link
          href="/mobile-branch"
          style={{
            textAlign: "center",
            color: "#2ee59d",
            textDecoration: "none",
            fontSize: 12,
            fontWeight: 900,
          }}
        >
          홈
        </Link>

        <Link
          href="/mobile-members"
          style={{
            textAlign: "center",
            color: "white",
            textDecoration: "none",
            fontSize: 12,
          }}
        >
          회원
        </Link>

        <Link
          href="/mobile-attendance"
          style={{
            textAlign: "center",
            color: "white",
            textDecoration: "none",
            fontSize: 12,
          }}
        >
          출석
        </Link>

        <Link
          href="/mobile-payments"
          style={{
            textAlign: "center",
            color: "white",
            textDecoration: "none",
            fontSize: 12,
          }}
        >
          결제
        </Link>

        <Link
          href="/mobile-crm"
          style={{
            textAlign: "center",
            color: "white",
            textDecoration: "none",
            fontSize: 12,
          }}
        >
          상담
        </Link>
      </div>
    </div>
  );
}