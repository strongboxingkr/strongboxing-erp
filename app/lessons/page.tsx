"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { apiFetch } from "@/lib/api";

const today = new Date().toISOString().slice(0, 10);

const statuses = ["예약", "수업완료", "노쇼", "취소"];

export default function LessonsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [branch, setBranch] = useState("전체");
  const [user, setUser] = useState<any>(null);

  const [form, setForm] = useState({
    branch_name: "철산점",
    lesson_date: today,
    lesson_time: "",
    lesson_type: "PT",
    coach_name: "",
    member_name: "",
    phone: "",
    status: "예약",
    memo: "",
  });

  const getUser = () => {
    if (typeof window === "undefined") return null;

    const savedUser = localStorage.getItem("user");
    return savedUser ? JSON.parse(savedUser) : null;
  };

  const isAdminOrOwner =
    user?.role === "ADMIN" || user?.role === "OWNER";

  const loadBranches = async () => {
    const res = await apiFetch("/api/settings?option_type=BRANCH");
    const data = await res.json();
    setBranches(data.rows || []);

    if (data.rows?.length > 0) {
      setForm((prev) => ({
        ...prev,
        branch_name: data.rows[0].option_name,
      }));
    }
  };

  const load = async (currentUser = user) => {
    let url = "/api/lessons";

    if (currentUser && currentUser.role !== "ADMIN" && currentUser.role !== "OWNER") {
      url += `?branch_name=${encodeURIComponent(currentUser.branch_name)}`;
    } else if (branch !== "전체") {
      url += `?branch_name=${encodeURIComponent(branch)}`;
    }

    const res = await apiFetch(url);
    const data = await res.json();
    setRows(data.rows || []);
  };

  useEffect(() => {
    const savedUser = getUser();
    setUser(savedUser);

    loadBranches();
    load(savedUser);
  }, []);

  useEffect(() => {
    if (user) {
      load(user);
    }
  }, [branch, user]);

  const save = async () => {
    const targetForm = {
      ...form,
      branch_name:
        isAdminOrOwner ? form.branch_name : user?.branch_name || form.branch_name,
    };

    const res = await apiFetch("/api/lessons/add", {
      method: "POST",
      body: JSON.stringify(targetForm),
    });

    const data = await res.json();

    if (data.success) {
      alert("수업 등록 완료!");
      setForm({
        branch_name: branches[0]?.option_name || "철산점",
        lesson_date: today,
        lesson_time: "",
        lesson_type: "PT",
        coach_name: "",
        member_name: "",
        phone: "",
        status: "예약",
        memo: "",
      });
      load(user);
    } else {
      alert(data.message || "수업 등록 실패");
    }
  };

  const updateStatus = async (r: any, status: string) => {
    const res = await apiFetch("/api/lessons/update", {
      method: "POST",
      body: JSON.stringify({
        lesson_id: r.lesson_id,
        status,
        memo: r.memo || "",
      }),
    });

    const data = await res.json();

    if (data.success) {
      load(user);
    } else {
      alert(data.message || "상태 변경 실패");
    }
  };

  return (
    <AppShell title="PT / 수업 스케줄">
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 34, fontWeight: 900 }}>
          PT / 수업 스케줄
        </h1>
        <p style={{ color: "#aaa", marginTop: 8 }}>
          지점별 PT, 체험수업, 상담 일정을 관리합니다.
        </p>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2>수업 등록</h2>

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
            value={form.lesson_date}
            onChange={(e) =>
              setForm({ ...form, lesson_date: e.target.value })
            }
          />

          <input
            className="input"
            placeholder="시간 예: 19:00"
            value={form.lesson_time}
            onChange={(e) =>
              setForm({ ...form, lesson_time: e.target.value })
            }
          />

          <select
            className="input"
            value={form.lesson_type}
            onChange={(e) =>
              setForm({ ...form, lesson_type: e.target.value })
            }
          >
            <option>PT</option>
            <option>체험수업</option>
            <option>상담</option>
            <option>그룹수업</option>
          </select>

          <input
            className="input"
            placeholder="코치명"
            value={form.coach_name}
            onChange={(e) =>
              setForm({ ...form, coach_name: e.target.value })
            }
          />

          <input
            className="input"
            placeholder="회원명/예약자명"
            value={form.member_name}
            onChange={(e) =>
              setForm({ ...form, member_name: e.target.value })
            }
          />

          <input
            className="input"
            placeholder="연락처"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />

          <select
            className="input"
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
          >
            {statuses.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>

          <textarea
            className="input"
            placeholder="메모"
            value={form.memo}
            onChange={(e) => setForm({ ...form, memo: e.target.value })}
            style={{ gridColumn: "1 / 5", minHeight: 80 }}
          />
        </div>

        <div className="row" style={{ marginTop: 14 }}>
          <button className="btn" onClick={save}>
            수업 등록
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row">
          <h2 style={{ marginRight: 12 }}>수업 목록</h2>

          {isAdminOrOwner && (
            <select
              className="input"
              style={{ width: 180 }}
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
            >
              <option>전체</option>
              {branches.map((b) => (
                <option key={b.option_id}>{b.option_name}</option>
              ))}
            </select>
          )}

          <button className="btn secondary" onClick={() => load(user)}>
            새로고침
          </button>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>날짜</th>
              <th>시간</th>
              <th>지점</th>
              <th>구분</th>
              <th>코치</th>
              <th>회원/예약자</th>
              <th>연락처</th>
              <th>상태</th>
              <th>메모</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((r) => (
              <tr key={r.lesson_id}>
                <td>{r.lesson_date?.slice(0, 10)}</td>
                <td style={{ fontWeight: 900 }}>{r.lesson_time}</td>
                <td>{r.branch_name}</td>
                <td>{r.lesson_type}</td>
                <td>{r.coach_name}</td>
                <td style={{ fontWeight: 900 }}>{r.member_name}</td>
                <td>{r.phone}</td>
                <td>
                  <select
                    className="input"
                    value={r.status}
                    onChange={(e) => updateStatus(r, e.target.value)}
                  >
                    {statuses.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
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