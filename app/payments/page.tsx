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
  const [guestForm, setGuestForm] = useState({ branch_name: "", product_name: "", final_amount: "30000", payment_method: "CARD", payment_date: today, memo: "" });

  const [branch, setBranch] = useState("전체");
  const [memberSearch, setMemberSearch] = useState("");

  const [form, setForm] = useState({
    member_id: "",
    branch_name: "",
    product_name: "",
    amount: "",
    payment_method: "CARD",
    payment_date: today,
    memo: "",
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

    if (!isAdminOrOwner) {
      url += `?branch_name=${encodeURIComponent(user?.branch_name || "")}`;
    } else if (branch !== "전체") {
      url += `?branch_name=${encodeURIComponent(branch)}`;
    }

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
      .filter(
        (m) =>
          m.name?.includes(memberSearch) ||
          m.phone?.includes(memberSearch)
      )
      .slice(0, 15);
  }, [members, memberSearch]);

  const selectedMember = members.find(
    (m) => String(m.member_id) === String(form.member_id)
  );

  const extraAmount = extraProducts
    .filter((p) => selectedExtras.includes(p.option_name))
    .reduce((sum, p) => sum + Number(p.option_value || 0), 0);

  const finalAmount =
    Number(form.amount || 0) + extraAmount;

  const toggleExtra = (name: string) => {
    setSelectedExtras((prev) =>
      prev.includes(name) ? prev.filter((v) => v !== name) : [...prev, name]
    );
  };

  const savePayment = async () => {
    if (!form.member_id) {
      alert("회원을 선택해주세요.");
      return;
    }

    if (finalAmount <= 0) {
      alert("결제금액을 확인해주세요.");
      return;
    }

    const autoMemo = [
      form.memo,
      selectedExtras.length > 0 ? `추가상품: ${selectedExtras.join(", ")}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const res = await apiFetch("/api/payments/add", {
      method: "POST",
      body: JSON.stringify({
        ...form,
        branch_name: selectedMember?.branch_name || form.branch_name,
        member_id: Number(form.member_id),
        amount: finalAmount,
        memo: autoMemo,
        // products는 PASS_PRODUCT 목록만 담음 — 여기에 있으면 반드시 회원권
        payment_purpose: products.some((p: any) => p.option_name === form.product_name)
          ? "PASS"
          : "GENERAL",
      }),
    });

    const data = await res.json();

    if (data.success) {
      alert("결제 등록 완료!");

      setForm({
        member_id: "",
        branch_name: "",
        product_name: "",
        amount: "",
        payment_method: "CARD",
        payment_date: today,
        memo: "",
      });

      setSelectedExtras([]);
      setReviewRefund(false);
      setMemberSearch("");
      loadPayments();
    } else {
      alert(data.message || "결제 등록 실패");
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

  return (
    <AppShell title="결제관리">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#111827", lineHeight: 1.2 }}>결제관리</div>
          <div style={{ fontSize: 13, color: "#6B7280", marginTop: 4 }}>회원권 + 추가상품 결제 등록</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {isAdminOrOwner && (
            <select
              className="input"
              style={{ width: 150, height: 38, padding: "0 10px", fontSize: 13 }}
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
            >
              <option>전체</option>
              {branches.map((b) => (
                <option key={b.option_id}>{b.option_name}</option>
              ))}
            </select>
          )}
          <button onClick={loadPayments} style={{ height: 38, padding: "0 16px", fontSize: 13, fontWeight: 500, background: "#fff", border: "1px solid #E5E7EB", borderRadius: 7, color: "#374151", cursor: "pointer" }}>새로고침</button>
          <button onClick={() => { setGuestForm({ branch_name: branches[0]?.option_name || "", product_name: "일일권", final_amount: "30000", payment_method: "CARD", payment_date: today, memo: "" }); setGuestModal(true); }} style={{ height: 38, padding: "0 18px", fontSize: 13, fontWeight: 700, background: "#2563eb", border: "none", borderRadius: 7, color: "#fff", cursor: "pointer" }}>비회원 결제</button>
          <button onClick={() => { setReviewForm({ member_id: "", member_name: "", payment_method: "CARD", payment_date: today, memo: "" }); setReviewMemberSearch(""); setReviewModal(true); }} style={{ height: 38, padding: "0 16px", fontSize: 13, fontWeight: 500, background: "#fff", border: "1px solid #E5E7EB", borderRadius: 7, color: "#374151", cursor: "pointer" }}>리뷰환급</button>
        </div>
      </div>

      <div>
        <div>
          {/* 오늘 매출 */}
          <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 11, padding: "18px 22px", marginBottom: 14, minHeight: 110, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ color: "#6B7280", fontSize: 14 }}>오늘 매출</div>
            <div style={{ marginTop: 8, fontSize: 32, fontWeight: 600, color: "#111827" }}>
              {money(todaySales)}
            </div>
          </div>

          {/* 최근 결제 */}
          <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 11, padding: "18px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: "#111827" }}>최근 결제</span>
              <button onClick={() => { window.location.href = "/api/export/payments"; }} style={{ height: 34, padding: "0 14px", fontSize: 13, fontWeight: 500, background: "#fff", border: "1px solid #E5E7EB", borderRadius: 7, color: "#374151", cursor: "pointer" }}>CSV</button>
            </div>

            <div style={{ display: "grid", gap: 10, maxHeight: 760, overflow: "auto" }}>
              {rows.map((r) => (
                <div key={r.payment_id} style={{ background: "#F7F8FA", border: "1px solid #E5E7EB", borderRadius: 10, padding: "14px 16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 600, color: "#111827" }}>{r.name || "비회원"}</div>
                      <div style={{ color: "#6B7280", marginTop: 4, fontSize: 13 }}>{r.branch_name}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 18, fontWeight: 600, color: "#111827" }}>{money(r.amount)}</div>
                      <div style={{ color: "#6B7280", marginTop: 4, fontSize: 13 }}>{r.payment_date?.slice(0, 10)}</div>
                    </div>
                  </div>

                  <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 6, padding: "3px 10px", fontSize: 13, color: "#6B7280" }}>{r.product_name}</span>
                    <span style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 6, padding: "3px 10px", fontSize: 13, color: "#6B7280" }}>
                      {r.payment_method === "CARD" ? "카드" : r.payment_method === "CASH" ? "현금" : "계좌이체"}
                    </span>
                  </div>

                  {r.memo && <div style={{ marginTop: 8, color: "#6B7280", fontSize: 13, whiteSpace: "pre-wrap" }}>{r.memo}</div>}

                  {canEditPayment && (
                    <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end", gap: 6 }}>
                      <button onClick={() => openEdit(r)} style={{ height: 30, padding: "0 12px", fontSize: 12, fontWeight: 500, background: "#fff", border: "1px solid #E5E7EB", borderRadius: 6, color: "#374151", cursor: "pointer" }}>수정</button>
                      <button
                        onClick={async () => {
                          if (!confirm(`${r.name || "비회원"} - ${r.product_name} (${money(r.amount)}) 결제를 삭제하시겠습니까?`)) return;
                          const res = await apiFetch(`/api/payments/delete?payment_id=${r.payment_id}`, { method: "DELETE" });
                          const json = await res.json();
                          if (json.success) { alert("삭제 완료"); loadPayments(); }
                          else alert(json.message || "삭제 실패");
                        }}
                        style={{ height: 30, padding: "0 12px", fontSize: 12, fontWeight: 500, background: "none", border: "none", borderRadius: 6, color: "#ef4444", cursor: "pointer" }}
                      >삭제</button>
                    </div>
                  )}
                </div>
              ))}

              {rows.length === 0 && <div style={{ color: "#6B7280", textAlign: "center", padding: 20 }}>결제 내역이 없습니다.</div>}
            </div>
          </div>
        </div>
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
              {isAdminOrOwner && (
                <select className="input" value={guestForm.branch_name} onChange={e => setGuestForm({ ...guestForm, branch_name: e.target.value })}>
                  <option value="">지점 선택</option>
                  {branches.map(b => <option key={b.option_id}>{b.option_name}</option>)}
                </select>
              )}
              <select className="input" value={guestForm.product_name} onChange={e => {
                const p = products.find((p: any) => p.option_name === e.target.value);
                setGuestForm({ ...guestForm, product_name: e.target.value, final_amount: p?.amount ? String(p.amount) : guestForm.final_amount });
              }}>
                <option value="">상품 선택</option>
                {products.map((p: any) => <option key={p.option_id} value={p.option_name}>{p.option_name}</option>)}
              </select>
              <input className="input" type="number" placeholder="결제금액" value={guestForm.final_amount} onChange={e => setGuestForm({ ...guestForm, final_amount: e.target.value })} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {(["CARD", "CASH", "TRANSFER"] as const).map(m => (
                  <button key={m} className={guestForm.payment_method === m ? "btn" : "btn secondary"} onClick={() => setGuestForm({ ...guestForm, payment_method: m })}>{METHOD_LABEL[m]}</button>
                ))}
              </div>
              <input className="input" type="date" value={guestForm.payment_date} onChange={e => setGuestForm({ ...guestForm, payment_date: e.target.value })} />
              <textarea className="input" placeholder="메모 (선택)" value={guestForm.memo} onChange={e => setGuestForm({ ...guestForm, memo: e.target.value })} style={{ minHeight: 60 }} />
              <button className="btn" style={{ fontSize: 16 }} onClick={async () => {
                const branchToUse = isAdminOrOwner ? guestForm.branch_name : user?.branch_name;
                if (!branchToUse) return alert("지점을 선택해주세요.");
                if (!guestForm.product_name) return alert("상품을 선택해주세요.");
                if (!guestForm.final_amount) return alert("금액을 입력해주세요.");
                const res = await apiFetch("/api/payments/add-guest", {
                  method: "POST",
                  body: JSON.stringify({ ...guestForm, branch_name: branchToUse, final_amount: Number(guestForm.final_amount) }),
                });
                const json = await res.json();
                if (json.success) { alert("비회원 결제 완료!"); setGuestModal(false); loadPayments(); }
                else alert(json.message || "결제 실패");
              }}>결제 등록</button>
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