"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { apiFetch } from "@/lib/api";

const statuses = ["예약접수", "예약확정", "확인완료", "상담완료", "노쇼", "취소"];

const getStatusColor = (status: string) => {
  if (status === "예약접수") return "#3b82f6";
  if (status === "예약확정") return "#22c55e";
  if (status === "확인완료") return "#8b5cf6";
  if (status === "상담완료") return "#f59e0b";
  if (status === "노쇼") return "#ef4444";
  if (status === "취소") return "#6b7280";
  return "#9ca3af";
};

const getSourceInfo = (r: any) => {
  const memo = String(r.memo || "");
  const product = String(r.reservation_product || "");
  if (memo.includes("출처: 홈페이지 예약") || product.includes("홈페이지")) {
    return { label: "홈페이지", color: "#3b82f6" };
  }
  return { label: "네이버", color: "#22c55e" };
};

const todayStr = () => new Date().toISOString().slice(0, 10);
const addDays = (d: string, n: number) => new Date(new Date(d).getTime() + n * 86400000).toISOString().slice(0, 10);
const weekStart = () => { const d = new Date(); d.setDate(d.getDate() - d.getDay() + 1); return d.toISOString().slice(0, 10); };
const monthStart = () => new Date().toISOString().slice(0, 8) + "01";
const monthEnd = () => { const d = new Date(); d.setMonth(d.getMonth() + 1, 0); return d.toISOString().slice(0, 10); };

