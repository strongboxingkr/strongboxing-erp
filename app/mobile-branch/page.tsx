"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

const today = new Date().toISOString().slice(0, 10);
const money = (v: any) => `${Number(v || 0).toLocaleString()}원`;

const otherMenus = [
  ["네이버예약", "/naver-calendar"],
  ["문자관리", "/sms"],
  ["회원만료", "/member-expiring"],
  ["일일마감", "/daily-closing"],
  ["재무요약", "/finance-summary"],
];

function getAlertInfo(m: any) {
  const endDate = m.end_date?.slice(0, 10);
  const todayMs = new Date(today).getTime();

  if (m.pass_type === "COUNT") {
    const cnt = Number(m.remaining_count ?? 0);
    if (cnt <= 0) return { type: "잔여소진", color: "#dc2626", priority: 0 };
    return { type: `잔여부족 (${cnt}회)`, color: "#d97706", priority: 2 };
  }

  if (endDate) {
    const diff = Math.ceil((new Date(endDate).getTime() - todayMs) / 86400000);
    if (diff < 0) return { type: "이미만료", color: "#dc2626", priority: 0 };
    if (diff === 0) return { type: "오늘만료", color: "#dc2626", priority: 1 };
    return { type: `만료임박 D-${diff}`, color: "#d97706", priority: 2 };
  }
  return { type: "관리필요", color: "#94a3b8", priority: 3 };
}

