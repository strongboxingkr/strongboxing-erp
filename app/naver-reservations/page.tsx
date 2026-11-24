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

// memo 파싱: 운영메모(---MAIL--- 앞) + 메일 구조화 필드 분리
function parseMemo(raw: string) {
  const sep = "---MAIL---";
  const sepIdx = raw.indexOf(sep);
  const opsMemo = sepIdx >= 0 ? raw.slice(0, sepIdx).trim() : "";
  const mailPart = sepIdx >= 0 ? raw.slice(sepIdx + sep.length).trim() : raw;

  const get = (pattern: RegExp) => mailPart.match(pattern)?.[1]?.trim() || "";
  const reservationNo = get(/예약번호:([^\n]+)/);
  const mailSubject = get(/메일제목:\s*([^\n]+)/);
  const receivedAt = get(/예약신청일시:\s*([^\n]+)/);
  const inquiry = get(/문의사항:\s*([^\n]+)/);
  const goal = get(/운동목적:\s*([^\n]+)/);

  // 메일 본문: 첫 빈 줄 이후 텍스트
  const rawTextMatch = mailPart.match(/\n\n([\s\S]+)$/);
  const rawText = rawTextMatch ? rawTextMatch[1].trim() : "";

  return { opsMemo, mailPart, reservationNo, mailSubject, receivedAt, inquiry, goal, rawText };
}

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
  const [editPhone, setEditPhone] = useState("");
  const [editOpsMemo, setEditOpsMemo] = useState("");
  const [search, setSearch] = useState("");
  const [user, setUser] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState("전체");
  const [savingPhone, setSavingPhone] = useState(false);

  const today = todayStr();
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(addDays(today, 30));

  const [smsModal, setSmsModal] = useState<{ reservation: any; pendingStatus: string; message: string } | null>(null);

  const getUser = () => {
    if (typeof window === "undefined") return null;
    const s = localStorage.getItem("user");
    return s ? JSON.parse(s) : null;
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

  const syncKakao = async () => {
    const res = await apiFetch("/api/kakao-reservations/sync", { method: "POST" });
    const data = await res.json();
    if (data.ok) {
      const errMsg = data.errors?.length ? `\n오류: ${data.errors.join(", ")}` : "";
      alert(`카카오 동기화 완료!\n신규: ${data.new}건\n업데이트: ${data.updated}건\n스킵: ${data.skipped}건${errMsg}`);
      loadReservations(user);
    } else {
      alert("카카오 동기화 실패");
    }
  };

  // 상태+메모+전화번호 저장 (문자 없음)
  const updateStatus = async (r: any, status: string, opsMemo: string, phone: string) => {
    if (status === "노쇼" && !confirm("노쇼 처리하시겠습니까?")) return false;
    if (status === "취소" && !confirm("예약을 취소하시겠습니까?")) return false;

    const parsed = parseMemo(r.memo || "");
    const newMemo = opsMemo.trim()
      ? `${opsMemo.trim()}\n---MAIL---\n${parsed.mailPart}`
      : parsed.mailPart;

    const res = await apiFetch("/api/naver-reservations/update", {
      method: "POST",
      body: JSON.stringify({
        reservation_id: r.reservation_id,
        status,
        memo: newMemo,
        phone: phone || undefined,
      }),
    });
    const data = await res.json();
    if (data.success) {
      await loadReservations(user);
      const updated = { ...r, status, memo: newMemo, phone: phone || r.phone };
      setSelected(updated);
      setEditOpsMemo(parseMemo(updated.memo || "").opsMemo);
      return true;
    } else {
      alert(data.message || "저장 실패");
      return false;
    }
  };

  // 연락처만 저장
  const savePhone = async () => {
    if (!selected || !editPhone.trim()) return;
    setSavingPhone(true);
    try {
      const parsed = parseMemo(selected.memo || "");
      const newMemo = editOpsMemo.trim()
        ? `${editOpsMemo.trim()}\n---MAIL---\n${parsed.mailPart}`
        : parsed.mailPart;
      const res = await apiFetch("/api/naver-reservations/update", {
        method: "POST",
        body: JSON.stringify({ reservation_id: selected.reservation_id, status: selected.status, memo: newMemo, phone: editPhone.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        await loadReservations(user);
        setSelected({ ...selected, phone: editPhone.trim(), memo: newMemo });
        alert("연락처 저장 완료");
      } else {
        alert(data.message || "저장 실패");
      }
    } finally {
      setSavingPhone(false);
    }
  };

  const openModal = (r: any) => {
    setSelected(r);
    const parsed = parseMemo(r.memo || "");
    setEditOpsMemo(parsed.opsMemo);
    setEditPhone(r.phone || "");
  };

  const openSmsModal = (r: any, pendingStatus: string) => {
    const dt = r.reservation_date ? `${r.reservation_date.slice(0, 10)} ${r.reservation_time || ""}` : "-";
    const purpose = r.reservation_product || "방문 상담";
    setSmsModal({
      reservation: r,
      pendingStatus,
      message: `[스트롱복싱 ${r.branch_name}]

${r.customer_name}님 예약이 확정되었습니다.

방문일시 : ${dt}
예약내용 : ${purpose}

편한 복장과 실내 운동화를 지참 후 방문 부탁드립니다.
처음 방문이신 경우 예약시간 5~10분 전 도착 부탁드립니다.

감사합니다.`,
    });
  };

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

  const filtered = rows
    .filter((r) => {
      const date = r.reservation_date?.slice(0, 10);
      const dateOk = (!startDate || date >= startDate) && (!endDate || date <= endDate);
      const searchOk = !search || r.customer_name?.includes(search) || r.phone?.includes(search) || r.branch_name?.includes(search) || r.reservation_product?.includes(search) || r.status?.includes(search);
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

  // 선택된 예약의 메모 파싱
  const parsed = selected ? parseMemo(selected.memo || "") : null;
  const hasInquiry = !!parsed?.inquiry && parsed.inquiry !== "-";

  return (
    <AppShell title="예약 관리">
      <style>{`
        .res-table-wrap { background: var(--panel); border: 1px solid #e5e7eb; border-radius: 12px; }
        .res-table { width: 100%; min-width: 0; table-layout: fixed; border-collapse: collapse; }
        .res-table th, .res-table td { padding: 0 12px; height: 48px; vertical-align: middle; border-bottom: 1px solid #f3f4f6; font-size: 13px; white-space: nowrap; }
        .res-table th { background: #f9fafb; font-weight: 600; color: #6B7280; text-align: left; }
        .res-table tbody tr:last-child td { border-bottom: none; }
        .res-table tbody tr:hover td { background: #f8faff; cursor: pointer; }
        .res-table .col-wrap { white-space: normal; word-break: break-all; }
        .stat-tab { height: 32px; padding: 0 12px; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer; border: 1px solid #e5e7eb; background: #fff; color: #374151; white-space: nowrap; }
        .stat-tab.active { background: #111827; color: #fff; border-color: #111827; }
        .field-label { font-size: 11px; color: #9CA3AF; margin-bottom: 3px; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 16px; }
        .modal-box { width: 100%; max-width: 580px; max-height: 90vh; background: #fff; border-radius: 16px; display: flex; flex-direction: column; box-shadow: 0 20px 60px rgba(0,0,0,0.15); overflow: hidden; }
        .modal-header { padding: 20px 24px 16px; border-bottom: 1px solid #f3f4f6; flex-shrink: 0; }
        .modal-body { flex: 1; overflow-y: auto; padding: 16px 24px; }
        .modal-footer { padding: 14px 24px; border-top: 1px solid #f3f4f6; flex-shrink: 0; display: flex; gap: 8px; justify-content: flex-end; }
        .summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px; }
        .summary-cell { background: #f9fafb; border-radius: 8px; padding: 10px 12px; }
        @media (max-width: 900px) {
          .res-table-wrap { background: none; border: none; border-radius: 0; }
          .res-table { display: none; }
          .res-cards { display: flex !important; }
          .filter-grid { grid-template-columns: 1fr 1fr !important; }
          .modal-box { max-height: 95vh; }
        }
        .res-cards { display: none; flex-direction: column; gap: 10px; }
        .res-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px 16px; cursor: pointer; }
      `}</style>

      {/* 상단 바 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: "#6B7280" }}>
          방문일 기준 · <strong style={{ color: "#111827" }}>{startDate || "전체"}{endDate ? ` ~ ${endDate}` : ""}</strong>
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
          <button key={label} className={`stat-tab${statusFilter === label ? " active" : ""}`} onClick={() => setStatusFilter(label)}>
            {label} <span style={{ marginLeft: 4, fontWeight: 700, color: statusFilter === label ? "#fff" : getStatusColor(label) }}>{count}</span>
          </button>
        ))}
      </div>

      {/* 필터 */}
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "14px 16px", marginBottom: 14 }}>
        <div className="filter-grid" style={{ display: "grid", gridTemplateColumns: "auto 1fr 1fr 2fr auto auto", gap: 8, alignItems: "end" }}>
          {isAdminOrOwner ? (
            <select className="input" style={{ height: 36, fontSize: 13, minWidth: 120 }} value={branch} onChange={(e) => setBranch(e.target.value)}>
              <option>전체</option>
              {branches.map((b) => <option key={b.option_id}>{b.option_name}</option>)}
            </select>
          ) : (
            <div style={{ fontSize: 13, color: "#374151", fontWeight: 500 }}>{user?.branch_name}</div>
          )}
          <div>
            <div className="field-label">방문 시작일</div>
            <input className="input" type="date" style={{ height: 36, fontSize: 13 }} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <div className="field-label">방문 종료일</div>
            <input className="input" type="date" style={{ height: 36, fontSize: 13 }} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <input className="input" style={{ height: 36, fontSize: 13, alignSelf: "end" }} placeholder="예약자명, 전화번호, 상품 검색" value={search} onChange={(e) => setSearch(e.target.value)} />
          <button className="btn" style={{ height: 36, fontSize: 13, whiteSpace: "nowrap" }} onClick={() => loadReservations(user)}>검색</button>
          <button className="btn secondary" style={{ height: 36, fontSize: 13, whiteSpace: "nowrap" }} onClick={() => { setBranch("전체"); setStartDate(today); setEndDate(addDays(today, 30)); setSearch(""); setStatusFilter("전체"); }}>초기화</button>
        </div>
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
                  <td style={{ color: r.phone ? "#6B7280" : "#ef4444" }}>{r.phone || "미입력"}</td>
                  <td className="col-wrap" style={{ color: "#374151" }}>{r.reservation_product || "-"}</td>
                  <td><span style={{ fontSize: 12, fontWeight: 600, color: getStatusColor(r.status) }}>● {r.status}</span></td>
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
                <div style={{ marginTop: 4, fontSize: 12, color: r.phone ? "#6B7280" : "#ef4444" }}>{r.phone || "미입력"}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 상세 모달 */}
      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            {/* 고정 헤더 */}
            <div className="modal-header">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "#111827" }}>{selected.customer_name || "-"}</div>
                  <div style={{ fontSize: 13, color: "#6B7280", marginTop: 4 }}>
                    {selected.branch_name} · {selected.reservation_product || "-"}
                    <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 600, color: getStatusColor(selected.status) }}>● {selected.status}</span>
                  </div>
                </div>
                <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", fontSize: 20, color: "#9CA3AF", cursor: "pointer", padding: "0 4px" }}>✕</button>
              </div>
            </div>

            {/* 스크롤 본문 */}
            <div className="modal-body">
              {/* 요약 */}
              <div className="summary-grid">
                {[
                  ["방문일", selected.reservation_date?.slice(0, 10) || "-"],
                  ["방문시간", selected.reservation_time || "-"],
                  ["메일수신일", selected.created_at?.slice(0, 10) || "-"],
                  ["예약번호", parsed?.reservationNo || "-"],
                ].map(([label, val]) => (
                  <div key={label} className="summary-cell">
                    <div className="field-label">{label}</div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: "#111827" }}>{val}</div>
                  </div>
                ))}
              </div>

              {/* 연락처 보완 */}
              <div style={{ marginBottom: 14 }}>
                <div className="field-label">전화번호</div>
                <div style={{ display: "flex", gap: 6 }}>
                  <input className="input" style={{ height: 36, fontSize: 13, flex: 1 }}
                    placeholder="010-0000-0000"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                  />
                  <button className="btn secondary" style={{ height: 36, fontSize: 13, whiteSpace: "nowrap" }} disabled={savingPhone} onClick={savePhone}>
                    {savingPhone ? "저장 중" : "저장"}
                  </button>
                </div>
                {!selected.phone && <div style={{ fontSize: 11, color: "#ef4444", marginTop: 3 }}>연락처 미입력 — 저장 후 반영됩니다</div>}
              </div>

              {/* 고객 요청사항 — 있을 때만 표시 */}
              {hasInquiry && (
                <div style={{ background: "#fefce8", border: "1px solid #fde68a", borderRadius: 8, padding: "10px 12px", marginBottom: 14, fontSize: 13, color: "#92400e" }}>
                  <div className="field-label" style={{ color: "#b45309" }}>고객 요청사항</div>
                  {parsed?.goal && parsed.goal !== "-" && <div style={{ marginBottom: 4 }}><strong>운동목적:</strong> {parsed.goal}</div>}
                  <div>{parsed?.inquiry}</div>
                </div>
              )}

              {/* 운영 메모 */}
              <div style={{ marginBottom: 14 }}>
                <div className="field-label">운영 메모 <span style={{ color: "#9CA3AF", fontWeight: 400 }}>(직원 작성용, 메일 원문과 별개)</span></div>
                <textarea className="input" value={editOpsMemo} onChange={(e) => setEditOpsMemo(e.target.value)} rows={3} style={{ fontSize: 13, resize: "vertical" }} placeholder="상담 내용, 특이사항 등" />
              </div>

              {/* 상태 변경 */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: "#6B7280", fontWeight: 600, marginBottom: 8 }}>
                  예약 상태
                  <span style={{ marginLeft: 8, fontSize: 11, color: "#9CA3AF", fontWeight: 400 }}>버튼 클릭 시 즉시 저장됩니다</span>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {statuses.map((s) => (
                    <button key={s}
                      onClick={async () => {
                        if (s === "예약확정") {
                          openSmsModal({ ...selected, phone: editPhone || selected.phone }, s);
                          return;
                        }
                        await updateStatus({ ...selected, phone: editPhone || selected.phone }, s, editOpsMemo, editPhone);
                      }}
                      style={{ height: 32, padding: "0 12px", borderRadius: 6, fontWeight: 600, cursor: "pointer", fontSize: 13, border: selected.status === s ? "none" : "1px solid #e5e7eb", background: selected.status === s ? getStatusColor(s) : "#fff", color: selected.status === s ? "#fff" : "#374151" }}
                    >{s}</button>
                  ))}
                </div>
              </div>

              {/* 메모 저장 버튼 */}
              <button className="btn secondary" style={{ width: "100%", height: 36, fontSize: 13, marginBottom: 14 }}
                onClick={async () => {
                  await updateStatus(selected, selected.status, editOpsMemo, editPhone);
                  alert("메모 저장 완료");
                }}>
                운영 메모 저장
              </button>

              {/* 메일 원문 접기 */}
              <details>
                <summary style={{ color: "#9CA3AF", cursor: "pointer", fontSize: 13, userSelect: "none" }}>원본 메일 보기</summary>
                <div style={{ background: "#f9fafb", borderRadius: 8, padding: 10, maxHeight: 200, overflow: "auto", whiteSpace: "pre-wrap", fontSize: 12, color: "#374151", marginTop: 8, lineHeight: 1.5 }}>
                  {parsed?.rawText || parsed?.mailPart || "내용 없음"}
                </div>
              </details>
            </div>

            {/* 고정 푸터 */}
            <div className="modal-footer">
              <button className="btn secondary" style={{ height: 36, fontSize: 13 }} onClick={() => setSelected(null)}>닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* 문자 발송 모달 — 닫기 / 문자없이확정 / 문자발송후확정 */}
      {smsModal && (
        <div className="modal-overlay" onClick={() => setSmsModal(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 540, background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>예약확정 문자 미리보기</div>
            <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 12 }}>
              {smsModal.reservation.customer_name} ·{" "}
              {smsModal.reservation.phone
                ? smsModal.reservation.phone
                : <span style={{ color: "#ef4444" }}>연락처 없음</span>}
            </div>
            <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 8 }}>
              ※ 발송 결과는 "업체 접수" 단계까지만 확인됩니다. 실제 고객 수신 여부는 별도 확인이 필요합니다.
            </div>
            <textarea className="input" value={smsModal.message} onChange={(e) => setSmsModal({ ...smsModal, message: e.target.value })} rows={12} style={{ fontSize: 13, resize: "vertical", marginBottom: 14 }} />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button className="btn secondary" style={{ height: 36, fontSize: 13 }} onClick={() => setSmsModal(null)}>닫기 (변경 없음)</button>
              <button className="btn secondary" style={{ height: 36, fontSize: 13 }} onClick={async () => {
                const ok = await updateStatus(smsModal.reservation, "예약확정", editOpsMemo, editPhone);
                if (ok) { alert("예약확정 완료 (문자 미발송)"); setSmsModal(null); }
              }}>문자 없이 확정</button>
              <button className="btn" style={{ height: 36, fontSize: 13 }} disabled={!smsModal.reservation.phone}
                title={!smsModal.reservation.phone ? "연락처를 먼저 입력해주세요" : ""}
                onClick={async () => {
                  const ok = await updateStatus(smsModal.reservation, "예약확정", editOpsMemo, editPhone);
                  if (!ok) return;
                  const smsRaw = await apiFetch("/api/naver-reservations/update", {
                    method: "POST",
                    body: JSON.stringify({ reservation_id: smsModal.reservation.reservation_id, status: "예약확정", memo: editOpsMemo ? `${editOpsMemo.trim()}\n---MAIL---\n${parseMemo(smsModal.reservation.memo||"").mailPart}` : smsModal.reservation.memo, phone: editPhone || undefined, sms_message: smsModal.message }),
                  });
                  const smsRes = await smsRaw.json();
                  if (smsRes.sms_sent) {
                    alert("예약확정 + 문자 발송 완료 (업체 접수)");
                  } else if (smsRes.sms_error) {
                    alert(`예약 확정 완료\n문자 발송 실패: ${smsRes.sms_error}\n→ 수동 발송이 필요합니다.`);
                  } else {
                    alert("예약확정 완료");
                  }
                  setSmsModal(null);
                }}>문자 발송 후 확정</button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
