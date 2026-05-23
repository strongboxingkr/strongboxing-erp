"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";

const currentMonth = new Date().toISOString().slice(0, 7);

export default function TargetsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);

  const [form, setForm] = useState({
    branch_name: "",
    target_month: currentMonth,
    target_amount: 0,
    memo: "",
  });

  const loadBranches = async () => {
    const res = await fetch("/api/settings?option_type=BRANCH");
    const data = await res.json();

    setBranches(data.rows || []);

    if (data.rows?.length > 0) {
      setForm((prev) => ({
        ...prev,
        branch_name: data.rows[0].option_name,
      }));
    }
  };

  const loadTargets = async () => {
    const res = await fetch("/api/targets");
    const data = await res.json();
    setRows(data.rows || []);
  };

  useEffect(() => {
    loadBranches();
    loadTargets();
  }, []);

  const save = async () => {
    const res = await fetch("/api/targets/save", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(form),
    });

    const data = await res.json();

    if (data.success) {
      alert("목표매출 저장 완료!");
      loadTargets();
    } else {
      alert(data.message || "저장 실패");
    }
  };

  return (
    <AppShell title="지점 목표매출">
      <div className="card" style={{ marginBottom: 16 }}>
        <h2>목표매출 설정</h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr 2fr 2fr auto",
            gap: 12,
          }}
        >
          <select
            className="input"
            value={form.branch_name}
            onChange={(e) =>
              setForm({
                ...form,
                branch_name: e.target.value,
              })
            }
          >
            {branches.map((b) => (
              <option key={b.option_id} value={b.option_name}>
                {b.option_name}
              </option>
            ))}
          </select>

          <input
            className="input"
            type="month"
            value={form.target_month}
            onChange={(e) =>
              setForm({
                ...form,
                target_month: e.target.value,
              })
            }
          />

          <input
            className="input"
            type="number"
            placeholder="목표매출"
            value={form.target_amount}
            onChange={(e) =>
              setForm({
                ...form,
                target_amount: Number(e.target.value),
              })
            }
          />

          <input
            className="input"
            placeholder="메모"
            value={form.memo}
            onChange={(e) =>
              setForm({
                ...form,
                memo: e.target.value,
              })
            }
          />

          <button className="btn" onClick={save}>
            저장
          </button>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>지점</th>
              <th>월</th>
              <th>목표매출</th>
              <th>메모</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((r) => (
              <tr key={r.target_id}>
                <td style={{ fontWeight: 900 }}>
                  {r.branch_name}
                </td>

                <td>{r.target_month}</td>

                <td
                  style={{
                    color: "#2ee59d",
                    fontWeight: 900,
                  }}
                >
                  {Number(r.target_amount).toLocaleString()}원
                </td>

                <td>{r.memo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}