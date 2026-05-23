"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { apiFetch } from "@/lib/api";

const today = new Date().toISOString().slice(0, 10);

export default function DailyClosingPage() {
  const [data, setData] = useState<any>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [branch, setBranch] = useState("철산점");
  const [date, setDate] = useState(today);
  const [memo, setMemo] = useState("");

  const [user, setUser] = useState<any>(null);

useEffect(() => {
  if (typeof window !== "undefined") {
    const savedUser = localStorage.getItem("user");

    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }
}, []);

  const isAdminOrOwner = user?.role === "ADMIN" || user?.role === "OWNER";

  const loadBranches = async () => {
    const res = await apiFetch("/api/settings?option_type=BRANCH");
    const json = await res.json();
    setBranches(json.rows || []);

    if (json.rows?.length > 0 && isAdminOrOwner) {
      setBranch(json.rows[0].option_name);
    }
  };

  const load = async () => {
    let targetBranch = branch;

    if (!isAdminOrOwner) {
      targetBranch = user?.branch_name;
      setBranch(user?.branch_name);
    }

    const res = await apiFetch(
      `/api/daily-closing?branch_name=${encodeURIComponent(
        targetBranch
      )}&closing_date=${date}`
    );

    const json = await res.json();
    setData(json);
    setMemo(json.closing?.memo || "");
  };

  useEffect(() => {
    loadBranches();
  }, []);

  useEffect(() => {
    if (branch) load();
  }, [branch, date]);

  const save = async () => {
    if (!data) return;

    const res = await apiFetch("/api/daily-closing/save", {
      method: "POST",
      body: JSON.stringify({
        branch_name: data.branch_name,
        closing_date: data.closing_date,
        sales_amount: data.sales,
        card_amount: data.card_amount,
        cash_amount: data.cash_amount,
        transfer_amount: data.transfer_amount,
        new_members: data.new_members,
        checkins: data.checkins,
        reservations: data.reservations,
        memo,
      }),
    });

    const json = await res.json();

    if (json.success) {
      alert("일일 마감 저장 완료!");
      load();
    } else {
      alert(json.message || "저장 실패");
    }
  };

  if (!data) {
    return <AppShell title="일일 마감">로딩중...</AppShell>;
  }

  const cards = [
    ["총 매출", `${Number(data.sales || 0).toLocaleString()}원`],
    ["카드", `${Number(data.card_amount || 0).toLocaleString()}원`],
    ["현금", `${Number(data.cash_amount || 0).toLocaleString()}원`],
    ["계좌이체", `${Number(data.transfer_amount || 0).toLocaleString()}원`],
    ["신규회원", `${data.new_members || 0}명`],
    ["출석", `${data.checkins || 0}명`],
    ["네이버예약", `${data.reservations || 0}건`],
  ];

  return (
    <AppShell title="일일 마감">
      <div className="card" style={{ marginBottom: 16 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr auto",
            gap: 12,
          }}
        >
          {isAdminOrOwner ? (
            <select
              className="input"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
            >
              {branches.map((b) => (
                <option key={b.option_id}>{b.option_name}</option>
              ))}
            </select>
          ) : (
            <div className="input" style={{ color: "#aaa" }}>
              {user?.branch_name}
            </div>
          )}

          <input
            className="input"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />

          <button className="btn secondary" onClick={load}>
            새로고침
          </button>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 16,
          marginBottom: 16,
        }}
      >
        {cards.map(([title, value]) => (
          <div className="card" key={title}>
            <h3>{title}</h3>
            <div className="num">{value}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>마감 메모</h2>

        <textarea
          className="input"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="특이사항, 미수금, 환불, 전달사항 등을 입력하세요."
          style={{ minHeight: 140, marginBottom: 14 }}
        />

        <button className="btn" onClick={save}>
          마감 저장
        </button>

        {data.closing && (
          <p style={{ color: "#aaa", marginTop: 12 }}>
            이미 마감 저장됨 / 담당: {data.closing.closed_by || "-"}
          </p>
        )}
      </div>
    </AppShell>
  );
}