"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";

export default function CrmAlertsPage() {
  const [rows, setRows] = useState<any[]>([]);

  const load = async () => {
    const savedUser = localStorage.getItem("user");
    const user = savedUser ? JSON.parse(savedUser) : null;

    let url = "/api/crm-alerts";

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
    <AppShell title="재연락 상담 알림">
      <div className="card" style={{ marginBottom: 16 }}>
        <h2>오늘 재연락해야 할 상담</h2>
        <p style={{ color: "#aaa" }}>
          재연락일이 오늘이거나 지난 상담 목록입니다.
        </p>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>번호</th>
              <th>지점</th>
              <th>이름</th>
              <th>전화번호</th>
              <th>상태</th>
              <th>유입</th>
              <th>재연락일</th>
              <th>메모</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((r) => (
              <tr key={r.lead_id}>
                <td>{r.lead_id}</td>
                <td>{r.branch_name}</td>
                <td style={{ fontWeight: 900 }}>{r.customer_name}</td>
                <td>{r.phone}</td>
                <td style={{ color: "#f72585", fontWeight: 900 }}>
                  {r.status}
                </td>
                <td>{r.inquiry_channel}</td>
                <td>{r.next_contact_date?.slice(0, 10)}</td>
                <td>{r.memo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}