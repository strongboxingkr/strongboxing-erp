"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

const today = new Date().toISOString().slice(0, 10);

export default function MobileCrmPage() {
  const [rows, setRows] = useState<any[]>([]);

  const [form, setForm] = useState({
    customer_name: "",
    phone: "",
    inquiry_channel: "전화문의",
    memo: "",
    next_contact_date: today,
  });

  const getUser = () => {
    try {
      const saved = localStorage.getItem("user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  };

  const load = async () => {
    const user = getUser();

    let url = "/api/crm";

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

    setRows(json.rows || []);
  };

  const save = async () => {
    const user = getUser();

    if (!form.customer_name.trim()) {
      alert("이름 입력");
      return;
    }

    const res = await apiFetch("/api/crm/add", {
      method: "POST",
      body: JSON.stringify({
        branch_name:
          user?.branch_name || "철산점",
        customer_name: form.customer_name,
        phone: form.phone,
        inquiry_type: "신규상담",
        inquiry_channel:
          form.inquiry_channel,
        status: "상담중",
        next_contact_date:
          form.next_contact_date,
        memo: form.memo,
      }),
    });

    const json = await res.json();

    if (json.success) {
      alert("상담 등록 완료!");

      setForm({
        customer_name: "",
        phone: "",
        inquiry_channel: "전화문의",
        memo: "",
        next_contact_date: today,
      });

      load();
    } else {
      alert(json.message || "실패");
    }
  };

  useEffect(() => {
    load();
  }, []);

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
            CRM
          </span>
        </div>

        <div
          style={{
            marginTop: 6,
            color: "#888",
          }}
        >
          모바일 상담관리
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
          상담 등록
        </div>

        <input
          className="input"
          placeholder="이름"
          value={form.customer_name}
          onChange={(e) =>
            setForm({
              ...form,
              customer_name:
                e.target.value,
            })
          }
          style={{ marginBottom: 10 }}
        />

        <input
          className="input"
          placeholder="전화번호"
          value={form.phone}
          onChange={(e) =>
            setForm({
              ...form,
              phone: e.target.value,
            })
          }
          style={{ marginBottom: 10 }}
        />

        <select
          className="input"
          value={form.inquiry_channel}
          onChange={(e) =>
            setForm({
              ...form,
              inquiry_channel:
                e.target.value,
            })
          }
          style={{ marginBottom: 10 }}
        >
          <option>전화문의</option>
          <option>인스타</option>
          <option>블로그</option>
          <option>지인</option>
          <option>현장문의</option>
        </select>

        <input
          className="input"
          type="date"
          value={form.next_contact_date}
          onChange={(e) =>
            setForm({
              ...form,
              next_contact_date:
                e.target.value,
            })
          }
          style={{ marginBottom: 10 }}
        />

        <textarea
          className="input"
          placeholder="상담 메모"
          value={form.memo}
          onChange={(e) =>
            setForm({
              ...form,
              memo: e.target.value,
            })
          }
          style={{
            minHeight: 100,
            marginBottom: 12,
          }}
        />

        <button
          className="btn"
          onClick={save}
          style={{
            width: "100%",
            height: 56,
            fontWeight: 900,
            fontSize: 18,
          }}
        >
          상담 저장
        </button>
      </div>

      <div
        className="card"
        style={{
          borderRadius: 28,
        }}
      >
        <div
          style={{
            fontSize: 22,
            fontWeight: 900,
            marginBottom: 14,
          }}
        >
          최근 상담
        </div>

        <div
          style={{
            display: "grid",
            gap: 10,
          }}
        >
          {rows.map((r) => (
            <div
                key={r.crm_id}
                style={{
                    background: "#111827",
                    borderRadius: 18,
                    padding: 16,
                }}
                >
                <div
                    style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 10,
                    }}
                >
                    <div>
                    <div
                        style={{
                        fontSize: 22,
                        fontWeight: 900,
                        }}
                    >
                        {r.customer_name}
                    </div>

                    <div
                        style={{
                        marginTop: 6,
                        color: "#888",
                        }}
                    >
                        {r.phone}
                    </div>
                    </div>

                    <select
                    className="input"
                    value={r.status}
                    onChange={async (e) => {
                        const next = e.target.value;

                        const res = await apiFetch(
                        "/api/crm/update",
                        {
                            method: "POST",
                            body: JSON.stringify({
                            ...r,
                            status: next,
                            }),
                        }
                        );

                        const json = await res.json();

                        if (json.success) {
                        load();
                        } else {
                        alert(
                            json.message || "상태변경 실패"
                        );
                        }
                    }}
                    style={{
                        width: 120,
                        minWidth: 120,
                    }}
                    >
                    <option>상담중</option>
                    <option>방문예약</option>
                    <option>등록완료</option>
                    <option>부재중</option>
                    <option>종료</option>
                    </select>
                </div>

                <div
                    style={{
                    marginTop: 10,
                    color: "#2ee59d",
                    fontWeight: 900,
                    }}
                >
                    {r.status}
                </div>

                <div
                    style={{
                    marginTop: 10,
                    color: "#aaa",
                    whiteSpace: "pre-wrap",
                    }}
                >
                    {r.memo}
                </div>

                <div
                    style={{
                    marginTop: 12,
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 10,
                    }}
                >
                    <button
                    className="btn"
                    onClick={() => {
                        window.location.href =
                        `/mobile-members?search=${r.customer_name}`;
                    }}
                    >
                    회원찾기
                    </button>

                    <button
                    className="btn secondary"
                    onClick={() => {
                        window.location.href =
                        `/mobile-members`;
                    }}
                    >
                    회원등록
                    </button>
                </div>
                </div>
          ))}

          {rows.length === 0 && (
            <div style={{ color: "#888" }}>
              상담 내역 없음
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

        <Link href="/mobile-payments" style={tabStyle}>
          결제
        </Link>

        <Link
          href="/mobile-crm"
          style={{
            ...tabStyle,
            color: "#2ee59d",
            fontWeight: 900,
          }}
        >
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