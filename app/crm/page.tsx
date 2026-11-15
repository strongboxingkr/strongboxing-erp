"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import { apiFetch } from "@/lib/api";

const today = new Date().toISOString().slice(0, 10);

const makeDefaultForm = (branchName = "") => ({
  lead_id: null as any,
  branch_name: branchName,
  customer_name: "",
  phone: "",
  inquiry_type: "신규상담",
  inquiry_channel: "네이버예약",
  status: "신규문의",
  memo: "",
  next_contact_date: today,
  auto_create_member: false,
  go_payment_after_save: false,
});

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  "등록완료":    { bg: "#dcfce7", color: "#16a34a" },
  "재연락필요":  { bg: "#fee2e2", color: "#dc2626" },
  "방문예약":    { bg: "#dbeafe", color: "#1d4ed8" },
  "상담중":      { bg: "#fef3c7", color: "#d97706" },
  "신규문의":    { bg: "#f3f4f6", color: "#374151" },
  "보류":        { bg: "#f3f4f6", color: "#6b7280" },
  "노쇼":        { bg: "#fee2e2", color: "#dc2626" },
};

const statusStyle = (s: string) => STATUS_COLORS[s] || { bg: "#f3f4f6", color: "#6b7280" };

function CrmInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [rows, setRows] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [filterBranch, setFilterBranch] = useState("전체");
  const [filterStatus, setFilterStatus] = useState("전체");
  const [form, setForm] = useState(makeDefaultForm());
  const [isEdit, setIsEdit] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  const isAdminOrOwner = user?.role === "ADMIN" || user?.role === "OWNER";

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem("user") || "null");
    setUser(u);
    const defaultBranch = (!u || u.role === "ADMIN" || u.role === "OWNER") ? "" : (u.branch_name || "");
    setForm(makeDefaultForm(defaultBranch));

    apiFetch("/api/settings?option_type=BRANCH").then(r => r.json()).then(d => setBranches(d.rows || []));
    apiFetch("/api/settings?option_type=CRM_CHANNEL").then(r => r.json()).then(d => setChannels(d.rows || []));
    loadCrm(u);
  }, []);

  // URL 파라미터에서 예약 정보 pre-fill
  useEffect(() => {
    const name = searchParams.get("name");
    const phone = searchParams.get("phone");
    const branch = searchParams.get("branch");
    const channel = searchParams.get("channel");
    if (name || phone) {
      setForm(f => ({
        ...f,
        customer_name: name || f.customer_name,
        phone: phone || f.phone,
        branch_name: branch || f.branch_name,
        inquiry_channel: channel || f.inquiry_channel,
      }));
    }
  }, []);

  const loadCrm = async (currentUser = user) => {
    let url = "/api/crm";
    if (currentUser && currentUser.role !== "ADMIN" && currentUser.role !== "OWNER") {
      url += `?branch_name=${encodeURIComponent(currentUser.branch_name)}`;
    }
    const res = await apiFetch(url);
    const data = await res.json();
    setRows(data.rows || []);
  };

  const saveCrm = async () => {
    const url = isEdit ? "/api/crm/update" : "/api/crm/add";
    const targetForm = {
      ...form,
      branch_name: isAdminOrOwner ? form.branch_name : (user?.branch_name || form.branch_name),
    };
    if (!targetForm.branch_name) return alert("지점을 선택해주세요.");
    if (!targetForm.customer_name) return alert("이름을 입력해주세요.");

    const res = await apiFetch(url, { method: "POST", body: JSON.stringify(targetForm) });
    const data = await res.json();
    if (data.success) {
      const goPayment = form.go_payment_after_save;
      setForm(makeDefaultForm(isAdminOrOwner ? (branches[0]?.option_name || "") : (user?.branch_name || "")));
      setIsEdit(false);
      loadCrm(user);
      if (goPayment) router.push("/payments");
    } else {
      alert(data.message || "저장 실패");
    }
  };

  const editCrm = (r: any) => {
    setIsEdit(true);
    setForm({
      lead_id: r.lead_id,
      branch_name: r.branch_name || "",
      customer_name: r.customer_name || "",
      phone: r.phone || "",
      inquiry_type: r.inquiry_type || "신규상담",
      inquiry_channel: r.inquiry_channel || "네이버예약",
      status: r.status || "신규문의",
      memo: r.memo || "",
      next_contact_date: r.next_contact_date?.slice(0, 10) || today,
      auto_create_member: false,
      go_payment_after_save: false,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goMakeReservation = (r: any) => {
    const params = new URLSearchParams({
      name: r.customer_name || "",
      phone: r.phone || "",
      branch: r.branch_name || "",
      channel: r.inquiry_channel || "",
    });
    router.push(`/calendar?${params}`);
  };

  const filtered = rows.filter(r => {
    const matchSearch = !search.trim() || r.customer_name?.includes(search) || r.phone?.includes(search) || r.memo?.includes(search);
    const matchBranch = filterBranch === "전체" || r.branch_name === filterBranch;
    const matchStatus = filterStatus === "전체" || r.status === filterStatus;
    return matchSearch && matchBranch && matchStatus;
  });

  const allStatuses = Array.from(new Set(rows.map(r => r.status).filter(Boolean)));

  return (
    <AppShell title="상담 관리">
      <style>{`
        .crm-form-wrap { background:#fff; border:1px solid #e2e5eb; border-radius:10px; padding:18px 20px; margin-bottom:14px; }
        .crm-form-title { font-size:14px; font-weight:700; color:#111827; margin-bottom:14px; }
        .crm-grid { display:grid; gap:10px; }
        .crm-row2 { grid-template-columns:1fr 1fr; }
        .crm-row3 { grid-template-columns:1fr 1fr 1fr; }
        .crm-row4 { grid-template-columns:1fr 1fr 1fr 1fr; }
        @media(max-width:720px){ .crm-row2,.crm-row3,.crm-row4 { grid-template-columns:1fr 1fr; } }
        @media(max-width:480px){ .crm-row2,.crm-row3,.crm-row4 { grid-template-columns:1fr; } }
        .crm-field { display:flex; flex-direction:column; gap:3px; }
        .crm-label { font-size:11px; font-weight:600; color:#6b7280; }
        .crm-toolbar { display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-bottom:10px; }
        .crm-search { height:36px; padding:0 10px; border:1px solid #e2e5eb; border-radius:7px; font-size:13px; width:200px; outline:none; }
        .crm-search:focus { border-color:#1d4ed8; }
        .crm-wrap { background:#fff; border:1px solid #e2e5eb; border-radius:10px; overflow:hidden; }
        .crm-table { width:100%; border-collapse:collapse; font-size:14px; }
        .crm-table th { text-align:left; padding:9px 14px; font-size:11px; font-weight:700; color:#9ca3af; border-bottom:1px solid #e2e5eb; white-space:nowrap; background:#f9fafb; }
        .crm-table td { padding:10px 14px; border-bottom:1px solid #f1f3f5; vertical-align:middle; }
        .crm-table tr:last-child td { border-bottom:none; }
        .crm-table tr:hover td { background:#f8faff; cursor:pointer; }
        .crm-badge { display:inline-block; padding:2px 9px; border-radius:999px; font-size:11px; font-weight:700; white-space:nowrap; }
        .crm-name { font-weight:700; color:#0f2044; font-size:14px; }
        .crm-memo-row td { background:#f9fafb; padding:10px 14px 12px; color:#374151; font-size:13px; white-space:pre-wrap; border-bottom:1px solid #f1f3f5; }
        .crm-row-btn { height:28px; padding:0 10px; font-size:12px; border:1px solid #e2e5eb; border-radius:5px; background:#fff; color:#374151; cursor:pointer; white-space:nowrap; }
        .crm-row-btn:hover { background:#f4f5f7; }
        .crm-row-btn.primary { border-color:#1d4ed8; color:#1d4ed8; }
        @media(max-width:720px){
          .crm-table thead { display:none; }
          .crm-table, .crm-table tbody, .crm-table tr, .crm-table td { display:block; }
          .crm-table tr { padding:10px 14px; border-bottom:1px solid #f1f3f5; }
          .crm-table td { padding:2px 0; border:none; }
          .crm-table td[data-m-hide] { display:none; }
        }
      `}</style>

      {/* 등록/수정 폼 */}
      <div className="crm-form-wrap">
        <div className="crm-form-title">{isEdit ? "상담 수정" : "상담 등록"}</div>

        {/* 행1: 지점 · 이름 · 전화 · 유입경로 */}
        <div className={`crm-grid crm-row4`} style={{ marginBottom: 10 }}>
          <div className="crm-field">
            <label className="crm-label">지점 *</label>
            {isAdminOrOwner ? (
              <select className="input" style={{ height: 36 }} value={form.branch_name}
                onChange={e => setForm({ ...form, branch_name: e.target.value })}>
                <option value="">지점 선택</option>
                {branches.map(b => <option key={b.option_id} value={b.option_name}>{b.option_name}</option>)}
              </select>
            ) : (
              <div className="input" style={{ height: 36, lineHeight: "36px", color: "#374151", background: "#f9fafb" }}>{user?.branch_name}</div>
            )}
          </div>
          <div className="crm-field">
            <label className="crm-label">이름 *</label>
            <input className="input" style={{ height: 36 }} placeholder="고객명" value={form.customer_name}
              onChange={e => setForm({ ...form, customer_name: e.target.value })} />
          </div>
          <div className="crm-field">
            <label className="crm-label">전화번호</label>
            <input className="input" style={{ height: 36 }} placeholder="010-0000-0000" value={form.phone}
              onChange={e => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="crm-field">
            <label className="crm-label">유입경로</label>
            <select className="input" style={{ height: 36 }} value={form.inquiry_channel}
              onChange={e => setForm({ ...form, inquiry_channel: e.target.value })}>
              <option>네이버예약</option>
              {channels.map(c => <option key={c.option_id} value={c.option_name}>{c.option_name}</option>)}
            </select>
          </div>
        </div>

        {/* 행2: 문의 유형 · 상태 · 다음 연락일 */}
        <div className={`crm-grid crm-row3`} style={{ marginBottom: 10 }}>
          <div className="crm-field">
            <label className="crm-label">문의 유형</label>
            <select className="input" style={{ height: 36 }} value={form.inquiry_type}
              onChange={e => setForm({ ...form, inquiry_type: e.target.value })}>
              {["신규상담","재등록문의","가격문의","체험문의","기타"].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="crm-field">
            <label className="crm-label">상태</label>
            <select className="input" style={{ height: 36 }} value={form.status}
              onChange={e => setForm({ ...form, status: e.target.value })}>
              {["신규문의","상담중","방문예약","등록완료","재연락필요","보류","노쇼"].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="crm-field">
            <label className="crm-label">다음 연락일</label>
            <input className="input" type="date" style={{ height: 36 }} value={form.next_contact_date}
              onChange={e => setForm({ ...form, next_contact_date: e.target.value })} />
          </div>
        </div>

        {/* 상담 메모 */}
        <div className="crm-field" style={{ marginBottom: 10 }}>
          <label className="crm-label">상담 메모 (상담 결과·다음 행동)</label>
          <textarea className="input" style={{ minHeight: 72, resize: "vertical", fontSize: 13 }}
            placeholder="문의 내용, 상담 결과, 다음 행동 계획을 기록하세요."
            value={form.memo} onChange={e => setForm({ ...form, memo: e.target.value })} />
        </div>

        {/* 체크박스 + 버튼 */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <label style={{ fontSize: 13, color: "#374151", display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
              <input type="checkbox" checked={form.auto_create_member}
                onChange={e => setForm({ ...form, auto_create_member: e.target.checked })} />
              등록완료 시 회원 자동 생성
            </label>
            <label style={{ fontSize: 13, color: "#374151", display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
              <input type="checkbox" checked={form.go_payment_after_save}
                onChange={e => setForm({ ...form, go_payment_after_save: e.target.checked })} />
              저장 후 결제관리 이동
            </label>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {isEdit && <button className="btn secondary" style={{ height: 36, fontSize: 13 }} onClick={() => { setIsEdit(false); setForm(makeDefaultForm(isAdminOrOwner ? "" : (user?.branch_name || ""))); }}>취소</button>}
            <button className="btn" style={{ height: 36, minWidth: 90 }} onClick={saveCrm}>{isEdit ? "수정 저장" : "등록"}</button>
          </div>
        </div>
      </div>

      {/* 목록 필터 */}
      <div className="crm-toolbar">
        {isAdminOrOwner && (
          <select className="input" style={{ height: 36, fontSize: 13, width: 120 }} value={filterBranch}
            onChange={e => setFilterBranch(e.target.value)}>
            <option>전체</option>
            {branches.map(b => <option key={b.option_id}>{b.option_name}</option>)}
          </select>
        )}
        <select className="input" style={{ height: 36, fontSize: 13, width: 130 }} value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}>
          <option>전체</option>
          {allStatuses.map(s => <option key={s}>{s}</option>)}
        </select>
        <input className="crm-search" placeholder="이름·전화·메모" value={search}
          onChange={e => setSearch(e.target.value)} />
        <button className="btn secondary" style={{ height: 36, fontSize: 13 }} onClick={() => loadCrm(user)}>새로고침</button>
        <span style={{ marginLeft: "auto", fontSize: 13, color: "#6b7280" }}>총 {filtered.length}건</span>
      </div>

      {/* 목록 테이블 */}
      <div className="crm-wrap">
        {filtered.length === 0 ? (
          <div style={{ padding: "36px 24px", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>상담 내역이 없습니다.</div>
        ) : (
          <table className="crm-table">
            <thead>
              <tr>
                <th>이름</th>
                <th>지점</th>
                <th>유입경로</th>
                <th>문의 유형</th>
                <th>상태</th>
                <th>다음 연락일</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const { bg, color } = statusStyle(r.status);
                const isExpanded = expanded === r.lead_id;
                return (
                  <>
                    <tr key={r.lead_id} onClick={() => setExpanded(isExpanded ? null : r.lead_id)}>
                      <td><span className="crm-name">{r.customer_name}</span><br /><span style={{ fontSize: 12, color: "#6b7280" }}>{r.phone}</span></td>
                      <td data-m-hide="">{r.branch_name}</td>
                      <td data-m-hide="">{r.inquiry_channel}</td>
                      <td data-m-hide="">{r.inquiry_type}</td>
                      <td><span className="crm-badge" style={{ background: bg, color }}>{r.status}</span></td>
                      <td data-m-hide="" style={{ color: "#374151", fontWeight: 600 }}>{r.next_contact_date?.slice(0, 10)}</td>
                      <td onClick={e => e.stopPropagation()}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button className="crm-row-btn" onClick={() => editCrm(r)}>수정</button>
                          <button className="crm-row-btn primary" onClick={() => goMakeReservation(r)}>방문 예약</button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && r.memo && (
                      <tr key={`memo-${r.lead_id}`} className="crm-memo-row">
                        <td colSpan={7}>{r.memo}</td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </AppShell>
  );
}

export default function CrmPage() {
  return (
    <Suspense>
      <CrmInner />
    </Suspense>
  );
}
