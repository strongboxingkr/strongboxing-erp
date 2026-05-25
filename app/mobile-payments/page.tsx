"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

const today = new Date().toISOString().slice(0, 10);

const money = (v: any) =>
  `${Number(v || 0).toLocaleString()}원`;

export default function MobilePaymentsPage() {
  const [members, setMembers] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);

  const [todaySales, setTodaySales] = useState(0);

  const [search, setSearch] = useState("");

  const [form, setForm] = useState({
    member_id: "",
    payment_date: today,
    payment_method: "CARD",
    amount: "",
    memo: "",
  });

  const getUser = () => {
    try {
      const saved = localStorage.getItem("user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  };

  const loadMembers = async () => {
    const user = getUser();

    let url = "/api/members";

    if (
      user?.role !== "OWNER" &&
      user?.role !== "ADMIN"
    ) {
      url += `?branch_name=${encodeURIComponent(
        user?.branch_name || ""
      )}`;
    }

    const res = await apiFetch(url);
    const json = await res.json();

    setMembers(json.rows || []);
  };

  const loadPayments = async () => {
    const user = getUser();

    let url = "/api/payments";

    if (
      user?.role !== "OWNER" &&
      user?.role !== "ADMIN"
    ) {
      url += `?branch_name=${encodeURIComponent(
        user?.branch_name || ""
      )}`;
    }

    const res = await apiFetch(url);
    const json = await res.json();

    const rows = json.rows || [];

    setPayments(rows);

    const total = rows
      .filter(
        (r: any) =>
          r.payment_date?.slice(0, 10) === today
      )
      .reduce(
        (sum: number, r: any) =>
          sum + Number(r.amount || 0),
        0
      );

    setTodaySales(total);
  };

  const savePayment = async () => {
    if (!form.member_id) {
      alert("회원 선택");
      return;
    }

    if (!form.amount) {
      alert("금액 입력");
      return;
    }

    const res = await apiFetch(
      "/api/payments/add",
      {
        method: "POST",
        body: JSON.stringify({
          ...form,
          amount: Number(form.amount),
        }),
      }
    );

    const json = await res.json();

    if (json.success) {
      alert("결제 등록 완료!");

      setForm({
        member_id: "",
        payment_date: today,
        payment_method: "CARD",
        amount: "",
        memo: "",
      });

      loadPayments();
    } else {
      alert(json.message || "등록 실패");
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const memberId = params.get("member_id");

    if (memberId) {
        setForm((prev) => ({
        ...prev,
        member_id: memberId,
        }));
    }

    loadMembers();
    loadPayments();
    }, []);

  const filtered = members.filter((m) => {
    if (!search.trim()) return true;

    return (
      m.name?.includes(search) ||
      m.phone?.includes(search)
    );
  });

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#08090d",
        color: "white",
        padding: "18px 18px 90px",
      }}
    >
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 32, fontWeight: 900 }}>
          STRONG{" "}
          <span style={{ color: "#2ee59d" }}>
            PAYMENTS
          </span>
        </div>

        <div
          style={{
            marginTop: 6,
            color: "#888",
          }}
        >
          모바일 결제관리
        </div>
      </div>

      <div
        className="card"
        style={{
          borderRadius: 28,
          marginBottom: 18,
          background:
            "linear-gradient(135deg, rgba(46,229,157,0.18), rgba(17,24,39,1))",
        }}
      >
        <div style={{ color: "#aaa" }}>
          오늘 결제금액
        </div>

        <div
          style={{
            marginTop: 10,
            fontSize: 38,
            fontWeight: 900,
            color: "#2ee59d",
          }}
        >
          {money(todaySales)}
        </div>
      </div>

      <div
        className="card"
        style={{
          borderRadius: 28,
          marginBottom: 18,
        }}
      >
        <div
          style={{
            fontSize: 22,
            fontWeight: 900,
            marginBottom: 14,
          }}
        >
          결제 등록
        </div>

        <input
          className="input"
          placeholder="회원 검색"
          value={search}
          onChange={(e) =>
            setSearch(e.target.value)
          }
          style={{ marginBottom: 10 }}
        />

        <select
          className="input"
          value={form.member_id}
          onChange={(e) =>
            setForm({
              ...form,
              member_id: e.target.value,
            })
          }
          style={{ marginBottom: 10 }}
        >
          <option value="">
            회원 선택
          </option>

          {filtered.map((m) => (
            <option
              key={m.member_id}
              value={m.member_id}
            >
              {m.name} / {m.phone}
            </option>
          ))}
        </select>

        <input
          className="input"
          type="date"
          value={form.payment_date}
          onChange={(e) =>
            setForm({
              ...form,
              payment_date: e.target.value,
            })
          }
          style={{ marginBottom: 10 }}
        />

        <select
          className="input"
          value={form.payment_method}
          onChange={(e) =>
            setForm({
              ...form,
              payment_method: e.target.value,
            })
          }
          style={{ marginBottom: 10 }}
        >
          <option value="CARD">
            카드
          </option>

          <option value="CASH">
            현금
          </option>

          <option value="TRANSFER">
            계좌이체
          </option>
        </select>

        <input
          className="input"
          placeholder="결제금액"
          type="number"
          value={form.amount}
          onChange={(e) =>
            setForm({
              ...form,
              amount: e.target.value,
            })
          }
          style={{ marginBottom: 10 }}
        />

        <textarea
          className="input"
          placeholder="메모"
          value={form.memo}
          onChange={(e) =>
            setForm({
              ...form,
              memo: e.target.value,
            })
          }
          style={{
            minHeight: 90,
            marginBottom: 12,
          }}
        />

        <button
          className="btn"
          onClick={savePayment}
          style={{
            width: "100%",
            height: 56,
            fontWeight: 900,
            fontSize: 18,
          }}
        >
          결제 저장
        </button>
      </div>

      <div
        className="card"
        style={{
          borderRadius: 28,
          marginBottom: 18,
        }}
      >
        <div
          style={{
            fontSize: 22,
            fontWeight: 900,
            marginBottom: 14,
          }}
        >
          회원 목록
        </div>

        <div
          style={{
            display: "grid",
            gap: 10,
          }}
        >
          {filtered.map((m) => (
            <div
              key={m.member_id}
              style={{
                background: "#111827",
                borderRadius: 18,
                padding: 16,
              }}
            >
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 900,
                }}
              >
                {m.name}
              </div>

              <div
                style={{
                  marginTop: 6,
                  color: "#888",
                }}
              >
                {m.phone}
              </div>

              <div
                style={{
                  marginTop: 10,
                  color: "#2ee59d",
                  fontWeight: 900,
                }}
              >
                {m.product_name || "-"}
              </div>

              <div
                style={{
                  marginTop: 12,
                }}
              >
                <button
                  className="btn"
                  style={{
                    width: "100%",
                  }}
                  onClick={() =>
                    setForm({
                      ...form,
                      member_id: String(
                        m.member_id
                      ),
                    })
                  }
                >
                  선택
                </button>
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div style={{ color: "#888" }}>
              회원 없음
            </div>
          )}
        </div>
      </div>

      <div
        className="card"
        style={{
          borderRadius: 28,
          marginBottom: 18,
        }}
      >
        <div
          style={{
            fontSize: 22,
            fontWeight: 900,
            marginBottom: 14,
          }}
        >
          최근 결제내역
        </div>

        <div
          style={{
            display: "grid",
            gap: 10,
          }}
        >
          {payments.map((p) => (
            <div
              key={p.payment_id}
              style={{
                background: "#111827",
                borderRadius: 18,
                padding: 16,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent:
                    "space-between",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 20,
                      fontWeight: 900,
                    }}
                  >
                    {p.member_name || "-"}
                  </div>

                  <div
                    style={{
                      marginTop: 6,
                      color: "#888",
                    }}
                  >
                    {p.payment_method}
                  </div>
                </div>

                <div
                  style={{
                    color: "#2ee59d",
                    fontWeight: 900,
                    fontSize: 22,
                  }}
                >
                  {money(p.amount)}
                </div>
              </div>

              <div
                style={{
                  marginTop: 10,
                  color: "#888",
                  fontSize: 13,
                }}
              >
                {p.payment_date?.slice(0, 10)}
              </div>
            </div>
          ))}

          {payments.length === 0 && (
            <div style={{ color: "#888" }}>
              결제내역 없음
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "#0f172a",
          borderTop: "1px solid #1f2937",
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          padding: "10px 0",
          zIndex: 999,
        }}
      >
        <Link href="/mobile-branch" style={tabStyle}>
          홈
        </Link>

        <Link href="/mobile-members" style={tabStyle}>
          회원
        </Link>

        <Link href="/mobile-attendance" style={tabStyle}>
          출석
        </Link>

        <Link
          href="/mobile-payments"
          style={{
            ...tabStyle,
            color: "#2ee59d",
            fontWeight: 900,
          }}
        >
          결제
        </Link>

        <Link href="/mobile-crm" style={tabStyle}>
          상담
        </Link>
      </div>
    </div>
  );
}

const tabStyle = {
  textAlign: "center" as const,
  color: "white",
  textDecoration: "none",
  fontSize: 12,
};