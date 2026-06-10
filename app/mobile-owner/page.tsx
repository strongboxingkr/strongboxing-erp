"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

import { apiFetch } from "@/lib/api";

const branches = ["전체", "철산점", "목동점", "개봉점", "신정점"];
const consultBranches = ["철산점", "목동점", "개봉점", "신정점"];

const today = new Date().toISOString().slice(0, 10);

const getYesterday = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
};

const money = (v: any) => `${Number(v || 0).toLocaleString()}원`;

const menus = [
  ["회원관리", "/mobile-members"],
  ["출석관리", "/mobile-attendance"],
  ["결제관리", "/mobile-payments"],
  ["CRM", "/mobile-crm"],
  ["네이버예약", "/naver-calendar"],
  ["문자관리", "/sms"],
  ["재무요약", "/finance-summary"],
  ["일일마감", "/daily-closing"],
  ["직원관리", "/staff"],
  ["권한관리", "/permissions"],
];

export default function MobileOwnerPage() {
  const [data, setData] = useState<any>(null);
  const [chartRows, setChartRows] = useState<any[]>([]);
  const [reservations, setReservations] = useState<any[]>([]);

  const [datePreset, setDatePreset] = useState("TODAY");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [branch, setBranch] = useState("전체");

  const [showConsult, setShowConsult] = useState(false);

  const [consultForm, setConsultForm] = useState({
    customer_name: "",
    phone: "",
    inquiry_channel: "전화문의",
    memo: "",
    reservation_date: today,
    reservation_time: "",
    branch_name: "철산점",
  });

  const load = async () => {
    let url = `/api/dashboard?start_date=${startDate}&end_date=${endDate}`;

    if (branch !== "전체") {
      url += `&branch_name=${encodeURIComponent(branch)}`;
    }

    const res = await fetch(url);
    const json = await res.json();
    setData(json);

    let chartUrl = "/api/dashboard/chart";

    if (branch !== "전체") {
      chartUrl += `?branch_name=${encodeURIComponent(branch)}`;
    }

    const chartRes = await fetch(chartUrl);
    const chartJson = await chartRes.json();
    setChartRows(chartJson.rows || []);

    const reservationRes = await apiFetch("/api/calendar-events");
    const reservationJson = await reservationRes.json();

    setReservations(
      (reservationJson.rows || []).filter(
        (r: any) =>
          r.start_datetime?.slice(0, 10) === today
      )
    );
  };

  const saveConsult = async () => {
    if (!consultForm.customer_name.trim()) {
      alert("이름을 입력해주세요.");
      return;
    }

    if (!consultForm.branch_name) {
      alert("지점을 선택해주세요.");
      return;
    }

    const res = await apiFetch("/api/crm/add", {
      method: "POST",
      body: JSON.stringify({
        branch_name: consultForm.branch_name,
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
          branch_name: consultForm.branch_name,
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
    branch_name: "철산점",
  });
} else {
  alert(json.message || "상담 등록 실패");
}
  };

  useEffect(() => {
      if (datePreset === "TODAY") {
        setStartDate(today);
        setEndDate(today);
      }

      if (datePreset === "YESTERDAY") {
        const y = getYesterday();
        setStartDate(y);
        setEndDate(y);
      }

      if (datePreset === "LAST7") {
        const d = new Date();
        d.setDate(d.getDate() - 6);

        setStartDate(d.toISOString().slice(0, 10));
        setEndDate(today);
      }

      if (datePreset === "LAST30") {
        const d = new Date();
        d.setDate(d.getDate() - 29);

        setStartDate(d.toISOString().slice(0, 10));
        setEndDate(today);
      }
    }, [datePreset]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, [startDate, endDate, branch]);

  if (!data) return <div className="mobile">로딩중...</div>;

  const branchSales = data.branch_sales || [];

  return (
    <div className="mobile" style={{ background: "#08090d", minHeight: "100vh", paddingBottom: 50 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div className="logo">
          STRONG<span> OWNER</span>
        </div>

        <div style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", padding: "8px 14px", borderRadius: 999, fontSize: 13, color: "#aaa" }}>
          대표 모바일
        </div>
      </div>

      <div className="card" style={{ padding: 24, borderRadius: 28, background: "linear-gradient(135deg, rgba(255,32,78,0.25), rgba(17,24,39,1))", marginBottom: 20 }}>
        <div style={{ color: "#ffd5df", fontSize: 14 }}>
          {startDate === endDate
          ? startDate
          : `${startDate} ~ ${endDate}`}{" "}
        {branch}
        </div>
        <div style={{ marginTop: 10, fontSize: 18, color: "#ddd" }}>오늘 총매출</div>
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

            <select className="input" value={consultForm.branch_name} onChange={(e) => setConsultForm({ ...consultForm, branch_name: e.target.value })}>
              {consultBranches.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>

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

      <div
        className="card"
        style={{
          marginBottom: 20,
          borderRadius: 22,
        }}
      >
        <div
          style={{
            fontSize: 18,
            fontWeight: 900,
            marginBottom: 12,
          }}
        >
          조회 조건
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          <select
            className="input"
            value={datePreset}
            onChange={(e) => setDatePreset(e.target.value)}
          >
            <option value="TODAY">오늘</option>
            <option value="YESTERDAY">어제</option>
            <option value="LAST7">최근 7일</option>
            <option value="LAST30">최근 30일</option>
            <option value="CUSTOM">직접선택</option>
          </select>

          {datePreset === "CUSTOM" && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
              }}
            >
              <input
                className="input"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />

              <input
                className="input"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          )}

          <select
            className="input"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
          >
            {branches.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
        </div>
      </div>

      {branch === "전체" && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 24, fontWeight: 900, marginBottom: 14 }}>지점별 매출</div>

          <div style={{ display: "grid", gap: 12 }}>
            {branchSales.map((b: any) => (
              <div key={b.branch_name} className="card" style={{ borderRadius: 22 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 900 }}>{b.branch_name}</div>
                    <div style={{ marginTop: 6, color: "#888" }}>신규회원 {b.new_members || 0}명</div>
                  </div>

                  <div style={{ fontSize: 28, fontWeight: 900, color: "#2ee59d" }}>
                    {money(b.sales || b.total)}
                  </div>
                </div>
              </div>
            ))}

            {branchSales.length === 0 && (
              <div className="card">
                <p style={{ color: "#aaa" }}>지점별 데이터가 없습니다.</p>
              </div>
            )}
          </div>
        </div>
      )}

      <div>
        <div style={{ fontSize: 24, fontWeight: 900, marginBottom: 14 }}>최근 7일 매출</div>

        <div className="card" style={{ height: 320, borderRadius: 24 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartRows}>
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="sales" stroke="#ff3b6b" strokeWidth={4} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div
        style={{
          background: "#111827",
          borderRadius: 24,
          padding: 18,
          marginTop: 20,
        }}
      >
        <div
          style={{
            fontSize: 24,
            fontWeight: 900,
            marginBottom: 14,
          }}
        >
          오늘 예약
        </div>

        {reservations.length === 0 ? (
          <div style={{ color: "#888" }}>
            오늘 예약이 없습니다.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {reservations.map((r) => (
              <div
                key={r.event_id}
                style={{
                  background: "#1f2937",
                  borderRadius: 18,
                  padding: 16,
                  borderLeft: "6px solid #2ee59d",
                }}
              >
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 900,
                  }}
                >
                  {r.start_datetime?.slice(11, 16)} / {r.customer_name}
                </div>

                <div style={{ color: "#aaa", marginTop: 8 }}>
                  {r.branch_name}
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
          href="/mobile-owner"
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