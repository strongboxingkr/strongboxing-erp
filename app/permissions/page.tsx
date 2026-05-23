"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";

const roles = [
  { key: "ADMIN", label: "관리자" },
  { key: "OWNER", label: "대표" },
  { key: "DIRECTOR", label: "관장" },
  { key: "COACH", label: "코치" },
];

export default function PermissionsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [selectedRole, setSelectedRole] = useState("ADMIN");

  const load = async () => {
    const res = await fetch("/api/permissions");
    const data = await res.json();
    setRows(data.rows || []);
  };

  useEffect(() => {
    load();
  }, []);

  const updatePermission = async (
    row: any,
    field: "can_view" | "can_create" | "can_update" | "can_delete"
  ) => {
    const newRow = {
      ...row,
      [field]: row[field] === "Y" ? "N" : "Y",
    };

    const res = await fetch("/api/permissions/update", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(newRow),
    });

    const data = await res.json();

    if (data.success) {
      load();
    } else {
      alert(data.message || "권한 수정 실패");
      console.log(data);
    }
  };

  const filteredRows = rows.filter((r) => r.role === selectedRole);

  return (
    <AppShell title="권한관리">
      <div className="card" style={{ marginBottom: 16 }}>
        <h2>역할별 메뉴 권한</h2>
        <p style={{ color: "#aaa" }}>
          역할을 선택한 뒤 메뉴별 권한을 체크하세요.
        </p>

        <div className="row" style={{ marginTop: 16 }}>
          {roles.map((role) => (
            <button
              key={role.key}
              className={selectedRole === role.key ? "btn" : "btn secondary"}
              onClick={() => setSelectedRole(role.key)}
            >
              {role.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2>
          {roles.find((r) => r.key === selectedRole)?.label} 권한 설정
        </h2>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>메뉴</th>
              <th>경로</th>
              <th>보기</th>
              <th>등록</th>
              <th>수정</th>
              <th>삭제</th>
            </tr>
          </thead>

          <tbody>
            {filteredRows.map((r) => (
              <tr key={r.permission_id}>
                <td style={{ fontWeight: 900 }}>{r.menu_name}</td>
                <td>{r.path}</td>

                <td>
                  <input
                    type="checkbox"
                    checked={r.can_view === "Y"}
                    onChange={() => updatePermission(r, "can_view")}
                  />
                </td>

                <td>
                  <input
                    type="checkbox"
                    checked={r.can_create === "Y"}
                    onChange={() => updatePermission(r, "can_create")}
                  />
                </td>

                <td>
                  <input
                    type="checkbox"
                    checked={r.can_update === "Y"}
                    onChange={() => updatePermission(r, "can_update")}
                  />
                </td>

                <td>
                  <input
                    type="checkbox"
                    checked={r.can_delete === "Y"}
                    onChange={() => updatePermission(r, "can_delete")}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}