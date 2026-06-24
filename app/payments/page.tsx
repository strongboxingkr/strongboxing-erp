"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { apiFetch } from "@/lib/api";

const today = new Date().toISOString().slice(0, 10);

const money = (v: any) => `${Number(v || 0).toLocaleString()}??;

export default function PaymentsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [extraProducts, setExtraProducts] = useState<any[]>([]);
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);
  const [reviewRefund, setReviewRefund] = useState(false);
  const [user, setUser] = useState<any>(null);

  const [branch, setBranch] = useState("?꾩껜");
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

  const loadBranches = async () => {
    const res = await apiFetch("/api/settings?option_type=BRANCH");
    const data = await res.json();
    setBranches(data.rows || []);
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
    } else if (branch !== "?꾩껜") {
      url += `?branch_name=${encodeURIComponent(branch)}`;
    }

    const res = await apiFetch(url);
    const data = await res.json();
    setRows(data.rows || []);
  };

  useEffect(() => {
    loadBranches();
    loadMembers();
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
      alert("?뚯썝???좏깮?댁＜?몄슂.");
      return;
    }

    if (finalAmount <= 0) {
      alert("寃곗젣湲덉븸???뺤씤?댁＜?몄슂.");
      return;
    }

    const autoMemo = [
      form.memo,
      selectedExtras.length > 0 ? `異붽??곹뭹: ${selectedExtras.join(", ")}` : "",
      reviewRefund ? "由щ럭?섍툒 ?덉젙" : "",
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
      alert("寃곗젣 ?깅줉 ?꾨즺!");

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
      alert(data.message || "寃곗젣 ?깅줉 ?ㅽ뙣");
    }
  };

  const todaySales = rows
    .filter((r) => r.payment_date?.slice(0, 10) === today)
    .reduce((sum, r) => sum + Number(r.amount || 0), 0);

  return (
    <AppShell title="寃곗젣愿由?>
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
            寃곗젣愿由?          </h1>
          <p style={{ color: "#888", marginTop: 8 }}>
            ?뚯썝沅?+ 異붽??곹뭹 寃곗젣 ?깅줉
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {isAdminOrOwner && (
            <select
              className="input"
              style={{ width: 180 }}
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
            >
              <option>?꾩껜</option>
              {branches.map((b) => (
                <option key={b.option_id}>{b.option_name}</option>
              ))}
            </select>
          )}

          <button className="btn secondary" onClick={loadPayments}>
            ?덈줈怨좎묠
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
            <h2>?뚯썝 ?좏깮</h2>

            <input
              className="input"
              placeholder="?대쫫 ?먮뒗 ?꾪솕踰덊샇 寃??
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
                        ? "2px solid #2ee59d"
                        : "1px solid #1f2937",
                    background: "var(--panel2)",
                  }}
                >
                  <div style={{ fontSize: 18, fontWeight: 900 }}>{m.name}</div>
                  <div style={{ marginTop: 6, color: "#888", fontSize: 13 }}>
                    {m.phone}
                  </div>
                  <div style={{ marginTop: 8, color: "#ddd", fontSize: 14 }}>
                    {m.product_name}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ borderRadius: 24 }}>
            <h2>寃곗젣 ?깅줉</h2>

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
                ?뚯썝???좏깮?댁＜?몄슂.
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
              <input
                className="input"
                placeholder="?곹뭹紐?
                value={form.product_name}
                onChange={(e) =>
                  setForm({ ...form, product_name: e.target.value })
                }
              />

              <input
                className="input"
                type="number"
                placeholder="?뚯썝沅?寃곗젣湲덉븸"
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
                異붽??곹뭹
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
                    <div style={{ fontWeight: 900 }}>由щ럭 ?섍툒 ?덉젙</div>
                    <div style={{ color: "#888", marginTop: 4, fontSize: 13 }}>
                      -20,000??                    </div>
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
                <div style={{ color: "#aaa" }}>理쒖쥌 寃곗젣湲덉븸</div>
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
                ["CARD", "移대뱶"],
                ["CASH", "?꾧툑"],
                ["TRANSFER", "怨꾩쥖?댁껜"],
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
              placeholder="硫붾え"
              value={form.memo}
              onChange={(e) => setForm({ ...form, memo: e.target.value })}
              style={{ minHeight: 100, marginBottom: 14 }}
            />

            <button
              className="btn"
              style={{ width: "100%", fontSize: 18 }}
              onClick={savePayment}
            >
              寃곗젣 ?깅줉
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
                "linear-gradient(135deg, rgba(46,229,157,0.18), var(--panel2))",
            }}
          >
            <div style={{ color: "#d1fae5" }}>?ㅻ뒛 留ㅼ텧</div>
            <div style={{ marginTop: 10, fontSize: 42, fontWeight: 900 }}>
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
              <h2 style={{ margin: 0 }}>理쒓렐 寃곗젣</h2>

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
                        ? "移대뱶"
                        : r.payment_method === "CASH"
                        ? "?꾧툑"
                        : "怨꾩쥖?댁껜"}
                    </div>
                  </div>

                  {r.memo && (
                    <div style={{ marginTop: 12, color: "#777", fontSize: 13, whiteSpace: "pre-wrap" }}>
                      {r.memo}
                    </div>
                  )}
                </div>
              ))}

              {rows.length === 0 && (
                <div style={{ color: "#888", textAlign: "center" }}>
                  寃곗젣 ?댁뿭???놁뒿?덈떎.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
