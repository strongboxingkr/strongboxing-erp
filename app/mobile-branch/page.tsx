"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

const today = new Date().toISOString().slice(0, 10);

const menus = [
  ["?뚯썝愿由?, "/mobile-members"],
  ["異쒖꽍愿由?, "/mobile-attendance"],
  ["寃곗젣愿由?, "/mobile-payments"],
  ["CRM", "/mobile-crm"],
  ["?ㅼ씠踰꾩삁??, "/naver-calendar"],
  ["臾몄옄愿由?, "/sms"],
  ["?뚯썝留뚮즺", "/member-expiring"],
  ["?쇱씪留덇컧", "/daily-closing"],
];

const money = (v: any) => `${Number(v || 0).toLocaleString()}??;

export default function MobileBranchPage() {
  const [data, setData] = useState<any>(null);
  const [reservations, setReservations] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [showConsult, setShowConsult] = useState(false);

  const [consultForm, setConsultForm] = useState({
    customer_name: "",
    phone: "",
    inquiry_channel: "?꾪솕臾몄쓽",
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
      `/api/calendar-events?branch_name=${encodeURIComponent(branch)}`
    );
    const reservationJson = await reservationRes.json();

    setReservations(
      (reservationJson.rows || []).filter(
        (r: any) => r.start_datetime?.slice(0, 10) === today
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
      alert("?대쫫???낅젰?댁＜?몄슂.");
      return;
    }

    const res = await apiFetch("/api/crm/add", {
      method: "POST",
      body: JSON.stringify({
        branch_name: targetBranch,
        customer_name: consultForm.customer_name,
        phone: consultForm.phone,
        inquiry_type: "?좉퇋?곷떞",
        inquiry_channel: consultForm.inquiry_channel,
        status: "諛⑸Ц?덉빟",
        next_contact_date: consultForm.reservation_date,
        memo: [
          `?덉빟?쇱떆: ${consultForm.reservation_date} ${consultForm.reservation_time || "-"}`,
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
          title: `?꾪솕?덉빟 - ${consultForm.customer_name}`,
          customer_name: consultForm.customer_name,
          phone: consultForm.phone,
          start_datetime: `${consultForm.reservation_date}T${consultForm.reservation_time || "00:00"}`,
          memo: consultForm.memo,
          status: "?덉빟?뺤젙",
          source_type: "PHONE_RESERVATION",
          source_id: "",
        }),
      });

      alert("?곷떞 ?깅줉 ?꾨즺!");
      setShowConsult(false);
      setConsultForm({
        customer_name: "",
        phone: "",
        inquiry_channel: "?꾪솕臾몄쓽",
        memo: "",
        reservation_date: today,
        reservation_time: "",
        branch_name: "",
      });
    } else {
      alert(json.message || "?곷떞 ?깅줉 ?ㅽ뙣");
    }
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, []);

  if (!data) return <div style={{ padding: 20 }}>濡쒕뵫以?..</div>;

  const user = getUser();

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", padding: 18, paddingBottom: 80 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 900, color: "#1e293b" }}>
            STRONG <span style={{ color: "var(--accent)" }}>BRANCH</span>
          </div>
          <div style={{ marginTop: 4, color: "var(--muted)", fontSize: 13 }}>{user?.branch_name}</div>
        </div>
        <div style={{ background: "white", border: "1px solid var(--line)", padding: "6px 14px", borderRadius: 999, color: "var(--muted)", fontSize: 13 }}>
          愿??紐⑤컮??
        </div>
      </div>

      <div className="card" style={{ background: "linear-gradient(135deg, #eff6ff, #dbeafe)", border: "1px solid #bfdbfe", borderRadius: 28, padding: 24, marginBottom: 20 }}>
        <div style={{ color: "#2563eb", fontSize: 14, fontWeight: 600 }}>?ㅻ뒛 珥앸ℓ異?/div>
        <div style={{ marginTop: 10, fontSize: 42, fontWeight: 900, color: "#1e3a8a" }}>{money(data.sales)}</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 20 }}>
          <div style={{ background: "white", borderRadius: 18, padding: 16, border: "1px solid #bfdbfe" }}>
            <div style={{ color: "#64748b", fontSize: 13 }}>?좉퇋?뚯썝</div>
            <div style={{ marginTop: 8, fontSize: 28, fontWeight: 900, color: "#111827" }}>{data.new_members || 0}紐?/div>
          </div>
          <div style={{ background: "white", borderRadius: 18, padding: 16, border: "1px solid #bfdbfe" }}>
            <div style={{ color: "#64748b", fontSize: 13 }}>?ㅻ뒛 異쒖꽍</div>
            <div style={{ marginTop: 8, fontSize: 28, fontWeight: 900, color: "#111827" }}>{data.checkins || 0}紐?/div>
          </div>
        </div>
      </div>

      <div className="card" style={{ borderRadius: 24, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 24, fontWeight: 900 }}>鍮좊Ⅸ ?곷떞?깅줉</div>
          <button className="btn" onClick={() => setShowConsult(!showConsult)}>
            {showConsult ? "?リ린" : "?곷떞?깅줉"}
          </button>
        </div>

        {showConsult && (
          <div style={{ display: "grid", gap: 10 }}>
            <input className="input" placeholder="?대쫫" value={consultForm.customer_name} onChange={(e) => setConsultForm({ ...consultForm, customer_name: e.target.value })} />
            <input className="input" placeholder="?꾪솕踰덊샇" value={consultForm.phone} onChange={(e) => setConsultForm({ ...consultForm, phone: e.target.value })} />

            <select className="input" value={consultForm.inquiry_channel} onChange={(e) => setConsultForm({ ...consultForm, inquiry_channel: e.target.value })}>
              <option>?꾪솕臾몄쓽</option>
              <option>?몄뒪?</option>
              <option>釉붾줈洹?/option>
              <option>吏??/option>
              <option>?꾩옣臾몄쓽</option>
            </select>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <input className="input" type="date" value={consultForm.reservation_date} onChange={(e) => setConsultForm({ ...consultForm, reservation_date: e.target.value })} />
              <input className="input" type="time" value={consultForm.reservation_time} onChange={(e) => setConsultForm({ ...consultForm, reservation_time: e.target.value })} />
            </div>

            <textarea className="input" placeholder="?곷떞 硫붾え" value={consultForm.memo} onChange={(e) => setConsultForm({ ...consultForm, memo: e.target.value })} style={{ minHeight: 90 }} />

            <button className="btn" onClick={saveConsult}>?곷떞 ???/button>
          </div>
        )}
      </div>

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 24, fontWeight: 900, marginBottom: 14 }}>鍮좊Ⅸ 硫붾돱</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {menus.map(([title, href]) => (
            <Link key={title} href={href} style={{ background: "white", border: "1px solid var(--line)", borderRadius: 20, padding: 20, textDecoration: "none" }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: "var(--text)" }}>{title}</div>
              <div style={{ marginTop: 8, color: "var(--muted)", fontSize: 13 }}>諛붾줈 ?대룞</div>
            </Link>
          ))}
        </div>
      </div>

      <div className="card" style={{ borderRadius: 24, padding: 18, marginBottom: 18 }}>
        <div style={{ fontSize: 24, fontWeight: 900, marginBottom: 14 }}>?ㅻ뒛 ?덉빟</div>
        {reservations.length === 0 ? (
          <div style={{ color: "var(--muted)" }}>?ㅻ뒛 ?덉빟???놁뒿?덈떎.</div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {reservations.map((r) => (
              <div key={r.event_id} style={{ background: "var(--panel2)", borderRadius: 18, padding: 16, borderLeft: "6px solid #2563eb", border: "1px solid var(--line)", borderLeftWidth: 6, borderLeftColor: "#2563eb" }}>
                <div style={{ fontSize: 22, fontWeight: 900 }}>{r.start_datetime?.slice(11, 16) || "-"} / {r.customer_name || r.title}</div>
                <div style={{ color: "var(--muted)", marginTop: 8 }}>{r.phone}</div>
                <div style={{ color: "var(--accent)", marginTop: 8, fontWeight: 900 }}>{r.status}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card" style={{ borderRadius: 24, padding: 18 }}>
        <div style={{ fontSize: 24, fontWeight: 900, marginBottom: 14 }}>愿由??꾩슂 ?뚯썝</div>
        {alerts.length === 0 ? (
          <div style={{ color: "var(--muted)" }}>愿由??꾩슂 ?뚯썝???놁뒿?덈떎.</div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {alerts.slice(0, 5).map((m) => (
              <div key={m.member_id} style={{ background: "var(--panel2)", borderRadius: 18, padding: 16, borderLeft: "6px solid #ef4444", border: "1px solid var(--line)", borderLeftWidth: 6, borderLeftColor: "#ef4444" }}>
                <div style={{ fontSize: 20, fontWeight: 900 }}>{m.name}</div>
                <div style={{ color: "var(--muted)", marginTop: 6 }}>{m.phone}</div>
                <div style={{ color: "#ef4444", marginTop: 6, fontWeight: 700 }}>{m.alert_type || "愿由??꾩슂"}</div>
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
          href="/director-dashboard"
          style={{
            color: "#666",
            fontSize: 13,
            textDecoration: "underline",
          }}
        >
          PC踰꾩쟾 蹂닿린
        </Link>
      </div>

      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "white",
          borderTop: "1px solid var(--line)",
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          padding: "10px 0",
          zIndex: 999,
        }}
      >
        <Link
          href="/mobile-branch" style={{ textAlign: "center", color: "var(--accent)", textDecoration: "none", fontSize: 12, fontWeight: 900 }}>??/Link>
        <Link href="/mobile-members" style={{ textAlign: "center", color: "var(--muted)", textDecoration: "none", fontSize: 12 }}>?뚯썝</Link>
        <Link href="/mobile-attendance" style={{ textAlign: "center", color: "var(--muted)", textDecoration: "none", fontSize: 12 }}>異쒖꽍</Link>
        <Link href="/mobile-payments" style={{ textAlign: "center", color: "var(--muted)", textDecoration: "none", fontSize: 12 }}>寃곗젣</Link>
        <Link href="/mobile-crm" style={{ textAlign: "center", color: "var(--muted)", textDecoration: "none", fontSize: 12 }}>?곷떞</Link>
      </div>
    </div>
  );
}
