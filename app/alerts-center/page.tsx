"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { apiFetch } from "@/lib/api";

export default function AlertsCenterPage() {
  const [data, setData] = useState<any>(null);

  const load = async () => {
    const res = await apiFetch("/api/alerts-center");
    const json = await res.json();
    setData(json);
  };

  useEffect(() => {
    load();

    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, []);

  if (!data) {
    return <AppShell title="알림센터">로딩중...</AppShell>;
  }

  return (
    <AppShell title="알림센터">
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 34, fontWeight: 900 }}>알림센터</h1>
          <p style={{ color: "#aaa", marginTop: 8 }}>
            오늘 예약, 관리 필요 회원, 재연락 상담, 공지를 한 번에 확인합니다.
          </p>
        </div>

        <button className="btn secondary" onClick={load}>
          새로고침
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 16 }}>
        <div className="card">
          <h3>오늘 예약</h3>
          <div className="num">{data.reservations?.length || 0}건</div>
        </div>

        <div className="card">
          <h3>관리 필요 회원</h3>
          <div className="num">{data.members?.length || 0}명</div>
        </div>

        <div className="card">
          <h3>재연락 상담</h3>
          <div className="num">{data.crm?.length || 0}건</div>
        </div>

        <div className="card">
          <h3>공지</h3>
          <div className="num">{data.notices?.length || 0}건</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div className="card">
          <h2>오늘 네이버 예약</h2>
          {(data.reservations || []).map((r: any) => (
            <div key={r.reservation_id} style={{ padding: "12px 0", borderBottom: "1px solid #333" }}>
              <b>{r.reservation_time || "-"} / {r.customer_name}</b>
              <div style={{ color: "#aaa", marginTop: 4 }}>
                {r.branch_name} / {r.phone} / {r.status}
              </div>
            </div>
          ))}
          {data.reservations?.length === 0 && <p style={{ color: "#aaa" }}>오늘 예약 알림이 없습니다.</p>}
        </div>

        <div className="card">
          <h2>관리 필요 회원</h2>
          {(data.members || []).map((m: any) => (
            <div key={m.member_id} style={{ padding: "12px 0", borderBottom: "1px solid #333" }}>
              <b>{m.name}</b>
              <div style={{ color: "#aaa", marginTop: 4 }}>
                {m.branch_name} / {m.phone} / 만료일 {m.end_date?.slice(0, 10)}
              </div>
            </div>
          ))}
          {data.members?.length === 0 && <p style={{ color: "#aaa" }}>관리 필요 회원이 없습니다.</p>}
        </div>

        <div className="card">
          <h2>재연락 상담</h2>
          {(data.crm || []).map((c: any) => (
            <div key={c.lead_id} style={{ padding: "12px 0", borderBottom: "1px solid #333" }}>
              <b>{c.customer_name}</b>
              <div style={{ color: "#aaa", marginTop: 4 }}>
                {c.branch_name} / {c.phone} / {c.status}
              </div>
            </div>
          ))}
          {data.crm?.length === 0 && <p style={{ color: "#aaa" }}>재연락 상담이 없습니다.</p>}
        </div>

        <div className="card">
          <h2>공지사항</h2>
          {(data.notices || []).map((n: any) => (
            <div key={n.notice_id} style={{ padding: "12px 0", borderBottom: "1px solid #333" }}>
              <b>[{n.branch_name}] {n.title}</b>
              <div style={{ color: "#aaa", marginTop: 4 }}>
                {n.created_at?.slice(0, 16).replace("T", " ")}
              </div>
            </div>
          ))}
          {data.notices?.length === 0 && <p style={{ color: "#aaa" }}>공지사항이 없습니다.</p>}
        </div>
      </div>
    </AppShell>
  );
}