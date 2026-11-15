"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { apiFetch } from "@/lib/api";

export default function MemberAlertsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [days, setDays] = useState(7);
  const [branch, setBranch] = useState("");
  const [branches, setBranches] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);

  const isAdminOrOwner = (role: string) => role === "ADMIN" || role === "OWNER";

  const load = async (u: any, d: number, b: string) => {
    const params = new URLSearchParams();
    params.set("days", String(d));
    const resolvedBranch = isAdminOrOwner(u?.role) ? b : u?.branch_name;
    if (resolvedBranch) params.set("branch_name", resolvedBranch);
    const res = await apiFetch(`/api/member-alerts?${params}`);
    const data = await res.json();
    setRows(data.rows || []);
  };

  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    const u = savedUser ? JSON.parse(savedUser) : null;
    setUser(u);
    if (isAdminOrOwner(u?.role)) {
      apiFetch("/api/options?category=branch").then(r => r.json()).then(d => setBranches(d.options || []));
    }
    load(u, 7, "");
  }, []);

  const handleFilter = (newDays: number, newBranch: string) => {
    setDays(newDays);
    setBranch(newBranch);
    load(user, newDays, newBranch);
  };

  const daysOptions = [3, 7, 14, 30];

  return (
    <AppShell title="회원 알림">
      {/* 필터 */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
        {isAdminOrOwner(user?.role) && (
          <select className="input" style={{ width: "auto", minWidth: 110 }} value={branch}
            onChange={(e) => handleFilter(days, e.target.value)}>
            <option value="">전체 지점</option>
            {branches.map((b: any) => (
              <option key={b.option_id} value={b.option_name}>{b.option_name}</option>
            ))}
          </select>
        )}
        <div style={{ display: "flex", gap: 4 }}>
          {daysOptions.map(d => (
            <button key={d}
              className={days === d ? "btn" : "btn secondary"}
              style={{ fontSize: 12, padding: "0 12px", height: 32 }}
              onClick={() => handleFilter(d, branch)}
            >{d}일</button>
          ))}
        </div>
        <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: 4 }}>
          기간권 만료 {days}일 이내 · 횟수권 2회 이하 · 총 {rows.length}명
        </span>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>지점</th>
              <th>이름</th>
              <th>전화번호</th>
              <th>상품</th>
              <th>구분</th>
              <th>남은횟수</th>
              <th>만료일</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--muted)", padding: 32 }}>해당 회원 없음</td></tr>
            )}
            {rows.map((m) => (
              <tr key={m.member_id} style={{ cursor: "pointer" }}
                onClick={() => { location.href = `/member-detail?member_id=${m.member_id}`; }}>
                <td>{m.branch_name}</td>
                <td style={{ fontWeight: 700 }}>{m.name}</td>
                <td>{m.phone}</td>
                <td>{m.product_name || "-"}</td>
                <td>{m.pass_type === "COUNT" ? "횟수권" : "기간권"}</td>
                <td style={{ color: m.pass_type === "COUNT" && m.remaining_count <= 2 ? "#ff4d6d" : undefined, fontWeight: 700 }}>
                  {m.pass_type === "COUNT" ? `${m.remaining_count}회` : "-"}
                </td>
                <td style={{ color: m.pass_type === "PERIOD" ? "#f59e0b" : undefined }}>
                  {m.end_date?.slice(0, 10) || "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
