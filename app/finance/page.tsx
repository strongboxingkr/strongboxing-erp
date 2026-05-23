"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { apiFetch } from "@/lib/api";

const today = new Date().toISOString().slice(0, 10);

export default function FinancePage() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);

  const [form, setForm] = useState({
    branch_name: "철산점",
    expense_date: today,
    category: "",
    title: "",
    amount: 0,
    is_fixed: false,
    memo: "",
  });

  const isAdminOrOwner = user?.role === "ADMIN" || user?.role === "OWNER";

  const getUser = () => {
    const savedUser = localStorage.getItem("user");
    return savedUser ? JSON.parse(savedUser) : null;
  };

  const loadBranches = async () => {
    const res = await fetch("/api/settings?option_type=BRANCH");
    const data = await res.json();
    setBranches(data.rows || []);
  };

  const loadCategories = async () => {
    const res = await fetch("/api/settings?option_type=EXPENSE_CATEGORY");
    const data = await res.json();

    setCategories(data.rows || []);

    if (data.rows?.length > 0) {
      setForm((prev) => ({
        ...prev,
        category: prev.category || data.rows[0].option_name,
      }));
    }
  };

  const loadExpenses = async () => {
    const currentUser = getUser();

    let url = "/api/expenses";

    if (currentUser && currentUser.role !== "ADMIN" && currentUser.role !== "OWNER") {
      url += `?branch_name=${encodeURIComponent(currentUser.branch_name)}`;
    }

    const res = await apiFetch(url);
    const data = await res.json();
    setExpenses(data.rows || []);
  };

  useEffect(() => {
    const currentUser = getUser();
    setUser(currentUser);

    if (currentUser?.branch_name && currentUser.role !== "ADMIN" && currentUser.role !== "OWNER") {
      setForm((prev) => ({
        ...prev,
        branch_name: currentUser.branch_name,
      }));
    }

    loadBranches();
    loadCategories();
    loadExpenses();
  }, []);

  const saveExpense = async () => {
    const currentUser = getUser();

    const saveForm = {
      ...form,
      branch_name:
        currentUser && currentUser.role !== "ADMIN" && currentUser.role !== "OWNER"
          ? currentUser.branch_name
          : form.branch_name,
    };

    const res = await fetch("/api/expenses/add", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(saveForm),
    });

    const data = await res.json();

    if (data.success) {
      alert("비용 등록 완료!");

      setForm({
        branch_name:
          currentUser && currentUser.role !== "ADMIN" && currentUser.role !== "OWNER"
            ? currentUser.branch_name
            : branches[0]?.option_name || "철산점",
        expense_date: today,
        category: categories[0]?.option_name || "",
        title: "",
        amount: 0,
        is_fixed: false,
        memo: "",
      });

      loadExpenses();
    } else {
      alert(data.message || "비용 등록 실패");
      console.log(data);
    }
  };

  const totalExpense = expenses.reduce(
    (sum, e) => sum + Number(e.amount || 0),
    0
  );

  return (
    <AppShell title="재무 / 비용관리">
      <div className="card" style={{ marginBottom: 16 }}>
        <h2>비용 등록</h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 12,
          }}
        >
          {isAdminOrOwner ? (
            <select
              className="input"
              value={form.branch_name}
              onChange={(e) =>
                setForm({ ...form, branch_name: e.target.value })
              }
            >
              {branches.map((b) => (
                <option key={b.option_id} value={b.option_name}>
                  {b.option_name}
                </option>
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
            value={form.expense_date}
            onChange={(e) =>
              setForm({ ...form, expense_date: e.target.value })
            }
          />

          <select
            className="input"
            value={form.category}
            onChange={(e) =>
              setForm({ ...form, category: e.target.value })
            }
          >
            {categories.map((c) => (
              <option key={c.option_id} value={c.option_name}>
                {c.option_name}
              </option>
            ))}
          </select>

          <input
            className="input"
            placeholder="비용명"
            value={form.title}
            onChange={(e) =>
              setForm({ ...form, title: e.target.value })
            }
          />

          <input
            className="input"
            type="number"
            placeholder="금액"
            value={form.amount}
            onChange={(e) =>
              setForm({ ...form, amount: Number(e.target.value) })
            }
          />

          <label style={{ color: "white" }}>
            <input
              type="checkbox"
              checked={form.is_fixed}
              onChange={(e) =>
                setForm({ ...form, is_fixed: e.target.checked })
              }
            />{" "}
            고정비
          </label>

          <textarea
            className="input"
            placeholder="메모"
            value={form.memo}
            onChange={(e) =>
              setForm({ ...form, memo: e.target.value })
            }
            style={{ gridColumn: "1 / 5", minHeight: 80 }}
          />
        </div>

        <div className="row" style={{ marginTop: 14 }}>
          <button className="btn" onClick={saveExpense}>
            비용 등록
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>총 비용</h3>
        <div className="num">{totalExpense.toLocaleString()}원</div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>번호</th>
              {isAdminOrOwner && <th>지점</th>}
              <th>일자</th>
              <th>분류</th>
              <th>비용명</th>
              <th>금액</th>
              <th>고정비</th>
              <th>메모</th>
            </tr>
          </thead>

          <tbody>
            {expenses.map((e) => (
              <tr key={e.expense_id}>
                <td>{e.expense_id}</td>
                {isAdminOrOwner && <td>{e.branch_name}</td>}
                <td>{e.expense_date?.slice(0, 10)}</td>
                <td>{e.category}</td>
                <td style={{ fontWeight: 900 }}>{e.title}</td>
                <td style={{ color: "#ff4d6d", fontWeight: 900 }}>
                  {Number(e.amount).toLocaleString()}원
                </td>
                <td>{e.is_fixed === "Y" ? "고정비" : "-"}</td>
                <td>{e.memo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}