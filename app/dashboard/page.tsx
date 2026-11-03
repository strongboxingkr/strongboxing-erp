"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { apiFetch } from "@/lib/api";

const formatDate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};

const today = formatDate(new Date());

const getMonthStart = () => {
  const d = new Date();
  d.setDate(1);
  return formatDate(d);
};

const getWeekStart = () => {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return formatDate(d);
};

const money = (v: any) => `${Number(v || 0).toLocaleString()}원`;
const pct = (a: number, total: number) =>
  total > 0 ? Math.round((a / total) * 100) : 0;

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [branch, setBranch] = useState("전체");
  const [startDate, setStartDate] = useState(getMonthStart());
  const [endDate, setEndDate] = useState(today);
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const check = () => setMobile(window.innerWidth < 900);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const loadBranches = async () => {
    const res = await apiFetch("/api/settings?option_type=BRANCH");
    const json = await res.json();
    setBranches(json.rows || []);
  };

  const loadDashboard = async () => {
    let url = `/api/dashboard?start_date=${startDate}&end_date=${endDate}`;
    if (branch !== "전체") url += `&branch_name=${encodeURIComponent(branch)}`;
    const res = await apiFetch(url);
    const json = await res.json();
    setData(json);
  };

  useEffect(() => { loadBranches(); }, []);

  useEffect(() => {
    loadDashboard();
    const timer = setInterval(loadDashboard, 60000);
    return () => clearInterval(timer);
  }, [branch, startDate, endDate]);

  const setRange = (type: "today" | "week" | "month") => {
    if (type === "today") { setStartDate(today); setEndDate(today); }
    else if (type === "week") { setStartDate(getWeekStart()); setEndDate(today); }
    else { setStartDate(getMonthStart()); setEndDate(today); }
  };

  if (!data) {
    return <AppShell title="대표 대시보드"><div style={{ color: "#888", padding: 40 }}>로딩중...</div></AppShell>;
  }

  const pm = data.payment_methods || {};
  const branchSales = data.branch_sales || [];
  const totalSales = Number(data.sales || 0);
  const cashAmt = Number(pm.CASH || 0);
  const cardAmt = Number(pm.CARD || 0);
  const transferAmt = Number(pm.TRANSFER || 0);

  const summaryCards = [
    { label: "총 매출", value: money(totalSales), accent: "#2563eb", icon: "💰" },
    { label: "유효회원", value: `${data.active_members || 0}명`, accent: "#0891b2", icon: "👥" },
    { label: "오늘 출석", value: `${data.checkins || 0}명`, accent: "#7c3aed", icon: "✅" },
    { label: "재연락 상담", value: `${data.crm_alerts || 0}건`, accent: "#dc2626", icon: "📞" },
    { label: "오늘 만료", value: `${data.today_expire || 0}명`, accent: "#d97706", icon: "⏰" },
  ];

  const opsItems = [
    { label: "관리 필요 회원", value: data.alert_members || 0, color: "#dc2626", href: "/member-alerts" },
    { label: "재연락 상담", value: data.crm_alerts || 0, color: "#9333ea", href: "/crm-alerts" },
    { label: "오늘 만료", value: data.today_expire || 0, color: "#d97706", href: "#expire-list" },
  ];

  return (
    <AppShell title="대표 대시보드">
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>

        {/* 필터 바 */}
        <div style={{
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          padding: "12px 16px",
          marginBottom: 20,
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "center",
        }}>
          <select
            className="input"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            style={{ width: 120 }}
          >
            <option>전체</option>
            {branches.map((b) => (
              <option key={b.option_id}>{b.option_name}</option>
            ))}
          </select>

          <input className="input" type="date" value={startDate}
            onChange={(e) => setStartDate(e.target.value)} style={{ width: 150 }} />
          <span style={{ color: "#94a3b8", fontWeight: 600 }}>~</span>
          <input className="input" type="date" value={endDate}
            onChange={(e) => setEndDate(e.target.value)} style={{ width: 150 }} />

          <div style={{ display: "flex", gap: 6 }}>
            {([["오늘", "today"], ["이번주", "week"], ["이번달", "month"]] as const).map(([label, type]) => (
              <button
                key={type}
                onClick={() => setRange(type)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  background: "#f8fafc",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  color: "#374151",
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            className="btn secondary"
            onClick={loadDashboard}
            style={{ marginLeft: "auto", fontSize: 13 }}
          >
            새로고침
          </button>
        </div>

        {/* 요약 카드 */}
        <div style={{
          display: "grid",
          gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(5, 1fr)",
          gap: 12,
          marginBottom: 20,
        }}>
          {summaryCards.map((c) => (
            <div key={c.label} style={{
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: 12,
              padding: "14px 18px",
              borderTop: `3px solid ${c.accent}`,
            }}>
              <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600, marginBottom: 6 }}>
                {c.label}
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#1e293b", whiteSpace: "nowrap" }}>
                {c.value}
              </div>
            </div>
          ))}
        </div>

        {/* 지점별 현황 */}
        {branch === "전체" && (
          <div style={{
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            padding: 20,
            marginBottom: 20,
          }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#1e293b", marginBottom: 16 }}>
              지점별 현황
            </div>

            <div style={{
              display: "grid",
              gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(4, 1fr)",
              gap: 12,
            }}>
              {branchSales.map((b: any) => (
                <div key={b.branch_name} style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  padding: 16,
                }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#1e293b", marginBottom: 4 }}>
                    {b.branch_name}
                  </div>

                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
                    <span style={{ fontSize: 24, fontWeight: 900, color: "#2563eb", whiteSpace: "nowrap" }}>
                      {money(b.sales || b.total || 0)}
                    </span>
                    {b.sales_growth !== null && b.sales_growth !== undefined && (
                      <span style={{
                        fontSize: 12, fontWeight: 700,
                        color: b.sales_growth >= 0 ? "#16a34a" : "#dc2626",
                      }}>
                        {b.sales_growth >= 0 ? "▲" : "▼"} {Math.abs(b.sales_growth)}%
                      </span>
                    )}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 10px" }}>
                    {[
                      ["유효회원", `${b.active_members}명`, "#374151"],
                      ["오늘출석", `${b.checkins}명`, "#374151"],
                      ["신규가입", `${b.new_members || 0}명`, "#374151"],
                      ["재등록", `${b.rereg_count || 0}명`, "#2563eb"],
                      ["만료임박", `${b.expiring_soon || 0}명`, b.expiring_soon > 0 ? "#dc2626" : "#374151"],
                      ["재등록율", b.rereg_rate !== null && b.rereg_rate !== undefined ? `${b.rereg_rate}%` : "-",
                        b.rereg_rate !== null ? (b.rereg_rate >= 50 ? "#16a34a" : "#d97706") : "#374151"],
                    ].map(([label, val, col]) => (
                      <div key={label as string}>
                        <div style={{ fontSize: 11, color: "#94a3b8" }}>{label}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: col as string }}>{val}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 하단 2열 */}
        <div style={{
          display: "grid",
          gridTemplateColumns: mobile ? "1fr" : "1fr 1fr",
          gap: 16,
          marginBottom: 20,
        }}>
          {/* 결제수단 비율 */}
          <div style={{
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            padding: 20,
          }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#1e293b", marginBottom: 16 }}>
              결제수단 비율
            </div>

            {[
              { label: "카드", amount: cardAmt, color: "#2563eb" },
              { label: "현금", amount: cashAmt, color: "#16a34a" },
              { label: "계좌이체", amount: transferAmt, color: "#7c3aed" },
            ].map(({ label, amount, color }) => {
              const p = pct(amount, totalSales);
              return (
                <div key={label} style={{ marginBottom: 14 }}>
                  <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 6,
                    alignItems: "center",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: color }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>{label}</span>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}>
                        {money(amount)}
                      </span>
                      <span style={{ fontSize: 12, color: "#94a3b8", marginLeft: 6 }}>
                        {p}%
                      </span>
                    </div>
                  </div>
                  <div style={{
                    width: "100%", height: 8,
                    background: "#f1f5f9",
                    borderRadius: 999,
                    overflow: "hidden",
                  }}>
                    <div style={{
                      width: `${p}%`,
                      height: "100%",
                      background: color,
                      borderRadius: 999,
                      transition: "width 0.4s ease",
                    }} />
                  </div>
                </div>
              );
            })}

            {totalSales === 0 && (
              <div style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", padding: "12px 0" }}>
                해당 기간 매출 없음
              </div>
            )}
          </div>

          {/* 운영 체크 */}
          <div style={{
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            padding: 20,
          }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#1e293b", marginBottom: 16 }}>
              운영 체크
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {opsItems.map((item) => (
                <div key={item.label} style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 14px",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: 10,
                }}>
                  <span style={{ fontSize: 14, color: "#374151", fontWeight: 600 }}>
                    {item.label}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{
                      fontSize: 20, fontWeight: 900,
                      color: item.value > 0 ? item.color : "#94a3b8",
                    }}>
                      {item.value}건
                    </span>
                    {item.value > 0 && (
                      <a
                        href={item.href}
                        style={{
                          padding: "5px 12px",
                          background: item.color,
                          color: "#fff",
                          borderRadius: 7,
                          fontSize: 12,
                          fontWeight: 700,
                          textDecoration: "none",
                          whiteSpace: "nowrap",
                        }}
                      >
                        보기
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 오늘 만료 회원 */}
        <div id="expire-list" style={{
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          padding: 20,
          marginBottom: 20,
        }}>
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            marginBottom: 16,
          }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>오늘 만료 회원</div>
            <div style={{
              background: data.today_expire > 0 ? "#fef3c7" : "#f1f5f9",
              color: data.today_expire > 0 ? "#d97706" : "#94a3b8",
              fontWeight: 700, fontSize: 13,
              padding: "4px 12px", borderRadius: 20,
            }}>
              {data.today_expire || 0}명
            </div>
          </div>

          {(data.today_expire_members || []).length === 0 ? (
            <div style={{ color: "#94a3b8", fontSize: 14, padding: "8px 0" }}>
              오늘 만료 회원이 없습니다.
            </div>
          ) : (
            <div style={{
              display: "grid",
              gridTemplateColumns: mobile ? "1fr" : "repeat(2, 1fr)",
              gap: 10,
            }}>
              {(data.today_expire_members || []).map((m: any) => (
                <div key={m.member_id} style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 14px",
                  background: "#fffbeb",
                  border: "1px solid #fde68a",
                  borderRadius: 10,
                  gap: 12,
                }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: "#1e293b" }}>{m.name}</div>
                    <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 3 }}>
                      {m.branch_name} · {m.phone}
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                      {m.product_name}
                    </div>
                  </div>
                  <span style={{
                    padding: "4px 10px", borderRadius: 8,
                    background: "#d97706", color: "#fff",
                    fontSize: 12, fontWeight: 700, whiteSpace: "nowrap",
                  }}>
                    오늘 만료
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 관리자 기능 */}
        <div style={{
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          padding: 20,
        }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#1e293b", marginBottom: 14 }}>
            관리자 기능
          </div>
          <div style={{
            display: "grid",
            gridTemplateColumns: mobile ? "1fr" : "1fr 1fr",
            gap: 12,
          }}>
            <a href="/users/pending" style={{ textDecoration: "none" }}>
              <div style={{
                padding: "16px 18px",
                background: "#eff6ff",
                border: "1px solid #bfdbfe",
                borderRadius: 10,
                cursor: "pointer",
              }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: "#1d4ed8" }}>회원가입 승인</div>
                <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
                  신규 관장/직원 승인관리
                </div>
              </div>
            </a>
          </div>
        </div>

      </div>
    </AppShell>
  );
}
