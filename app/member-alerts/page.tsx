"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";

export default function MemberAlertsPage() {
  const [rows, setRows] = useState<any[]>([]);

  const load = async () => {
    const savedUser = localStorage.getItem("user");
    const user = savedUser ? JSON.parse(savedUser) : null;

    let url = "/api/member-alerts";

    if (user && user.role !== "ADMIN" && user.role !== "OWNER") {
      url += `?branch_name=${encodeURIComponent(user.branch_name)}`;
    }

    const res = await fetch(url);
    const data = await res.json();
    setRows(data.rows || []);
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <AppShell title="회원 알림">
      <div className="card" style={{ marginBottom: 16 }}>
        <h2>만료 예정 / 횟수 부족 회원</h2>
        <p style={{ color: "#aaa" }}>만료 7일 이내 또는 횟수 3회 이하 회원</p>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>알림</th>
              <th>지점</th>
              <th>이름</th>
              <th>전화번호</th>
              <th>상품</th>
              <th>구분</th>
              <th>남은횟수</th>
              <th>만료일</th>
              <th>메모</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((m) => (
              <tr key={m.member_id}>
                <td style={{ color: "#ff4d6d", fontWeight: 900 }}>
                  {m.alert_type}
                </td>
                <td>{m.branch_name}</td>
                <td style={{ fontWeight: 900 }}>{m.name}</td>
                <td>{m.phone}</td>
                <td>{m.product_name}</td>
                <td>{m.pass_type === "COUNT" ? "횟수권" : "기간권"}</td>
                <td>{m.pass_type === "COUNT" ? m.remaining_count : "기간권"}</td>
                <td>{m.end_date?.slice(0, 10)}</td>
                <td>{m.memo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}