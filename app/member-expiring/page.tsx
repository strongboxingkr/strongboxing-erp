"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { apiFetch } from "@/lib/api";

export default function MemberExpiringPage() {
  const [rows, setRows] = useState<any[]>([]);
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
    const data = await res.json();
    setBranches(data.rows || []);
  };

  const load = async (currentUser = user) => {
    let url = "/api/member-alerts";

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

  const getColor = (type: string) => {
    if (!type) return "#9ca3af";
    if (type.includes("오늘")) return "#ef4444";
    if (type.includes("3일")) return "#f59e0b";
    if (type.includes("7일")) return "#3b82f6";
    if (type.includes("횟수")) return "#8b5cf6";

    return "#9ca3af";
  };

  return (
    <AppShell title="회원권 만료 알림">
      <div
        className="row"
        style={{
          justifyContent: "space-between",
          marginBottom: 20,
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 34,
              fontWeight: 900,
            }}
          >
            회원권 만료 알림
          </h1>

          <p style={{ color: "#aaa", marginTop: 8 }}>
            만료 예정 회원 및 관리 필요 회원
          </p>
        </div>

        {isAdminOrOwner && (
          <select
            className="input"
            style={{ width: 220 }}
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
          >
            <option>전체</option>

            {branches.map((b) => (
              <option key={b.option_id}>{b.option_name}</option>
            ))}
          </select>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gap: 14,
        }}
      >
        {rows.map((r) => (
          <div
            key={r.member_id}
            className="card"
            style={{
              borderLeft: `6px solid ${getColor(r.alert_type)}`,
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.3fr 1fr 1fr 1fr auto",
                gap: 12,
                alignItems: "center",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 900,
                  }}
                >
                  {r.name}
                </div>

                <div
                  style={{
                    color: "#aaa",
                    marginTop: 6,
                  }}
                >
                  {r.phone}
                </div>
              </div>

              <div>
                <div style={{ color: "#aaa" }}>지점</div>

                <div
                  style={{
                    fontWeight: 900,
                    marginTop: 6,
                  }}
                >
                  {r.branch_name}
                </div>
              </div>

              <div>
                <div style={{ color: "#aaa" }}>회원권</div>

                <div
                  style={{
                    fontWeight: 900,
                    marginTop: 6,
                  }}
                >
                  {r.product_name}
                </div>
              </div>

              <div>
                <div style={{ color: "#aaa" }}>만료일</div>

                <div
                  style={{
                    fontWeight: 900,
                    marginTop: 6,
                  }}
                >
                  {r.end_date?.slice(0, 10)}
                </div>
              </div>

              <div
                style={{
                  padding: "8px 14px",
                  borderRadius: 12,
                  background: `${getColor(r.alert_type)}22`,
                  color: getColor(r.alert_type),
                  fontWeight: 900,
                }}
              >
                {r.alert_type}
              </div>
            </div>
          </div>
        ))}

        {rows.length === 0 && (
          <div className="card">
            <p style={{ color: "#aaa" }}>관리 필요 회원이 없습니다.</p>
          </div>
        )}
      </div>
    </AppShell>
  );
}