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
  const [reviewRefund, setReviewRefund] = useState(false);
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
    Number(form.amount || 0) + extraAmount - (reviewRefund ? 20000 : 0);

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
      reviewRefund ? "리뷰환급 예정" : "",
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
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 20,
          flexWrap: "wrap",
          marginBottom: 20,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 34, fontWeight: 900 }}>
            결제관리
          </h1>
          <p style={{ color: "#888", marginTop: 8 }}>
            회원권 + 추가상품 결제 등록
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {isAdminOrOwner && (
            <select
              className="input"
              style={{ width: 160, padding: "6px 10px", fontSize: 13 }}
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
            >
              <option>전체</option>
              {branches.map((b) => (
                <option key={b.option_id}>{b.option_name}</option>
              ))}
            </select>
          )}

          <button className="btn secondary" style={{ padding: "6px 14px", fontSize: 13 }} onClick={loadPayments}>
            새로고침
          </button>
          <button className="btn" style={{ padding: "6px 16px", fontSize: 13, background: "#f59e0b" }} onClick={() => { setGuestForm({ branch_name: branches[0]?.option_name || "", product_name: "일일권", final_amount: "30000", payment_method: "CARD", payment_date: today, memo: "" }); setGuestModal(true); }}>
            비회원 결제
          </button>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.1fr 420px",
          gap: 18,
          alignItems: "start",
        }}
      >
        <div>
          <div className="card" style={{ borderRadius: 24, marginBottom: 18 }}>
            <h2>회원 선택</h2>

            <input
              className="input"
              placeholder="이름 또는 전화번호 검색"
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              style={{ marginBottom: 14 }}
            />

            <div
              style={{
                display: "grid",
                gap: 10,
                maxHeight: 340,
                overflow: "auto",
              }}
            >
              {filteredMembers.map((m) => (
                <div
                  key={m.member_id}
                  onClick={() =>
                    setForm({
                      ...form,
                      member_id: String(m.member_id),
                      branch_name: m.branch_name,
                      product_name: m.product_name,
                    })
                  }
                  style={{
                    padding: 14,
                    borderRadius: 18,
                    cursor: "pointer",
                    border:
                      String(form.member_id) === String(m.member_id)
                        ? "2px solid #2563eb"
                        : "1px solid var(--line)",
                    background: "var(--panel2)",
                  }}
                >
                  <div style={{ fontSize: 18, fontWeight: 900 }}>{m.name}</div>
                  <div style={{ marginTop: 6, color: "#888", fontSize: 13 }}>
                    {m.phone}
                  </div>
                  <div style={{ marginTop: 8, color: "var(--muted)", fontSize: 14 }}>
                    {m.product_name}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ borderRadius: 24 }}>
            <h2>결제 등록</h2>

            {selectedMember ? (
              <div
                style={{
                  background: "var(--panel2)",
                  borderRadius: 18,
                  padding: 16,
                  marginBottom: 16,
                }}
              >
                <div style={{ fontSize: 24, fontWeight: 900 }}>
                  {selectedMember.name}
                </div>
                <div style={{ color: "#888", marginTop: 6 }}>
                  {selectedMember.phone}
                </div>
                <div style={{ marginTop: 10, color: "#2ee59d", fontWeight: 900 }}>
                  {selectedMember.product_name}
                </div>
              </div>
            ) : (
              <div style={{ color: "#888", marginBottom: 16 }}>
                회원을 선택해주세요.
              </div>
            )}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                marginBottom: 12,
              }}
            >
              <select
                className="input"
                value={form.product_name}
                onChange={(e) => {
                  const p = products.find((p: any) => p.option_name === e.target.value);
                  setForm({ ...form, product_name: e.target.value, amount: p?.amount ? String(p.amount) : form.amount });
                }}
              >
                <option value="">상품 선택</option>
                {products.map((p: any) => (
                  <option key={p.option_id} value={p.option_name}>{p.option_name}</option>
                ))}
              </select>

              <input
                className="input"
                type="number"
                placeholder="회원권 결제금액"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </div>

            <div
              style={{
                background: "var(--panel2)",
                borderRadius: 18,
                padding: 16,
                marginBottom: 14,
              }}
            >
              <div style={{ fontWeight: 900, marginBottom: 12, fontSize: 18 }}>
                추가상품
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                {extraProducts.map((p) => {
                  const checked = selectedExtras.includes(p.option_name);

                  return (
                    <label
                      key={p.option_id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        background: checked
                          ? "rgba(46,229,157,0.12)"
                          : "var(--panel2)",
                        border: checked
                          ? "1px solid #2ee59d"
                          : "1px solid #1f2937",
                        borderRadius: 14,
                        padding: 12,
                        cursor: "pointer",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 900 }}>{p.option_name}</div>
                        <div style={{ color: "#888", marginTop: 4, fontSize: 13 }}>
                          {money(p.option_value)}
                        </div>
                      </div>

                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleExtra(p.option_name)}
                      />
                    </label>
                  );
                })}

                <label
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: reviewRefund
                      ? "rgba(255,77,109,0.12)"
                      : "var(--panel2)",
                    border: reviewRefund
                      ? "1px solid #ff4d6d"
                      : "1px solid #1f2937",
                    borderRadius: 14,
                    padding: 12,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 900 }}>리뷰 환급 예정</div>
                    <div style={{ color: "#888", marginTop: 4, fontSize: 13 }}>
                      -20,000원
                    </div>
                  </div>

                  <input
                    type="checkbox"
                    checked={reviewRefund}
                    onChange={(e) => setReviewRefund(e.target.checked)}
                  />
                </label>
              </div>

              <div
                style={{
                  marginTop: 18,
                  paddingTop: 16,
                  borderTop: "1px solid #1f2937",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div style={{ color: "#aaa" }}>최종 결제금액</div>
                <div style={{ fontSize: 30, fontWeight: 900, color: "#2ee59d" }}>
                  {money(finalAmount)}
                </div>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 10,
                marginBottom: 14,
              }}
            >
              {[
                ["CARD", "카드"],
                ["CASH", "현금"],
                ["TRANSFER", "계좌이체"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  className={
                    form.payment_method === value ? "btn" : "btn secondary"
                  }
                  onClick={() => setForm({ ...form, payment_method: value })}
                >
                  {label}
                </button>
              ))}
            </div>

            <input
              className="input"
              type="date"
              value={form.payment_date}
              onChange={(e) =>
                setForm({ ...form, payment_date: e.target.value })
              }
              style={{ marginBottom: 12 }}
            />

            <textarea
              className="input"
              placeholder="메모"
              value={form.memo}
              onChange={(e) => setForm({ ...form, memo: e.target.value })}
              style={{ minHeight: 100, marginBottom: 14 }}
            />

            <button
              className="btn"
              style={{ width: "100%", fontSize: 18 }}
              onClick={savePayment}
            >
              결제 등록
            </button>
          </div>
        </div>

        <div>
          <div
            className="card"
            style={{
              borderRadius: 24,
              marginBottom: 18,
              background:
                "linear-gradient(135deg, #eff6ff, #dbeafe)",
              border: "1px solid #bfdbfe",
            }}
          >
            <div style={{ color: "#2563eb", fontSize: 13, fontWeight: 600 }}>오늘 매출</div>
            <div style={{ marginTop: 10, fontSize: 42, fontWeight: 900, color: "#1e3a8a" }}>
              {money(todaySales)}
            </div>
          </div>

          <div className="card" style={{ borderRadius: 24 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 14,
              }}
            >
              <h2 style={{ margin: 0 }}>최근 결제</h2>

              <button
                className="btn secondary"
                onClick={() => {
                  window.location.href = "/api/export/payments";
                }}
              >
                CSV
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gap: 12,
                maxHeight: 760,
                overflow: "auto",
              }}
            >
              {rows.map((r) => (
                <div
                  key={r.payment_id}
                  style={{
                    background: "var(--panel2)",
                    borderRadius: 18,
                    padding: 16,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 900 }}>
                        {r.name}
                      </div>
                      <div style={{ color: "#888", marginTop: 6, fontSize: 13 }}>
                        {r.branch_name}
                      </div>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <div
                        style={{
                          color: "#2ee59d",
                          fontWeight: 900,
                          fontSize: 22,
                        }}
                      >
                        {money(r.amount)}
                      </div>
                      <div style={{ color: "#888", marginTop: 6, fontSize: 13 }}>
                        {r.payment_date?.slice(0, 10)}
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <div
                      style={{
                        background: "var(--panel2)",
                        borderRadius: 999,
                        padding: "6px 10px",
                        fontSize: 13,
                        color: "#aaa",
                      }}
                    >
                      {r.product_name}
                    </div>

                    <div
                      style={{
                        background: "var(--panel2)",
                        borderRadius: 999,
                        padding: "6px 10px",
                        fontSize: 13,
                        color: "#aaa",
                      }}
                    >
                      {r.payment_method === "CARD"
                        ? "카드"
                        : r.payment_method === "CASH"
                        ? "현금"
                        : "계좌이체"}
                    </div>
                  </div>

                  {r.memo && (
                    <div style={{ marginTop: 12, color: "#777", fontSize: 13, whiteSpace: "pre-wrap" }}>
                      {r.memo}
                    </div>
                  )}

                  {canEditPayment && (
                    <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
                      <button
                        className="btn secondary"
                        style={{ fontSize: 12, padding: "4px 12px" }}
                        onClick={() => openEdit(r)}
                      >
                        수정
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {rows.length === 0 && (
                <div style={{ color: "#888", textAlign: "center" }}>
                  결제 내역이 없습니다.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
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