export default function MobileBranchPage() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loadError, setLoadError] = useState(false);
  const [reservations, setReservations] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [branchName, setBranchName] = useState("");
  const [showConsult, setShowConsult] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [consultForm, setConsultForm] = useState({
    customer_name: "",
    phone: "",
    inquiry_channel: "전화문의",
    memo: "",
    reservation_date: today,
    reservation_time: "",
  });

  const getUser = () => {
    try { return JSON.parse(localStorage.getItem("user") || "null"); } catch { return null; }
  };

  const load = async () => {
    const user = getUser();
    const branch = user?.branch_name || "";
    setBranchName(branch);

    try {
      const res = await apiFetch(`/api/dashboard?start_date=${today}&end_date=${today}&branch_name=${encodeURIComponent(branch)}`);
      const json = await res.json();
      setData(json);
      setLoadError(false);
    } catch {
      setLoadError(true);
    }

    try {
      const res = await apiFetch(`/api/calendar-events?branch_name=${encodeURIComponent(branch)}`);
      const json = await res.json();
      setReservations((json.rows || []).filter((r: any) => r.start_datetime?.slice(0, 10) === today));
    } catch {}

    try {
      const res = await apiFetch(`/api/member-alerts?branch_name=${encodeURIComponent(branch)}`);
      const json = await res.json();
      const sorted = (json.rows || []).sort((a: any, b: any) => getAlertInfo(a).priority - getAlertInfo(b).priority);
      setAlerts(sorted);
    } catch {}
  };

  const saveConsult = async () => {
    const user = getUser();
    if (!consultForm.customer_name.trim()) { alert("이름을 입력해주세요."); return; }
    try {
      const res = await apiFetch("/api/crm/add", {
        method: "POST",
        body: JSON.stringify({
          branch_name: user?.branch_name,
          customer_name: consultForm.customer_name,
          phone: consultForm.phone,
          inquiry_type: "신규상담",
          inquiry_channel: consultForm.inquiry_channel,
          status: "방문예약",
          next_contact_date: consultForm.reservation_date,
          memo: `예약일시: ${consultForm.reservation_date} ${consultForm.reservation_time || "-"}\n\n${consultForm.memo}`,
          auto_create_member: false,
          go_payment_after_save: false,
        }),
      });
      const json = await res.json();
      if (json.success) {
        await apiFetch("/api/calendar-events/add", {
          method: "POST",
          body: JSON.stringify({
            branch_name: user?.branch_name,
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
        setConsultForm({ customer_name: "", phone: "", inquiry_channel: "전화문의", memo: "", reservation_date: today, reservation_time: "" });
        load();
      } else {
        alert(json.message || "상담 등록 실패");
      }
    } catch { alert("저장 중 오류가 발생했습니다."); }
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, []);

  const todayRes = reservations.slice(0, 3);
  const topAlerts = alerts.slice(0, 5);

  return (
    <div style={s.page}>
      {/* 헤더 */}
      <div style={s.header}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#1e293b" }}>관장 모바일</div>
          <div style={{ fontSize: 12, color: "#475569", marginTop: 1 }}>{branchName}</div>
        </div>
        <span style={s.badge}>관장용</span>
      </div>

      {/* 회원 검색 */}
      <div style={{ padding: "8px 12px", background: "#fff", borderBottom: "1px solid #e2e8f0" }}>
        <div style={{ display: "flex", gap: 6 }}>
          <input
            placeholder="이름·전화번호로 회원 검색"
            value={memberSearch}
            onChange={(e) => setMemberSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && memberSearch.trim()) {
                router.push(`/mobile-members?q=${encodeURIComponent(memberSearch.trim())}`);
              }
            }}
            style={{
              flex: 1, padding: "7px 10px", borderRadius: 8,
              border: "1px solid #e2e8f0", fontSize: 13, color: "#1e293b",
              background: "#f8fafc", outline: "none",
            }}
          />
          <button
            onClick={() => { if (memberSearch.trim()) router.push(`/mobile-members?q=${encodeURIComponent(memberSearch.trim())}`); }}
            style={{
              padding: "7px 14px", borderRadius: 8, border: "none",
              background: "#2563eb", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
            }}
          >
            검색
          </button>
        </div>
      </div>

      {/* 빠른 실행 버튼 */}
      <div style={{ padding: "10px 12px 0" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          <button
            onClick={() => setShowConsult(!showConsult)}
            style={{ ...s.primaryBtn, background: showConsult ? "#1d4ed8" : "#2563eb" }}
          >
            상담등록
          </button>
          <Link href="/mobile-members" style={s.secondaryBtn}>
            회원등록
          </Link>
          <Link href="/mobile-attendance" style={s.secondaryBtn}>
            출석관리
          </Link>
        </div>
      </div>

      {/* 상담등록 폼 */}
      {showConsult && (
        <div style={{ padding: "10px 12px 0" }}>
          <div style={s.card}>
            <div style={{ padding: "12px 14px" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", marginBottom: 10 }}>신규 상담 등록</div>
              <div style={{ display: "grid", gap: 8 }}>
                <input className="input" placeholder="이름" value={consultForm.customer_name}
                  onChange={(e) => setConsultForm({ ...consultForm, customer_name: e.target.value })} />
                <input className="input" placeholder="전화번호" type="tel" value={consultForm.phone}
                  onChange={(e) => setConsultForm({ ...consultForm, phone: e.target.value })} />
                <select className="input" value={consultForm.inquiry_channel}
                  onChange={(e) => setConsultForm({ ...consultForm, inquiry_channel: e.target.value })}>
                  <option>전화문의</option><option>인스타</option><option>블로그</option>
                  <option>지인</option><option>현장문의</option>
                </select>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <input className="input" type="date" value={consultForm.reservation_date}
                    onChange={(e) => setConsultForm({ ...consultForm, reservation_date: e.target.value })} />
                  <input className="input" type="time" value={consultForm.reservation_time}
                    onChange={(e) => setConsultForm({ ...consultForm, reservation_time: e.target.value })} />
                </div>
                <textarea className="input" placeholder="메모" value={consultForm.memo}
                  onChange={(e) => setConsultForm({ ...consultForm, memo: e.target.value })}
                  style={{ minHeight: 70 }} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <button className="btn" onClick={saveConsult}>저장</button>
                  <button className="btn secondary" onClick={() => setShowConsult(false)}>취소</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 오늘 현황 */}
      <div style={{ padding: "10px 12px 0" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6 }}>오늘 현황</div>
        <div style={{ ...s.card, padding: 0 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr" }}>
            {[
              { label: "매출", value: data ? money(data.sales) : loadError ? "조회실패" : "—" },
              { label: "신규회원", value: data ? `${data.new_members ?? 0}명` : loadError ? "조회실패" : "—" },
              { label: "출석", value: data ? `${data.checkins ?? 0}명` : loadError ? "조회실패" : "—" },
            ].map((item, i) => (
              <div key={item.label} style={{
                padding: "12px 8px", textAlign: "center",
                borderRight: i < 2 ? "1px solid #e2e8f0" : undefined,
              }}>
                <div style={{ fontSize: 11, color: "#475569", marginBottom: 3 }}>{item.label}</div>
                <div style={{ fontSize: 16, fontWeight: 900, color: "#1e293b", whiteSpace: "nowrap" as const }}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 오늘 예약 */}
      <div style={{ padding: "12px 12px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>
            오늘 예약{reservations.length > 0 ? ` (${reservations.length}건)` : ""}
          </div>
          <Link href="/naver-calendar" style={s.textLink}>전체보기</Link>
        </div>
        <div style={s.card}>
          {todayRes.length === 0 ? (
            <div style={s.emptyRow}>오늘 예약이 없습니다.</div>
          ) : (
            todayRes.map((r, i) => (
              <div key={r.event_id}>
                {i > 0 && <div style={s.divider} />}
                <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 3, alignSelf: "stretch", minHeight: 32, background: "#2563eb", borderRadius: 2 }} />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}>
                      {r.start_datetime?.slice(11, 16)} · {r.customer_name || r.title}
                    </div>
                    <div style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>
                      {r.phone}{r.status ? ` · ${r.status}` : ""}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 관리 필요 회원 */}
      <div style={{ padding: "12px 12px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>
            관리 필요 회원{alerts.length > 0 ? ` (${alerts.length}명)` : ""}
          </div>
          {alerts.length > 5 && (
            <Link href="/member-alerts" style={s.textLink}>전체보기</Link>
          )}
        </div>
        <div style={s.card}>
          {topAlerts.length === 0 ? (
            <div style={s.emptyRow}>관리 필요 회원이 없습니다.</div>
          ) : (
            topAlerts.map((m, i) => {
              const info = getAlertInfo(m);
              return (
                <div key={m.member_id}>
                  {i > 0 && <div style={s.divider} />}
                  <Link href={`/members/${m.member_id}`} style={{ textDecoration: "none", display: "block" }}>
                    <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 3, alignSelf: "stretch", minHeight: 32, background: info.color, borderRadius: 2 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}>{m.name}</div>
                        <a
                          href={`tel:${m.phone}`}
                          onClick={(e) => e.stopPropagation()}
                          style={{ fontSize: 12, color: "#2563eb", marginTop: 2, display: "block", textDecoration: "none" }}
                        >
                          {m.phone}
                        </a>
                      </div>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: "3px 8px",
                        borderRadius: 6, background: `${info.color}18`, color: info.color,
                        whiteSpace: "nowrap" as const,
                      }}>
                        {info.type}
                      </span>
                    </div>
                  </Link>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 기타 메뉴 */}
      <div style={{ padding: "12px 12px 0" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6 }}>기타 메뉴</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          {otherMenus.map(([label, href]) => (
            <Link key={label} href={href} style={s.menuBtn}>{label}</Link>
          ))}
        </div>
      </div>

      <div style={{ textAlign: "center", padding: "18px 0", paddingBottom: "calc(80px + env(safe-area-inset-bottom, 0px))" }}>
        <Link href="/director-dashboard" style={{ color: "#94a3b8", fontSize: 12, textDecoration: "underline" }}>
          PC버전 보기
        </Link>
      </div>

      {/* 하단 탭바 */}
      <nav style={s.nav}>
        <NavLinks active="home" />
      </nav>
    </div>
  );
}

function NavLinks({ active }: { active: string }) {
  const items = [
    { key: "home", label: "홈", href: "/mobile-branch" },
    { key: "members", label: "회원", href: "/mobile-members" },
    { key: "attendance", label: "출석", href: "/mobile-attendance" },
    { key: "payments", label: "결제", href: "/mobile-payments" },
    { key: "crm", label: "상담", href: "/mobile-crm" },
  ];
  return (
    <>
      {items.map((item) => (
        <Link key={item.key} href={item.href} style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "10px 0",
          fontSize: 12, fontWeight: 600, textDecoration: "none",
          color: item.key === active ? "#2563eb" : "#64748b",
        }}>
          {item.label}
        </Link>
      ))}
    </>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { background: "#f1f5f9", minHeight: "100vh" },
  header: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "12px 16px 10px",
    background: "#fff", borderBottom: "1px solid #e2e8f0",
  },
  badge: {
    background: "#f1f5f9", border: "1px solid #e2e8f0",
    padding: "3px 10px", borderRadius: 999, fontSize: 11, color: "#64748b", fontWeight: 600,
  },
  primaryBtn: {
    padding: "10px 6px", borderRadius: 10, border: "none", color: "#fff",
    fontSize: 13, fontWeight: 700, cursor: "pointer",
  },
  secondaryBtn: {
    padding: "10px 6px", borderRadius: 10, border: "1.5px solid #e2e8f0",
    background: "#fff", color: "#374151",
    fontSize: 13, fontWeight: 700, textDecoration: "none",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  card: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" },
  divider: { height: 1, background: "#f1f5f9", margin: "0 14px" },
  emptyRow: { padding: "12px 14px", color: "#94a3b8", fontSize: 13 },
  textLink: { fontSize: 12, color: "#2563eb", textDecoration: "none", fontWeight: 600 },
  menuBtn: {
    background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10,
    padding: "10px 8px", textAlign: "center", textDecoration: "none",
    fontSize: 13, fontWeight: 600, color: "#374151",
  },
  nav: {
    position: "fixed", bottom: 0, left: 0, right: 0,
    background: "#fff", borderTop: "1px solid #e2e8f0",
    display: "grid", gridTemplateColumns: "repeat(5, 1fr)",
    paddingBottom: "env(safe-area-inset-bottom, 6px)",
    zIndex: 999,
  },
};
