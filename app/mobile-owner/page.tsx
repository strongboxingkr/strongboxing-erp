"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from "recharts";
import { apiFetch } from "@/lib/api";

const branches = ["전체", "철산점", "목동점", "개봉점", "신정점"];

const fmt = (d: Date) => d.toISOString().slice(0, 10);
const today = fmt(new Date());
const money = (v: any) => `${Number(v || 0).toLocaleString()}원`;

const getWeekStart = () => {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  return fmt(d);
};

const getMonthStart = () => {
  const d = new Date();
  d.setDate(1);
  return fmt(d);
};

const PRESETS = [
  { label: "오늘", start: () => today, end: () => today },
  { label: "이번주", start: getWeekStart, end: () => today },
  { label: "이번달", start: getMonthStart, end: () => today },
];

function numVal(v: any) { return v !== null && v !== undefined ? v : null; }

export default function MobileOwnerPage() {
  const [data, setData] = useState<any>(null);
  const [dataError, setDataError] = useState(false);
  const [chartRows, setChartRows] = useState<any[] | null>(null);
  const [chartError, setChartError] = useState(false);
  const [reservations, setReservations] = useState<any[]>([]);
  const [peakStats, setPeakStats] = useState<any[]>([]);

  const [preset, setPreset] = useState(0);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [branch, setBranch] = useState("전체");
  const [showConsult, setShowConsult] = useState(false);
  const [consultForm, setConsultForm] = useState({
    customer_name: "", phone: "", inquiry_channel: "전화문의",
    memo: "", reservation_date: today, reservation_time: "", branch_name: "철산점",
  });

  const saveConsult = async () => {
    if (!consultForm.customer_name.trim()) { alert("이름을 입력해주세요."); return; }
    try {
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
          memo: `예약일시: ${consultForm.reservation_date} ${consultForm.reservation_time || "-"}\n\n${consultForm.memo}`,
          auto_create_member: false,
          go_payment_after_save: false,
        }),
      });
      const json = await res.json();
      if (json.success) {
        if (consultForm.reservation_time) {
          await apiFetch("/api/calendar-events/add", {
            method: "POST",
            body: JSON.stringify({
              branch_name: consultForm.branch_name,
              event_type: "PHONE",
              title: `전화예약 - ${consultForm.customer_name}`,
              customer_name: consultForm.customer_name,
              phone: consultForm.phone,
              start_datetime: `${consultForm.reservation_date}T${consultForm.reservation_time}`,
              memo: consultForm.memo,
              status: "예약확정",
              source_type: "PHONE_RESERVATION",
              source_id: "",
            }),
          });
        }
        alert("상담 등록 완료!");
        setShowConsult(false);
        setConsultForm({ customer_name: "", phone: "", inquiry_channel: "전화문의", memo: "", reservation_date: today, reservation_time: "", branch_name: "철산점" });
      } else {
        alert(json.message || "상담 등록 실패");
      }
    } catch { alert("저장 중 오류가 발생했습니다."); }
  };

  const applyPreset = (idx: number) => {
    setPreset(idx);
    setStartDate(PRESETS[idx].start());
    setEndDate(PRESETS[idx].end());
  };

  const load = async () => {
    let url = `/api/dashboard?start_date=${startDate}&end_date=${endDate}`;
    if (branch !== "전체") url += `&branch_name=${encodeURIComponent(branch)}`;
    try {
      const res = await fetch(url);
      const json = await res.json();
      setData(json);
      setDataError(false);
    } catch { setDataError(true); }

    try {
      let chartUrl = "/api/dashboard/chart";
      if (branch !== "전체") chartUrl += `?branch_name=${encodeURIComponent(branch)}`;
      const cRes = await fetch(chartUrl);
      const cJson = await cRes.json();
      if (cJson.success) { setChartRows(cJson.rows || []); setChartError(false); }
      else setChartError(true);
    } catch { setChartError(true); }

    try {
      const rRes = await apiFetch("/api/calendar-events");
      const rJson = await rRes.json();
      setReservations((rJson.rows || []).filter((r: any) => r.start_datetime?.slice(0, 10) === today && !["취소", "예약취소"].includes(r.status)));
    } catch {}

    try {
      let psUrl = "/api/attendance-stats?period=month";
      if (branch !== "전체") psUrl += `&branch_name=${encodeURIComponent(branch)}`;
      const psRes = await apiFetch(psUrl);
      const psJson = await psRes.json();
      if (psJson.success) setPeakStats((psJson.hours || []).map((h: any) => ({ hour: h.hour, count: h.cnt })));
    } catch {}
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, [startDate, endDate, branch]);

  const branchSales = data?.branch_sales || [];
  const totalSales = Number(data?.sales || 0);
  const compLabel = data?.comparison_label || "전기간 대비";

  // 기간 표시 라벨
  const periodLabel = preset === 0
    ? "오늘"
    : preset === 1
      ? `${startDate} ~ ${endDate} (이번주)`
      : `${startDate} ~ ${endDate} (이번달)`;

  const opsItems = [
    { label: "오늘 만료", value: numVal(data?.today_expire), unit: "명", href: "/member-expiring" },
    { label: "관리 필요 회원", value: numVal(data?.alert_members), unit: "명", href: "/member-alerts", note: "7일이내 만료·잔여부족" },
    { label: "재연락 상담", value: numVal(data?.crm_alerts), unit: "건", href: "/crm-alerts" },
  ];

  const hasChartData = chartRows !== null && !chartError;
  const maxSales = hasChartData ? Math.max(...chartRows!.map((r) => Number(r.sales || 0))) : 0;
  const chartDomain: [number, number] = [0, maxSales > 0 ? maxSales : 1];

  const todayReservations = reservations.slice(0, 3);

  return (
    <div style={styles.page}>
      {/* 헤더 */}
      <div style={styles.header}>
        <div style={{ fontWeight: 900, fontSize: 17, letterSpacing: 0.5, color: "#1e293b" }}>
          STRONG <span style={{ color: "#2563eb" }}>OWNER</span>
        </div>
        <span style={styles.badge}>대표 모바일</span>
      </div>

      {/* 필터 바 */}
      <div style={styles.filterBar}>
        <div style={{ display: "flex", gap: 6 }}>
          {PRESETS.map((p, i) => (
            <button key={p.label} onClick={() => applyPreset(i)} style={{
              ...styles.presetBtn,
              background: preset === i ? "#2563eb" : "#f1f5f9",
              color: preset === i ? "#fff" : "#374151",
            }}>
              {p.label}
            </button>
          ))}
        </div>
        <select value={branch} onChange={(e) => setBranch(e.target.value)} style={styles.smallSelect}>
          {branches.map((b) => <option key={b}>{b}</option>)}
        </select>
      </div>

      {/* 전체 실적 요약 */}
      <div style={styles.summaryCard}>
        <div style={{ fontSize: 11, color: "#2563eb", fontWeight: 600, marginBottom: 2 }}>
          {periodLabel} · {branch}
        </div>
        <div style={{ fontSize: 10, color: "#64748b", marginBottom: 8 }}>총 매출 (선택 기간)</div>
        {dataError ? (
          <div style={{ fontSize: 14, color: "#ef4444", fontWeight: 600 }}>조회 실패. 다시 시도해주세요.</div>
        ) : !data ? (
          <div style={{ fontSize: 14, color: "#94a3b8" }}>로딩중...</div>
        ) : (
          <>
            <div style={{ fontSize: 32, fontWeight: 900, color: "#1e3a8a", lineHeight: 1.1 }}>
              {money(totalSales)}
            </div>
            <div style={styles.metricRow}>
              <div style={styles.metric}>
                <div style={styles.metricLabel}>신규회원 <span style={styles.basis}>선택기간</span></div>
                <div style={styles.metricValue}>{data.new_members ?? 0}명</div>
              </div>
              <div style={{ ...styles.metric, borderRight: "none" }}>
                <div style={styles.metricLabel}>유효회원 <span style={styles.basis}>현재</span></div>
                <div style={styles.metricValue}>{data.active_members ?? 0}명</div>
              </div>
              <div style={{ ...styles.metric, borderRight: "none", borderLeft: "1px solid #bfdbfe" }}>
                <div style={styles.metricLabel}>오늘 출석 <span style={styles.basis}>오늘</span></div>
                <div style={styles.metricValue}>{data.checkins ?? 0}명</div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 지점별 실적 */}
      {branch === "전체" && branchSales.length > 0 && (
        <div style={styles.section}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
            <div style={styles.sectionTitle}>지점별 실적</div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>{compLabel}</div>
          </div>
          <div style={styles.card}>
            {branchSales.map((b: any, i: number) => {
              const growth = b.sales_growth;
              const showGrowth = growth !== null && growth !== undefined;
              const growthColor = "#64748b"; // 중립색 (증감에 따른 강조 없음)
              const growthIcon = growth >= 0 ? "▲" : "▼";
              return (
                <div key={b.branch_name}>
                  {i > 0 && <div style={styles.divider} />}
                  <div style={styles.branchRow}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>{b.branch_name}</div>
                      <div style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>
                        신규 {b.new_members || 0}명 · 출석 {b.checkins || 0}명
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 17, fontWeight: 900, color: "#2563eb", whiteSpace: "nowrap" as const }}>
                        {money(b.sales || 0)}
                      </div>
                      {showGrowth ? (
                        <div style={{ fontSize: 11, color: growthColor, marginTop: 2 }}>
                          {growthIcon} {Math.abs(growth)}%
                        </div>
                      ) : (
                        <div style={{ fontSize: 11, color: "#cbd5e1", marginTop: 2 }}>—</div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 운영 확인 */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>운영 확인</div>
        <div style={styles.card}>
          {opsItems.map((item, i) => {
            const v = item.value;
            const isLoaded = data !== null;
            const isError = dataError;
            const displayVal = isError ? "?" : !isLoaded ? "—" : v ?? 0;
            const hasValue = isLoaded && !isError && Number(v) > 0;
            return (
              <div key={item.label}>
                {i > 0 && <div style={styles.divider} />}
                <div style={styles.opsRow}>
                  <div>
                    <span style={{ fontSize: 14, color: "#374151", fontWeight: 600 }}>{item.label}</span>
                    {item.note && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>{item.note}</div>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{
                      fontSize: 16, fontWeight: 900,
                      color: hasValue ? "#dc2626" : "#94a3b8",
                    }}>
                      {displayVal}{isLoaded && !isError ? item.unit : ""}
                    </span>
                    {hasValue && (
                      <Link href={item.href} style={styles.viewBtn}>보기</Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 월별매출 바로가기 */}
      <div style={styles.section}>
        <Link href="/mobile-monthly-sales" style={{ textDecoration: "none" }}>
          <div style={{ ...styles.card, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px" }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#1e293b" }}>📊 월별 매출</div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>날짜별 결제 내역 상세 조회</div>
            </div>
            <div style={{ fontSize: 20, color: "#94a3b8" }}>→</div>
          </div>
        </Link>
      </div>

      {/* 최근 7일 매출 차트 */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>최근 7일 매출</div>
        <div style={{ ...styles.card, padding: "14px 8px 8px 0" }}>
          {chartError ? (
            <div style={{ padding: "20px 16px", color: "#94a3b8", fontSize: 13 }}>차트 조회 실패.</div>
          ) : chartRows === null ? (
            <div style={{ padding: "20px 16px", color: "#94a3b8", fontSize: 13 }}>로딩중...</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartRows} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis
                  domain={chartDomain}
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  tickFormatter={(v) => v === 0 ? "0" : `${Math.round(v / 10000)}만`}
                  axisLine={false} tickLine={false} width={34}
                />
                <Tooltip
                  formatter={(v: any) => [`${Number(v).toLocaleString()}원`, "매출"]}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
                />
                <Line type="monotone" dataKey="sales" stroke="#2563eb" strokeWidth={2.5}
                  dot={{ r: 3, fill: "#2563eb" }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* 피크타임 분석 */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>⏰ 피크타임 분석 <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 400 }}>이번달 시간대별 입장</span></div>
        <div style={{ ...styles.card, padding: "14px 8px 8px 0" }}>
          {peakStats.length === 0 ? (
            <div style={{ padding: "20px 16px", color: "#94a3b8", fontSize: 13 }}>데이터 없음</div>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={peakStats} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => `${v}시`} interval={2} />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
                <Tooltip
                  formatter={(v: any) => [`${v}명`, "입장"]}
                  labelFormatter={(l) => `${l}시`}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {peakStats.map((entry: any, index: number) => {
                    const maxCount = Math.max(...peakStats.map((s: any) => s.count));
                    const isTop = entry.count === maxCount && maxCount > 0;
                    return <Cell key={index} fill={isTop ? "#ef4444" : "#93c5fd"} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* 오늘 예약 */}
      <div style={styles.section}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={styles.sectionTitle}>오늘 예약</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {reservations.length > 0 && <span style={{ fontSize: 12, color: "#94a3b8" }}>{reservations.length}건</span>}
            <Link href="/naver-calendar" style={styles.viewBtn}>전체보기</Link>
          </div>
        </div>
        <div style={styles.card}>
          {todayReservations.length === 0 ? (
            <div style={{ padding: "12px 16px", color: "#94a3b8", fontSize: 13 }}>오늘 예약이 없습니다.</div>
          ) : (
            todayReservations.map((r, i) => (
              <div key={r.event_id}>
                {i > 0 && <div style={styles.divider} />}
                <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 4, alignSelf: "stretch", minHeight: 36, background: "#2563eb", borderRadius: 2, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}>
                      {r.start_datetime?.slice(11, 16)} · {r.customer_name}
                    </div>
                    <div style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>
                      {r.branch_name}{r.status ? ` · ${r.status}` : ""}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 빠른 상담등록 */}
      <div style={styles.section}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={styles.sectionTitle}>빠른 상담등록</div>
          <button onClick={() => setShowConsult(!showConsult)} style={{
            padding: "5px 14px", borderRadius: 8, border: "none",
            background: showConsult ? "#1d4ed8" : "#2563eb",
            color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
          }}>
            {showConsult ? "닫기" : "등록하기"}
          </button>
        </div>
        {showConsult && (
          <div style={{ ...styles.card, padding: 14 }}>
            <div style={{ display: "grid", gap: 8 }}>
              <input className="input" placeholder="이름" value={consultForm.customer_name}
                onChange={(e) => setConsultForm({ ...consultForm, customer_name: e.target.value })} />
              <input className="input" placeholder="전화번호" type="tel" value={consultForm.phone}
                onChange={(e) => setConsultForm({ ...consultForm, phone: e.target.value })} />
              <select className="input" value={consultForm.branch_name}
                onChange={(e) => setConsultForm({ ...consultForm, branch_name: e.target.value })}>
                {["철산점","목동점","개봉점","신정점"].map((b) => <option key={b}>{b}</option>)}
              </select>
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
        )}
      </div>

      <div style={{ textAlign: "center", padding: "16px 0", paddingBottom: "calc(80px + env(safe-area-inset-bottom, 0px))" }}>
        <Link href="/dashboard" style={{ color: "#94a3b8", fontSize: 12, textDecoration: "underline" }}>
          PC버전 보기
        </Link>
      </div>

      {/* 하단 탭바 */}
      <nav style={styles.bottomNav}>
        {[
          { href: "/mobile-owner", label: "홈", active: true },
          { href: "/mobile-members", label: "회원", active: false },
          { href: "/mobile-attendance", label: "출석", active: false },
          { href: "/mobile-payments", label: "결제", active: false },
          { href: "/mobile-crm", label: "상담", active: false },
        ].map((item) => (
          <Link key={item.label} href={item.href} style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "10px 0",
            fontSize: 12, fontWeight: 600, textDecoration: "none",
            color: item.active ? "#2563eb" : "#64748b",
          }}>
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { background: "#f1f5f9", minHeight: "100vh" },
  header: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "14px 16px 10px",
    background: "#fff", borderBottom: "1px solid #e2e8f0",
  },
  badge: {
    background: "#f1f5f9", border: "1px solid #e2e8f0",
    padding: "3px 10px", borderRadius: 999, fontSize: 11, color: "#64748b", fontWeight: 600,
  },
  filterBar: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "8px 16px", background: "#fff", borderBottom: "1px solid #e2e8f0", gap: 8,
  },
  presetBtn: {
    padding: "5px 11px", borderRadius: 7, border: "none",
    fontSize: 13, fontWeight: 600, cursor: "pointer",
  },
  smallSelect: {
    padding: "5px 8px", borderRadius: 8, border: "1px solid #e2e8f0",
    fontSize: 13, background: "#f8fafc", color: "#374151", cursor: "pointer",
  },
  summaryCard: {
    margin: "12px 12px 0",
    background: "linear-gradient(135deg, #eff6ff, #dbeafe)",
    border: "1px solid #bfdbfe", borderRadius: 14,
    padding: "10px 14px",
  },
  metricRow: {
    display: "flex", marginTop: 10,
    background: "rgba(255,255,255,0.7)", borderRadius: 10, overflow: "hidden",
  },
  metric: {
    flex: 1, padding: "8px 6px", textAlign: "center" as const,
    borderRight: "1px solid #bfdbfe",
  },
  metricLabel: { fontSize: 10, color: "#475569", marginBottom: 3 },
  metricValue: { fontSize: 16, fontWeight: 900, color: "#1e293b", whiteSpace: "nowrap" as const },
  basis: { fontSize: 9, color: "#94a3b8", fontWeight: 400, marginLeft: 2 },
  section: { padding: "12px 12px 0" },
  sectionTitle: { fontSize: 14, fontWeight: 800, color: "#1e293b", marginBottom: 8 },
  card: { background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", overflow: "hidden" },
  divider: { height: 1, background: "#f1f5f9", margin: "0 14px" },
  branchRow: {
    display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 14px",
  },
  opsRow: {
    display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 14px",
  },
  viewBtn: {
    padding: "4px 10px", background: "#2563eb", color: "#fff",
    borderRadius: 6, fontSize: 12, fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap" as const,
  },
  bottomNav: {
    position: "fixed" as const, bottom: 0, left: 0, right: 0,
    background: "#fff", borderTop: "1px solid #e2e8f0",
    display: "grid", gridTemplateColumns: "repeat(5, 1fr)",
    paddingBottom: "env(safe-area-inset-bottom, 8px)", zIndex: 999,
  },
};