export default function NaverReservationsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [branch, setBranch] = useState("전체");
  const [selected, setSelected] = useState<any>(null);
  const [modalMemo, setModalMemo] = useState("");
  const [search, setSearch] = useState("");
  const [user, setUser] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState("전체");

  const today = todayStr();
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(addDays(today, 30));

  const [smsModalOpen, setSmsModalOpen] = useState(false);
  const [smsReservation, setSmsReservation] = useState<any>(null);
  const [smsMessage, setSmsMessage] = useState("");

  const getUser = () => {
    if (typeof window === "undefined") return null;
    const savedUser = localStorage.getItem("user");
    return savedUser ? JSON.parse(savedUser) : null;
  };

  const isAdminOrOwner = user?.role === "ADMIN" || user?.role === "OWNER";

  const loadBranches = async () => {
    const res = await apiFetch("/api/settings?option_type=BRANCH");
    const data = await res.json();
    setBranches(data.rows || []);
  };

  const loadReservations = async (currentUser = user) => {
    let url = "/api/naver-reservations";
    if (currentUser && currentUser.role !== "ADMIN" && currentUser.role !== "OWNER") {
      url += `?branch_name=${encodeURIComponent(currentUser.branch_name)}`;
    } else if (branch !== "전체") {
      url += `?branch_name=${encodeURIComponent(branch)}`;
    }
    const res = await apiFetch(url);
    const data = await res.json();
    setRows(data.rows || []);
  };

  const syncGmail = async () => {
    const res = await apiFetch("/api/naver-reservations/sync");
    const data = await res.json();
    if (data.success) {
      alert(`메일 동기화 완료!\n확인: ${data.checked}건\n신규등록: ${data.inserted}건`);
      loadReservations(user);
    } else {
      alert("메일 동기화 실패");
    }
  };

  const updateReservation = async (r: any, status: string, memo?: string, smsMsg?: string) => {
    if (status === "노쇼") { if (!confirm("노쇼 처리하시겠습니까?")) return; }
    if (status === "취소") { if (!confirm("예약을 취소하시겠습니까?")) return; }

    const res = await apiFetch("/api/naver-reservations/update", {
      method: "POST",
      body: JSON.stringify({ reservation_id: r.reservation_id, status, memo: memo ?? r.memo ?? "", sms_message: smsMsg || "" }),
    });
    const data = await res.json();
    if (data.success) {
      if (status === "예약확정") alert("예약확정 및 안내문자 발송 완료");
      else alert("예약 상태 수정 완료");
      await loadReservations(user);
      const updated = { ...r, status, memo: memo ?? r.memo ?? "" };
      setSelected(updated);
      setModalMemo(updated.memo || "");
    } else {
      alert(data.message || "수정 실패");
    }
  };

  const openModal = (r: any) => { setSelected(r); setModalMemo(r.memo || ""); };

  useEffect(() => {
    const savedUser = getUser();
    setUser(savedUser);
    loadBranches();
    loadReservations(savedUser);
  }, []);

  useEffect(() => {
    if (user) {
      loadReservations(user);
      const timer = setInterval(() => loadReservations(user), 30000);
      return () => clearInterval(timer);
    }
  }, [branch, user]);

  // 홈페이지 출처 포함 전체 rows 사용 (naverRows 필터 제거 — 출처 보조표시로 유지)
  const filtered = rows
    .filter((r) => {
      const date = r.reservation_date?.slice(0, 10);
      const dateOk = (!startDate || date >= startDate) && (!endDate || date <= endDate);
      const searchOk = !search ||
        r.customer_name?.includes(search) ||
        r.phone?.includes(search) ||
        r.branch_name?.includes(search) ||
        r.reservation_product?.includes(search) ||
        r.status?.includes(search);
      const statusOk = statusFilter === "전체" || r.status === statusFilter;
      return dateOk && searchOk && statusOk;
    })
    .sort((a, b) => {
      const aDate = `${a.reservation_date || "9999-99-99"} ${a.reservation_time || "99:99"}`;
      const bDate = `${b.reservation_date || "9999-99-99"} ${b.reservation_time || "99:99"}`;
      return aDate.localeCompare(bDate);
    });

  const countByStatus = (s: string) => rows.filter((r) => r.status === s).length;

  const statTabs: [string, number][] = [
    ["전체", rows.length],
    ["예약접수", countByStatus("예약접수")],
    ["예약확정", countByStatus("예약확정")],
    ["확인완료", countByStatus("확인완료")],
    ["상담완료", countByStatus("상담완료")],
    ["노쇼", countByStatus("노쇼")],
    ["취소", countByStatus("취소")],
  ];

  const setQuick = (s: string, e: string) => { setStartDate(s); setEndDate(e); };

  return (
    <AppShell title="예약 관리">
      <style>{`
        .res-table-wrap { background: var(--panel); border: 1px solid #e5e7eb; border-radius: 12px; overflow-x: visible; }
        .res-table { width: 100%; min-width: 0; table-layout: fixed; border-collapse: collapse; }
        .res-table th, .res-table td { padding: 0 12px; height: 48px; vertical-align: middle; border-bottom: 1px solid #f3f4f6; font-size: 13px; white-space: nowrap; }
        .res-table th { background: #f9fafb; font-weight: 600; color: #6B7280; text-align: left; }
        .res-table tbody tr:last-child td { border-bottom: none; }
        .res-table tbody tr:hover td { background: #f8faff; cursor: pointer; }
        .res-table .col-wrap { white-space: normal; word-break: break-all; }
        .stat-tab { height: 32px; padding: 0 12px; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer; border: 1px solid #e5e7eb; background: #fff; color: #374151; white-space: nowrap; }
        .stat-tab.active { background: #111827; color: #fff; border-color: #111827; }
        @media (max-width: 900px) {
          .res-table-wrap { background: none; border: none; border-radius: 0; }
          .res-table { display: none; }
          .res-cards { display: flex !important; }
          .filter-grid { grid-template-columns: 1fr 1fr !important; }
        }
        .res-cards { display: none; flex-direction: column; gap: 10px; }
        .res-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px 16px; cursor: pointer; }
      `}</style>

      {/* 상단 바 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: "#6B7280" }}>
          방문일 기준 · 조회 범위: <strong style={{ color: "#111827" }}>{startDate || "전체"}{endDate ? ` ~ ${endDate}` : ""}</strong>
          <span style={{ marginLeft: 8, color: "#9CA3AF" }}>총 {filtered.length}건</span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button className="btn secondary" style={{ height: 36, fontSize: 13 }} onClick={() => loadReservations(user)}>새로고침</button>
          <button className="btn" style={{ height: 36, fontSize: 13 }} onClick={syncGmail}>메일 동기화</button>
        </div>
      </div>

      {/* 상태 탭 */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        {statTabs.map(([label, count]) => (
          <button
            key={label}
            className={`stat-tab${statusFilter === label ? " active" : ""}`}
            onClick={() => setStatusFilter(label)}
          >
            {label} <span style={{ marginLeft: 4, fontWeight: 700, color: statusFilter === label ? "#fff" : getStatusColor(label) }}>{count}</span>
          </button>
        ))}
      </div>

      {/* 필터 */}
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "14px 16px", marginBottom: 14 }}>
        <div className="filter-grid" style={{ display: "grid", gridTemplateColumns: "auto 1fr 1fr 2fr auto auto", gap: 8, alignItems: "center" }}>
          {isAdminOrOwner ? (
            <select className="input" style={{ height: 36, fontSize: 13, minWidth: 120 }} value={branch} onChange={(e) => setBranch(e.target.value)}>
              <option>전체</option>
              {branches.map((b) => <option key={b.option_id}>{b.option_name}</option>)}
            </select>
          ) : (
            <div style={{ fontSize: 13, color: "#374151", fontWeight: 500 }}>{user?.branch_name}</div>
          )}
          <div>
            <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 2 }}>방문 시작일</div>
            <input className="input" type="date" style={{ height: 36, fontSize: 13 }} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 2 }}>방문 종료일</div>
            <input className="input" type="date" style={{ height: 36, fontSize: 13 }} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <input className="input" style={{ height: 36, fontSize: 13 }} placeholder="예약자명, 전화번호, 상품 검색" value={search} onChange={(e) => setSearch(e.target.value)} />
          <button className="btn" style={{ height: 36, fontSize: 13, whiteSpace: "nowrap" }} onClick={() => loadReservations(user)}>검색</button>
          <button className="btn secondary" style={{ height: 36, fontSize: 13, whiteSpace: "nowrap" }} onClick={() => { setBranch("전체"); setStartDate(today); setEndDate(addDays(today, 30)); setSearch(""); setStatusFilter("전체"); }}>초기화</button>
        </div>
        {/* 빠른 기간 */}
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          <button className="stat-tab" onClick={() => setQuick(today, today)}>오늘</button>
          <button className="stat-tab" onClick={() => setQuick(weekStart(), addDays(weekStart(), 6))}>이번 주</button>
          <button className="stat-tab" onClick={() => setQuick(monthStart(), monthEnd())}>이번 달</button>
          <button className="stat-tab" onClick={() => setQuick("", "")}>전체</button>
        </div>
      </div>

      {/* PC 테이블 */}
      <div className="res-table-wrap">
        <table className="res-table">
          <colgroup>
            <col style={{ width: 90 }} />
            <col style={{ width: 72 }} />
            {isAdminOrOwner && <col style={{ width: 72 }} />}
            <col style={{ width: 90 }} />
            <col style={{ width: 100 }} />
            <col />
            <col style={{ width: 80 }} />
            <col style={{ width: 36 }} />
          </colgroup>
          <thead>
            <tr>
              <th>방문일</th>
              <th>시간</th>
              {isAdminOrOwner && <th>지점</th>}
              <th>예약자</th>
              <th>연락처</th>
              <th>상품</th>
              <th>상태</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={isAdminOrOwner ? 8 : 7} style={{ textAlign: "center", color: "#9CA3AF", padding: 32 }}>조회된 예약이 없습니다.</td></tr>
            )}
            {filtered.map((r) => {
              const source = getSourceInfo(r);
              return (
                <tr key={r.reservation_id} onClick={() => openModal(r)} style={{ background: selected?.reservation_id === r.reservation_id ? "rgba(59,130,246,0.07)" : undefined }}>
                  <td style={{ fontWeight: 600 }}>{r.reservation_date?.slice(0, 10) || "-"}</td>
                  <td style={{ color: "#374151" }}>{r.reservation_time || "-"}</td>
                  {isAdminOrOwner && <td style={{ color: "#374151" }}>{r.branch_name || "-"}</td>}
                  <td style={{ fontWeight: 600 }}>
                    {r.customer_name || "-"}
                    <span style={{ marginLeft: 5, fontSize: 11, color: source.color, fontWeight: 500 }}>{source.label}</span>
                  </td>
                  <td style={{ color: "#6B7280" }}>{r.phone || "미제공"}</td>
                  <td className="col-wrap" style={{ color: "#374151" }}>{r.reservation_product || "-"}</td>
                  <td>
                    <span style={{ fontSize: 12, fontWeight: 600, color: getStatusColor(r.status) }}>● {r.status}</span>
                  </td>
                  <td style={{ textAlign: "center", color: "#9CA3AF", fontSize: 16 }}>›</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* 모바일 카드 */}
        <div className="res-cards">
          {filtered.length === 0 && <div style={{ color: "#9CA3AF", textAlign: "center", padding: 32 }}>조회된 예약이 없습니다.</div>}
          {filtered.map((r) => {
            const source = getSourceInfo(r);
            return (
              <div key={r.reservation_id} className="res-card" onClick={() => openModal(r)}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{r.customer_name || "-"} <span style={{ fontSize: 11, color: source.color }}>{source.label}</span></div>
                    <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>{r.branch_name} · {r.reservation_date?.slice(0, 10)} {r.reservation_time}</div>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: getStatusColor(r.status), whiteSpace: "nowrap" }}>● {r.status}</span>
                </div>
                <div style={{ marginTop: 6, fontSize: 13, color: "#374151" }}>{r.reservation_product || "-"}</div>
                <div style={{ marginTop: 4, fontSize: 12, color: "#6B7280" }}>{r.phone || "미제공"}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 상세 모달 */}
      {selected && (
        <div onClick={() => setSelected(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "grid", placeItems: "center", zIndex: 9999, padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 680, maxHeight: "90vh", overflow: "auto", background: "#fff", borderRadius: 20, padding: 28, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, gap: 16 }}>
              <div>
                <div style={{ fontSize: 24, fontWeight: 800, color: "#111827" }}>{selected.customer_name || "-"}</div>
                <div style={{ color: "#6B7280", marginTop: 6, fontSize: 14 }}>
                  {selected.branch_name} · {selected.reservation_product || "-"}
                </div>
              </div>
              <button className="btn secondary" onClick={() => setSelected(null)}>닫기</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
              {[
                ["방문일", selected.reservation_date?.slice(0, 10) || "-"],
                ["방문시간", selected.reservation_time || "-"],
                ["연락처", selected.phone || "미제공"],
                ["메일수신일", selected.created_at?.slice(0, 10) || "-"],
              ].map(([label, val]) => (
                <div key={label} style={{ background: "#f9fafb", borderRadius: 8, padding: "10px 12px" }}>
                  <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 4 }}>{label}</div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>{val}</div>
                </div>
              ))}
            </div>

            <div style={{ fontSize: 12, color: "#6B7280", fontWeight: 600, marginBottom: 8 }}>예약 상태</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
              {statuses.map((s) => (
                <button key={s}
                  onClick={() => {
                    if (s === "예약확정") {
                      setSmsReservation(selected);
                      setSmsMessage(`[스트롱복싱 ${selected.branch_name}]\n\n${selected.customer_name}님 예약이 확정되었습니다.\n\n방문일시 : ${selected.reservation_date?.slice(0, 10)} ${selected.reservation_time}\n예약내용 : ${selected.reservation_product || "방문 상담"}\n\n편한 복장과 실내 운동화를 지참 후 방문 부탁드립니다.\n처음 방문이신 경우 예약시간 5~10분 전 도착 부탁드립니다.\n\n감사합니다.\n스트롱복싱 ${selected.branch_name}`);
                      setSelected(null);
                      setSmsModalOpen(true);
                      return;
                    }
                    updateReservation(selected, s, modalMemo);
                  }}
                  style={{ height: 36, padding: "0 14px", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 13, border: "none", background: selected.status === s ? getStatusColor(s) : "#f3f4f6", color: selected.status === s ? "#fff" : "#374151" }}
                >{s}</button>
              ))}
            </div>

            <div style={{ fontSize: 12, color: "#6B7280", fontWeight: 600, marginBottom: 6 }}>메모 / 상담내용</div>
            <textarea className="input" value={modalMemo} onChange={(e) => setModalMemo(e.target.value)} placeholder="상담 메모 입력..." style={{ width: "100%", minHeight: 100, resize: "none", marginBottom: 12 }} />
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <button className="btn secondary" onClick={() => setModalMemo(selected.memo || "")}>메모 되돌리기</button>
              <button className="btn" onClick={() => updateReservation(selected, selected.status, modalMemo)}>메모 저장</button>
            </div>

            <details style={{ marginTop: 16 }}>
              <summary style={{ color: "#9CA3AF", cursor: "pointer", fontSize: 13 }}>메일 원문 보기</summary>
              <div style={{ background: "#f9fafb", borderRadius: 8, padding: 12, maxHeight: 180, overflow: "auto", whiteSpace: "pre-wrap", fontSize: 12, color: "#374151", marginTop: 8 }}>
                {selected.memo || "상세 내용 없음"}
              </div>
            </details>
          </div>
        </div>
      )}

      {/* 문자 발송 모달 */}
      {smsModalOpen && smsReservation && (
        <div onClick={() => setSmsModalOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "grid", placeItems: "center", zIndex: 10000, padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 560, background: "#fff", borderRadius: 20, padding: 24 }}>
            <h2 style={{ marginTop: 0, marginBottom: 12, fontSize: 18 }}>문자 발송 확인</h2>
            <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 14 }}>
              {smsReservation.customer_name} / {smsReservation.phone}<br />
              {smsReservation.reservation_date?.slice(0, 10)} {smsReservation.reservation_time}
            </div>
            <textarea className="input" value={smsMessage} onChange={(e) => setSmsMessage(e.target.value)} style={{ width: "100%", minHeight: 220, resize: "vertical", marginBottom: 16 }} />
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="btn secondary" onClick={() => setSmsModalOpen(false)}>취소</button>
              <button className="btn" onClick={async () => { await updateReservation(smsReservation, "예약확정", modalMemo, smsMessage); setSmsModalOpen(false); }}>예약확정 + 문자발송</button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
