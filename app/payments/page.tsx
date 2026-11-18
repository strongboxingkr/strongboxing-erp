"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { apiFetch } from "@/lib/api";

const today = new Date().toISOString().slice(0, 10);

const money = (v: any) => `${Number(v || 0).toLocaleString()}원`;

const METHOD_LABEL: Record<string, string> = { CASH: "현금", CARD: "카드", TRANSFER: "계좌이체" };

export default function PaymentsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [extraProducts, setExtraProducts] = useState<any[]>([]);
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);
  const [reviewModal, setReviewModal] = useState(false);
  const [reviewForm, setReviewForm] = useState({ member_id: "", member_name: "", payment_method: "CARD", payment_date: today, memo: "" });
  const [reviewMemberSearch, setReviewMemberSearch] = useState("");
  const [user, setUser] = useState<any>(null);
  const [editTarget, setEditTarget] = useState<any>(null);
  const [editForm, setEditForm] = useState({ product_name: "", final_amount: "", payment_method: "CARD", payment_date: today, memo: "" });
  const [guestModal, setGuestModal] = useState(false);
  const [guestForm, setGuestForm] = useState({ branch_name: "", product_name: "", final_amount: "30000", payment_method: "CARD", payment_date: today, memo: "", use_date: today, guest_name: "", guest_phone: "" });
  const [submitting, setSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [guestIdempotencyKey, setGuestIdempotencyKey] = useState(() => crypto.randomUUID());
  const GUEST_PENDING_SK = "sbxg_guest_pending";
  const [guestPending, setGuestPendingRaw] = useState<{ key: string; product_name: string; final_amount: string; branch_name: string } | null>(() => {
    try { const s = sessionStorage.getItem("sbxg_guest_pending"); return s ? JSON.parse(s) : null; } catch { return null; }
  });
  const setGuestPending = (val: { key: string; product_name: string; final_amount: string; branch_name: string } | null) => {
    setGuestPendingRaw(val);
    try { if (val) sessionStorage.setItem(GUEST_PENDING_SK, JSON.stringify(val)); else sessionStorage.removeItem(GUEST_PENDING_SK); } catch {}
  };

  const [branch, setBranch] = useState("전체");
  const [memberSearch, setMemberSearch] = useState("");

  // 필터
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [filterSearch, setFilterSearch] = useState("");
  const [filterMethod, setFilterMethod] = useState("");

  // 반응형
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const [form, setForm] = useState({
    member_id: "",
    branch_name: "",
    product_name: "",
    amount: "",
    payment_method: "CARD",
    payment_date: today,
    memo: "",
    use_date: today,
  });

  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) setUser(JSON.parse(savedUser));
  }, []);

  const isAdminOrOwner = user?.role === "ADMIN" || user?.role === "OWNER";
  const canEditPayment = ["ADMIN", "OWNER", "DIRECTOR"].includes(user?.role);

  const loadBranches = async () => {
    const res = await apiFetch("/api/settings?option_type=BRANCH");
    const data = await res.json();
    setBranches(data.rows || []);
  };

  const loadProducts = async () => {
    const res = await apiFetch("/api/settings?option_type=PASS_PRODUCT");
    const data = await res.json();
    setProducts(data.rows || []);
  };

  const loadExtraProducts = async () => {
    const res = await apiFetch("/api/settings?option_type=EXTRA_PRODUCT");
    const data = await res.json();
    setExtraProducts(data.rows || []);
  };

  const loadMembers = async () => {
    const res = await apiFetch("/api/members");
    const data = await res.json();
    setMembers(data.rows || []);
  };

  const loadPayments = async () => {
    let url = "/api/payments";
    const params: string[] = [];

    if (!isAdminOrOwner) {
      params.push(`branch_name=${encodeURIComponent(user?.branch_name || "")}`);
    } else if (branch !== "전체") {
      params.push(`branch_name=${encodeURIComponent(branch)}`);
    }

    if (params.length) url += "?" + params.join("&");

    const res = await apiFetch(url);
    const data = await res.json();
    setRows(data.rows || []);
  };

  useEffect(() => {
    loadBranches();
    loadMembers();
    loadProducts();
    loadExtraProducts();
  }, []);

  useEffect(() => {
    if (user) loadPayments();
  }, [branch, user]);

  const filteredMembers = useMemo(() => {
    if (!memberSearch) return members.slice(0, 15);
    return members
      .filter((m) => m.name?.includes(memberSearch) || m.phone?.includes(memberSearch))
      .slice(0, 15);
  }, [members, memberSearch]);

  const selectedMember = members.find((m) => String(m.member_id) === String(form.member_id));
  const selectedProduct = products.find((p: any) => p.option_name === form.product_name);
  const isDailyProduct = selectedProduct?.option_value === "DAILY";
  const guestSelectedProduct = products.find((p: any) => p.option_name === guestForm.product_name);
  const guestIsDailyProduct = guestSelectedProduct?.option_value === "DAILY";

  const extraAmount = extraProducts
    .filter((p) => selectedExtras.includes(p.option_name))
    .reduce((sum, p) => sum + Number(p.option_value || 0), 0);
  const finalAmount = Number(form.amount || 0) + extraAmount;

  const toggleExtra = (name: string) => {
    setSelectedExtras((prev) => prev.includes(name) ? prev.filter((v) => v !== name) : [...prev, name]);
  };

  const savePayment = async () => {
    if (!form.member_id) { alert("회원을 선택해주세요."); return; }
    if (finalAmount <= 0) { alert("결제금액을 확인해주세요."); return; }
    if (submitting) return;
    setSubmitting(true);
    try {
      const autoMemo = [form.memo, selectedExtras.length > 0 ? `추가상품: ${selectedExtras.join(", ")}` : ""].filter(Boolean).join("\n");
      const res = await apiFetch("/api/payments/add", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          branch_name: selectedMember?.branch_name || form.branch_name,
          member_id: Number(form.member_id),
          amount: finalAmount,
          memo: autoMemo,
          idempotency_key: idempotencyKey,
          payment_purpose: isDailyProduct ? "PASS" : (products.some((p: any) => p.option_name === form.product_name) ? "PASS" : "GENERAL"),
          ...(isDailyProduct ? { use_date: form.use_date } : {}),
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert("결제 등록 완료!");
        setIdempotencyKey(crypto.randomUUID());
        setForm({ member_id: "", branch_name: "", product_name: "", amount: "", payment_method: "CARD", payment_date: today, memo: "", use_date: today });
        setSelectedExtras([]);
        setMemberSearch("");
        loadPayments();
      } else {
        alert(data.message || "결제 등록 실패");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (r: any) => {
    setEditTarget(r);
    setEditForm({
      product_name: r.product_name || "",
      final_amount: String(r.amount || r.final_amount || ""),
      payment_method: r.payment_method || "CARD",
      payment_date: r.payment_date?.slice(0, 10) || today,
      memo: r.memo || "",
    });
  };

  const saveEdit = async () => {
    if (!editTarget) return;
    const res = await apiFetch("/api/payments", {
      method: "PUT",
      body: JSON.stringify({ payment_id: editTarget.payment_id, ...editForm, final_amount: Number(editForm.final_amount) }),
    });
    const data = await res.json();
    if (data.success) {
      alert("수정 완료!");
      setEditTarget(null);
      loadPayments();
    } else {
      alert(data.message || "수정 실패");
    }
  };

  const todaySales = rows
    .filter((r) => r.payment_date?.slice(0, 10) === today)
    .reduce((sum, r) => sum + Number(r.amount || 0), 0);

  // 클라이언트 필터링 (오늘 매출 집계는 rows 전체 기준 유지)
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const dateStr = r.payment_date?.slice(0, 10) ?? "";
      if (filterStartDate && dateStr < filterStartDate) return false;
      if (filterEndDate && dateStr > filterEndDate) return false;
      if (filterMethod && r.payment_method !== filterMethod) return false;
      if (filterSearch) {
        const s = filterSearch.toLowerCase();
        const name = (r.name || "").toLowerCase();
        const phone = r.phone || r.guest_phone || "";
        const memo = (r.memo || "").toLowerCase();
        if (!name.includes(s) && !phone.includes(filterSearch) && !memo.includes(s)) return false;
      }
      return true;
    });
  }, [rows, filterStartDate, filterEndDate, filterMethod, filterSearch]);

  const hasFilter = filterStartDate || filterEndDate || filterMethod || filterSearch;

  const showBranchCol = isAdminOrOwner && branch === "전체";

  return (
    <AppShell title="결제관리">
      {/* 상단 액션 바 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: "#6B7280" }}>회원권 + 추가상품 결제 등록</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {isAdminOrOwner && (
            <select
              className="input"
              style={{ width: 140, height: 38, padding: "0 10px", fontSize: 13 }}
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
            >
              <option>전체</option>
              {branches.map((b) => <option key={b.option_id}>{b.option_name}</option>)}
            </select>
          )}
          <button onClick={loadPayments} style={btnStyle}>새로고침</button>
          <button
            onClick={() => {
              const initForm = { branch_name: branches[0]?.option_name || "", product_name: "일일권", final_amount: "30000", payment_method: "CARD", payment_date: today, memo: "", use_date: today, guest_name: "", guest_phone: "" };
              if (guestPending) {
                setGuestForm({ ...initForm, branch_name: guestPending.branch_name, product_name: guestPending.product_name, final_amount: guestPending.final_amount });
                setGuestIdempotencyKey(guestPending.key);
              } else {
                setGuestForm(initForm);
                setGuestIdempotencyKey(crypto.randomUUID());
              }
              setGuestModal(true);
            }}
            style={{ ...btnStyle, background: guestPending ? "#D97706" : "#2563eb", color: "#fff", border: "none", fontWeight: 700 }}
          >{guestPending ? "⚠ 비회원 결제" : "비회원 결제"}</button>
          <button
            onClick={() => { setReviewForm({ member_id: "", member_name: "", payment_method: "CARD", payment_date: today, memo: "" }); setReviewMemberSearch(""); setReviewModal(true); }}
            style={btnStyle}
          >리뷰환급</button>
        </div>
      </div>

      {/* 오늘 매출 슬림 바 */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, background: "#fff", border: "1px solid #E5E7EB", borderRadius: 9, padding: "12px 18px", marginBottom: 14 }}>
        <span style={{ fontSize: 13, color: "#6B7280", whiteSpace: "nowrap" }}>오늘 매출</span>
        <span style={{ fontSize: 22, fontWeight: 700, color: "#111827", letterSpacing: "-0.5px" }}>{money(todaySales)}</span>
        <span style={{ fontSize: 12, color: "#9CA3AF", marginLeft: "auto", whiteSpace: "nowrap" }}>오늘({today}) 기준</span>
      </div>

      {/* 필터 영역 */}
      <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 9, padding: "12px 16px", marginBottom: 14, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <input
          className="input"
          type="date"
          value={filterStartDate}
          onChange={(e) => setFilterStartDate(e.target.value)}
          style={{ height: 36, fontSize: 13, width: 148 }}
        />
        <span style={{ color: "#9CA3AF", fontSize: 13 }}>~</span>
        <input
          className="input"
          type="date"
          value={filterEndDate}
          onChange={(e) => setFilterEndDate(e.target.value)}
          style={{ height: 36, fontSize: 13, width: 148 }}
        />
        <input
          className="input"
          placeholder="이름·전화번호 검색"
          value={filterSearch}
          onChange={(e) => setFilterSearch(e.target.value)}
          style={{ height: 36, fontSize: 13, width: 170 }}
        />
        <select
          className="input"
          value={filterMethod}
          onChange={(e) => setFilterMethod(e.target.value)}
          style={{ height: 36, fontSize: 13, width: 110 }}
        >
          <option value="">전체 수단</option>
          <option value="CARD">카드</option>
          <option value="CASH">현금</option>
          <option value="TRANSFER">계좌이체</option>
        </select>
        {hasFilter && (
          <button
            onClick={() => { setFilterStartDate(""); setFilterEndDate(""); setFilterSearch(""); setFilterMethod(""); }}
            style={{ ...btnStyle, color: "#6B7280", fontSize: 12 }}
          >초기화</button>
        )}
        <span style={{ marginLeft: "auto", fontSize: 13, color: "#6B7280", whiteSpace: "nowrap" }}>
          {hasFilter ? `${filteredRows.length}건 / 전체 ${rows.length}건` : `전체 ${rows.length}건`}
        </span>
      </div>

      {/* 결제 목록 */}
      <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 9, overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 18px", borderBottom: "1px solid #E5E7EB" }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: "#111827" }}>
            결제 목록
            {hasFilter && <span style={{ fontSize: 13, fontWeight: 400, color: "#6B7280", marginLeft: 8 }}>필터 적용 중</span>}
          </span>
          {isAdminOrOwner && (
            <button
              onClick={() => { window.location.href = "/api/export/payments"; }}
              style={btnStyle}
            >CSV 내보내기</button>
          )}
        </div>

        {/* PC 테이블 */}
        {!isMobile && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ background: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
                  <th style={thStyle}>결제일</th>
                  <th style={thStyle}>이름</th>
                  {showBranchCol && <th style={thStyle}>지점</th>}
                  <th style={{ ...thStyle, minWidth: 180 }}>상품·결제 내용</th>
                  <th style={thStyle}>결제수단</th>
                  <th style={{ ...thStyle, textAlign: "right", paddingRight: 20 }}>결제금액</th>
                  {canEditPayment && <th style={{ ...thStyle, width: 110 }}>관리</th>}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r) => (
                  <tr key={r.payment_id} style={{ borderBottom: "1px solid #F3F4F6" }}>
                    <td style={tdStyle}>{r.payment_date?.slice(0, 10)}</td>
                    <td style={{ ...tdStyle, fontWeight: 600, color: "#111827", whiteSpace: "nowrap" }}>{r.name || "비회원"}</td>
                    {showBranchCol && <td style={{ ...tdStyle, color: "#6B7280", whiteSpace: "nowrap" }}>{r.branch_name}</td>}
                    <td style={tdStyle}>
                      <div style={{ color: "#111827" }}>{r.product_name}</div>
                      {r.memo && <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2, wordBreak: "break-all" }}>{r.memo}</div>}
                    </td>
                    <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>{METHOD_LABEL[r.payment_method] || r.payment_method}</td>
                    <td style={{ ...tdStyle, textAlign: "right", paddingRight: 20, fontWeight: 600, color: "#111827", whiteSpace: "nowrap" }}>{money(r.amount)}</td>
                    {canEditPayment && (
                      <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                        <button onClick={() => openEdit(r)} style={{ ...btnSmStyle, marginRight: 4 }}>수정</button>
                        <button
                          onClick={async () => {
                            if (!confirm(`${r.name || "비회원"} - ${r.product_name} (${money(r.amount)}) 결제를 삭제하시겠습니까?`)) return;
                            const res = await apiFetch(`/api/payments/delete?payment_id=${r.payment_id}`, { method: "DELETE" });
                            const json = await res.json();
                            if (json.success) { alert("삭제 완료"); loadPayments(); }
                            else alert(json.message || "삭제 실패");
                          }}
                          style={{ ...btnSmStyle, color: "#ef4444", border: "1px solid #FCA5A5" }}
                        >삭제</button>
                      </td>
                    )}
                  </tr>
                ))}
                {filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={showBranchCol ? (canEditPayment ? 7 : 6) : (canEditPayment ? 6 : 5)} style={{ padding: "32px 16px", textAlign: "center", color: "#9CA3AF", fontSize: 14 }}>
                      {hasFilter ? "필터 조건에 맞는 결제 내역이 없습니다." : "결제 내역이 없습니다."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 모바일 카드 */}
        {isMobile && (
          <div style={{ padding: "4px 0" }}>
            {filteredRows.map((r) => (
              <div key={r.payment_id} style={{ padding: "12px 16px", borderBottom: "1px solid #F3F4F6" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: "#111827" }}>{r.name || "비회원"}</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#111827", whiteSpace: "nowrap", marginLeft: 8 }}>{money(r.amount)}</span>
                </div>
                <div style={{ fontSize: 13, color: "#374151", marginBottom: 2 }}>{r.product_name}</div>
                {r.memo && <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 4 }}>{r.memo}</div>}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                  <span style={{ fontSize: 12, color: "#6B7280" }}>
                    {r.payment_date?.slice(0, 10)} · {METHOD_LABEL[r.payment_method] || r.payment_method}
                    {showBranchCol && ` · ${r.branch_name}`}
                  </span>
                  {canEditPayment && (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => openEdit(r)} style={{ ...btnSmStyle, fontSize: 12, height: 30 }}>수정</button>
                      <button
                        onClick={async () => {
                          if (!confirm(`${r.name || "비회원"} - ${r.product_name} (${money(r.amount)}) 결제를 삭제하시겠습니까?`)) return;
                          const res = await apiFetch(`/api/payments/delete?payment_id=${r.payment_id}`, { method: "DELETE" });
                          const json = await res.json();
                          if (json.success) { alert("삭제 완료"); loadPayments(); }
                          else alert(json.message || "삭제 실패");
                        }}
                        style={{ ...btnSmStyle, fontSize: 12, height: 30, color: "#ef4444", border: "1px solid #FCA5A5" }}
                      >삭제</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {filteredRows.length === 0 && (
              <div style={{ padding: "32px 16px", textAlign: "center", color: "#9CA3AF", fontSize: 14 }}>
                {hasFilter ? "필터 조건에 맞는 결제 내역이 없습니다." : "결제 내역이 없습니다."}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 리뷰환급 모달 */}
      {reviewModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="card" style={{ width: 420, maxWidth: "95vw", borderRadius: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ margin: 0 }}>리뷰환급 <span style={{ fontSize: 15, color: "#ff4d6d", fontWeight: 700 }}>-20,000원</span></h2>
              <button onClick={() => setReviewModal(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "var(--muted)" }}>✕</button>
            </div>
            <div style={{ display: "grid", gap: 12 }}>
              <input className="input" placeholder="회원 이름 또는 전화번호 검색" value={reviewMemberSearch} onChange={e => setReviewMemberSearch(e.target.value)} />
              {reviewMemberSearch.length >= 1 && (
                <div style={{ maxHeight: 180, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 10 }}>
                  {members.filter(m => m.name?.includes(reviewMemberSearch) || m.phone?.includes(reviewMemberSearch)).slice(0, 10).map(m => (
                    <div key={m.member_id} onClick={() => { setReviewForm({ ...reviewForm, member_id: String(m.member_id), member_name: m.name }); setReviewMemberSearch(m.name); }} style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid var(--border)", background: reviewForm.member_id === String(m.member_id) ? "rgba(255,77,109,0.1)" : undefined }}>
                      <span style={{ fontWeight: 700 }}>{m.name}</span>
                      <span style={{ color: "var(--muted)", fontSize: 13, marginLeft: 8 }}>{m.phone}</span>
                    </div>
                  ))}
                </div>
              )}
              {reviewForm.member_name && <div style={{ padding: "8px 12px", background: "rgba(255,77,109,0.1)", borderRadius: 8, fontWeight: 700, color: "#ff4d6d" }}>선택됨: {reviewForm.member_name}</div>}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {(["CARD", "CASH", "TRANSFER"] as const).map(m => (
                  <button key={m} className={reviewForm.payment_method === m ? "btn" : "btn secondary"} onClick={() => setReviewForm({ ...reviewForm, payment_method: m })}>{METHOD_LABEL[m]}</button>
                ))}
              </div>
              <input className="input" type="date" value={reviewForm.payment_date} onChange={e => setReviewForm({ ...reviewForm, payment_date: e.target.value })} />
              <textarea className="input" placeholder="메모 (선택)" value={reviewForm.memo} onChange={e => setReviewForm({ ...reviewForm, memo: e.target.value })} style={{ minHeight: 60 }} />
              <button className="btn" style={{ fontSize: 16, background: "#ff4d6d" }} onClick={async () => {
                if (!reviewForm.member_id) return alert("회원을 선택해주세요.");
                const selectedM = members.find(m => String(m.member_id) === reviewForm.member_id);
                const res = await apiFetch("/api/payments/add-guest", {
                  method: "POST",
                  body: JSON.stringify({
                    branch_name: selectedM?.branch_name || "",
                    product_name: "리뷰환급",
                    final_amount: -20000,
                    payment_method: reviewForm.payment_method,
                    payment_date: reviewForm.payment_date,
                    memo: reviewForm.memo || `리뷰환급 - ${reviewForm.member_name}`,
                  }),
                });
                const json = await res.json();
                if (json.success) { alert("리뷰환급 등록 완료!"); setReviewModal(false); loadPayments(); }
                else alert(json.message || "등록 실패");
              }}>환급 등록</button>
            </div>
          </div>
        </div>
      )}

      {/* 비회원 결제 모달 */}
      {guestModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="card" style={{ width: 420, maxWidth: "95vw", borderRadius: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ margin: 0 }}>비회원 결제</h2>
              <button onClick={() => setGuestModal(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "var(--muted)" }}>✕</button>
            </div>
            <div style={{ display: "grid", gap: 12 }}>
              {guestPending && (
                <div style={{ background: "#FEF3C7", border: "1px solid #F59E0B", borderRadius: 8, padding: "10px 14px" }}>
                  <div style={{ fontWeight: 700, color: "#92400E", marginBottom: 4 }}>⚠ 이전 요청 결과가 불명확합니다</div>
                  <div style={{ fontSize: 13, color: "#78350F", marginBottom: 10 }}>처리 여부를 확인할 수 없습니다. 결제 내역에서 직접 확인하거나 같은 내용으로 재시도하세요. 상품·금액 변경은 먼저 &ldquo;새 결제&rdquo;를 눌러주세요.</div>
                  <button className="btn secondary" style={{ fontSize: 13, width: "100%" }} onClick={() => { setGuestPending(null); setGuestIdempotencyKey(crypto.randomUUID()); }}>새 결제로 시작 (이전 요청 포기)</button>
                </div>
              )}
              {isAdminOrOwner && (
                <select className="input" value={guestForm.branch_name} onChange={e => setGuestForm({ ...guestForm, branch_name: e.target.value })} disabled={!!guestPending}>
                  <option value="">지점 선택</option>
                  {branches.map(b => <option key={b.option_id}>{b.option_name}</option>)}
                </select>
              )}
              <select className="input" value={guestForm.product_name} onChange={e => {
                if (guestPending) return;
                const p = products.find((p: any) => p.option_name === e.target.value);
                setGuestForm({ ...guestForm, product_name: e.target.value, final_amount: p?.amount ? String(p.amount) : guestForm.final_amount });
                setGuestIdempotencyKey(crypto.randomUUID());
              }} disabled={!!guestPending}>
                <option value="">상품 선택</option>
                {products.map((p: any) => <option key={p.option_id} value={p.option_name}>{p.option_name}</option>)}
              </select>
              <input className="input" type="number" placeholder="결제금액" value={guestForm.final_amount} onChange={e => { if (guestPending) return; setGuestForm({ ...guestForm, final_amount: e.target.value }); setGuestIdempotencyKey(crypto.randomUUID()); }} disabled={!!guestPending} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {(["CARD", "CASH", "TRANSFER"] as const).map(m => (
                  <button key={m} className={guestForm.payment_method === m ? "btn" : "btn secondary"} onClick={() => setGuestForm({ ...guestForm, payment_method: m })}>{METHOD_LABEL[m]}</button>
                ))}
              </div>
              {guestIsDailyProduct && (
                <>
                  <input className="input" placeholder="이름 (선택)" value={guestForm.guest_name} onChange={e => setGuestForm({ ...guestForm, guest_name: e.target.value })} />
                  <input className="input" placeholder="연락처 (선택)" value={guestForm.guest_phone} onChange={e => setGuestForm({ ...guestForm, guest_phone: e.target.value })} />
                  <div>
                    <label style={{ fontSize: 13, color: "#6B7280", marginBottom: 4, display: "block" }}>이용일</label>
                    <input className="input" type="date" value={guestForm.use_date} onChange={e => setGuestForm({ ...guestForm, use_date: e.target.value })} />
                  </div>
                </>
              )}
              <input className="input" type="date" value={guestForm.payment_date} onChange={e => setGuestForm({ ...guestForm, payment_date: e.target.value })} />
              <textarea className="input" placeholder="메모 (선택)" value={guestForm.memo} onChange={e => setGuestForm({ ...guestForm, memo: e.target.value })} style={{ minHeight: 60 }} />
              <button className="btn" style={{ fontSize: 16 }} disabled={submitting} onClick={async () => {
                const branchToUse = isAdminOrOwner ? guestForm.branch_name : user?.branch_name;
                if (!branchToUse) return alert("지점을 선택해주세요.");
                if (!guestForm.product_name) return alert("상품을 선택해주세요.");
                if (!guestForm.final_amount) return alert("금액을 입력해주세요.");
                const submitKey = guestIdempotencyKey;
                const submitBranch = branchToUse;
                setSubmitting(true);
                try {
                  const res = await apiFetch("/api/payments/add-guest", {
                    method: "POST",
                    body: JSON.stringify({
                      ...guestForm,
                      branch_name: branchToUse,
                      final_amount: Number(guestForm.final_amount),
                      idempotency_key: submitKey,
                      ...(guestIsDailyProduct ? { use_date: guestForm.use_date, guest_name: guestForm.guest_name, guest_phone: guestForm.guest_phone } : {}),
                    }),
                  });
                  if (res.status >= 500) {
                    setGuestPending({ key: submitKey, product_name: guestForm.product_name, final_amount: guestForm.final_amount, branch_name: submitBranch });
                    alert("서버 오류가 발생했습니다. 결제가 처리됐을 수 있으니 결제 내역을 확인하거나 같은 내용으로 재시도해 주세요.");
                    return;
                  }
                  if (!res.ok) {
                    try { const j = await res.json(); alert(j.message || "결제 처리에 실패했습니다."); }
                    catch { alert("결제 처리에 실패했습니다."); }
                    return;
                  }
                  let json: any;
                  try { json = await res.json(); }
                  catch {
                    setGuestPending({ key: submitKey, product_name: guestForm.product_name, final_amount: guestForm.final_amount, branch_name: submitBranch });
                    alert("응답 처리 중 오류가 발생했습니다. 결제 내역을 확인하거나 같은 내용으로 재시도해 주세요.");
                    return;
                  }
                  if (json.success) {
                    setGuestPending(null);
                    alert("결제 등록 완료");
                    setGuestIdempotencyKey(crypto.randomUUID());
                    setGuestModal(false);
                    loadPayments();
                  } else {
                    alert(json.message || "결제 실패");
                  }
                } catch {
                  setGuestPending({ key: submitKey, product_name: guestForm.product_name, final_amount: guestForm.final_amount, branch_name: submitBranch });
                  alert("네트워크 오류가 발생했습니다. 결제가 처리됐을 수 있으니 결제 내역을 확인하거나 같은 내용으로 재시도해 주세요.");
                } finally {
                  setSubmitting(false);
                }
              }}>{submitting ? "처리 중..." : guestPending ? "같은 내용으로 재시도" : "결제 등록"}</button>
            </div>
          </div>
        </div>
      )}

      {/* 결제 수정 모달 */}
      {editTarget && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="card" style={{ width: 440, maxWidth: "95vw", borderRadius: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ margin: 0 }}>결제 수정 — {editTarget.name}</h2>
              <button onClick={() => setEditTarget(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "var(--muted)" }}>✕</button>
            </div>
            <div style={{ display: "grid", gap: 12 }}>
              <input className="input" placeholder="상품명" value={editForm.product_name} onChange={e => setEditForm({ ...editForm, product_name: e.target.value })} />
              <input className="input" type="number" placeholder="결제금액" value={editForm.final_amount} onChange={e => setEditForm({ ...editForm, final_amount: e.target.value })} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {(["CARD", "CASH", "TRANSFER"] as const).map(m => (
                  <button key={m} className={editForm.payment_method === m ? "btn" : "btn secondary"} onClick={() => setEditForm({ ...editForm, payment_method: m })}>
                    {METHOD_LABEL[m]}
                  </button>
                ))}
              </div>
              <input className="input" type="date" value={editForm.payment_date} onChange={e => setEditForm({ ...editForm, payment_date: e.target.value })} />
              <textarea className="input" placeholder="메모" value={editForm.memo} onChange={e => setEditForm({ ...editForm, memo: e.target.value })} style={{ minHeight: 80 }} />
              <button className="btn" style={{ fontSize: 16 }} onClick={saveEdit}>저장</button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

// 스타일 상수
const btnStyle: React.CSSProperties = {
  height: 38, padding: "0 16px", fontSize: 13, fontWeight: 500,
  background: "#fff", border: "1px solid #E5E7EB", borderRadius: 7,
  color: "#374151", cursor: "pointer", whiteSpace: "nowrap",
};

const btnSmStyle: React.CSSProperties = {
  height: 32, padding: "0 12px", fontSize: 13, fontWeight: 500,
  background: "#fff", border: "1px solid #E5E7EB", borderRadius: 6,
  color: "#374151", cursor: "pointer",
};

const thStyle: React.CSSProperties = {
  padding: "10px 14px", textAlign: "left", fontSize: 13,
  fontWeight: 600, color: "#6B7280", whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "12px 14px", fontSize: 14, color: "#374151",
  verticalAlign: "top",
};
