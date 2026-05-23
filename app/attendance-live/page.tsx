"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { apiFetch } from "@/lib/api";

export default function AttendanceLivePage() {
  const [data, setData] = useState<any>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [branch, setBranch] = useState("전체");
  const [user, setUser] = useState<any>(null);

  const getUser = () => {
    if (typeof window === "undefined") return null;

    const savedUser = localStorage.getItem("user");
    return savedUser ? JSON.parse(savedUser) : null;
  };

  const isAdminOrOwner = user?.role === "ADMIN" || user?.role === "OWNER";

  const loadBranches = async () => {
    const res = await apiFetch("/api/settings?option_type=BRANCH");
    const json = await res.json();
    setBranches(json.rows || []);
  };

  const load = async (currentUser = user) => {
    let url = "/api/attendance/live";

    if (
      currentUser &&
      currentUser.role !== "ADMIN" &&
      currentUser.role !== "OWNER"
    ) {
      url += `?branch_name=${encodeURIComponent(currentUser.branch_name)}`;
    } else if (branch !== "전체") {
      url += `?branch_name=${encodeURIComponent(branch)}`;
    }

    const res = await apiFetch(url);
    const json = await res.json();
    setData(json);
  };

  useEffect(() => {
    const savedUser = getUser();
    setUser(savedUser);

    loadBranches();
    load(savedUser);

    const timer = setInterval(() => {
      load(savedUser);
    }, 10000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (user) {
      load(user);
    }
  }, [branch, user]);

  if (!data) {
    return <AppShell title="실시간 출석">로딩중...</AppShell>;
  }

  return (
    <AppShell title="실시간 출석">
      <div
        className="row"
        style={{
          justifyContent: "space-between",
          marginBottom: 20,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 34, fontWeight: 900 }}>
            실시간 출석 현황
          </h1>
          <p style={{ color: "#aaa", marginTop: 8 }}>
            오늘 출석한 회원을 실시간으로 확인합니다.
          </p>
        </div>

        <div className="row">
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

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
          marginBottom: 16,
        }}
      >
        <div className="card">
          <h3>오늘 출석</h3>
          <div className="num">{data.total || 0}명</div>
        </div>

        {(data.branches || []).map((b: any) => (
          <div className="card" key={b.branch_name}>
            <h3>{b.branch_name}</h3>
            <div className="num">{b.count || 0}명</div>
          </div>
        ))}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>출석시간</th>
              <th>지점</th>
              <th>회원명</th>
              <th>전화번호</th>
              <th>회원권</th>
              <th>구분</th>
              <th>남은횟수</th>
              <th>만료일</th>
            </tr>
          </thead>

          <tbody>
            {(data.rows || []).map((r: any) => (
              <tr key={r.attendance_id}>
                <td style={{ fontWeight: 900 }}>
                  {r.checkin_time?.slice(11, 19)}
                </td>
                <td>{r.branch_name}</td>
                <td style={{ fontWeight: 900, fontSize: 18 }}>{r.name}</td>
                <td>{r.phone}</td>
                <td>{r.product_name}</td>
                <td>{r.pass_type === "COUNT" ? "횟수권" : "기간권"}</td>
                <td>{r.pass_type === "COUNT" ? r.remaining_count : "-"}</td>
                <td>{r.end_date?.slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}