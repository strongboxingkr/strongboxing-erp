"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";

const branches = ["철산점", "목동점", "개봉점", "신정점"];

const roleLabel = (role: string) => {
  if (role === "OWNER") return "대표";
  if (role === "MANAGER") return "관장";
  return role;
};

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);

  const [form, setForm] = useState({
    login_id: "",
    password: "",
    name: "",
    role: "MANAGER",
    branch_name: "철산점",
  });

  const loadUsers = async () => {
    const res = await fetch("/api/users");
    const data = await res.json();
    setUsers(data.rows || []);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const saveUser = async () => {
    if (!form.login_id.trim()) {
      alert("아이디를 입력해주세요.");
      return;
    }

    if (!form.password.trim()) {
      alert("비밀번호를 입력해주세요.");
      return;
    }

    if (!form.name.trim()) {
      alert("이름을 입력해주세요.");
      return;
    }

    if (form.role === "MANAGER" && !form.branch_name) {
      alert("관장 계정은 지점을 선택해주세요.");
      return;
    }

    const payload = {
      ...form,
      branch_name: form.role === "OWNER" ? "" : form.branch_name,
    };

    const res = await fetch("/api/users/add", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (data.success) {
      alert("계정 생성 완료!");

      setForm({
        login_id: "",
        password: "",
        name: "",
        role: "MANAGER",
        branch_name: "철산점",
      });

      loadUsers();
    } else {
      alert(data.message || "계정 생성 실패");
      console.log(data);
    }
  };

  return (
    <AppShell title="계정관리">
      <div className="card" style={{ marginBottom: 16 }}>
        <h2>계정 생성</h2>

        <p style={{ color: "#aaa", marginTop: -4 }}>
          대표는 전체 지점 권한, 관장은 선택한 지점 권한으로 생성됩니다.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, 1fr)",
            gap: 12,
          }}
        >
          <input
            className="input"
            placeholder="아이디"
            value={form.login_id}
            onChange={(e) =>
              setForm({
                ...form,
                login_id: e.target.value,
              })
            }
          />

          <input
            className="input"
            type="password"
            placeholder="비밀번호"
            value={form.password}
            onChange={(e) =>
              setForm({
                ...form,
                password: e.target.value,
              })
            }
          />

          <input
            className="input"
            placeholder="이름"
            value={form.name}
            onChange={(e) =>
              setForm({
                ...form,
                name: e.target.value,
              })
            }
          />

          <select
            className="input"
            value={form.role}
            onChange={(e) =>
              setForm({
                ...form,
                role: e.target.value,
                branch_name:
                  e.target.value === "OWNER" ? "" : form.branch_name || "철산점",
              })
            }
          >
            <option value="OWNER">대표</option>
            <option value="MANAGER">관장</option>
          </select>

          <select
            className="input"
            value={form.branch_name}
            disabled={form.role === "OWNER"}
            onChange={(e) =>
              setForm({
                ...form,
                branch_name: e.target.value,
              })
            }
          >
            {form.role === "OWNER" && <option value="">전체지점</option>}

            {branches.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
        </div>

        <div className="row" style={{ marginTop: 14 }}>
          <button className="btn" onClick={saveUser}>
            계정 생성
          </button>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>번호</th>
              <th>아이디</th>
              <th>이름</th>
              <th>권한</th>
              <th>지점</th>
              <th>사용여부</th>
              <th>생성일</th>
            </tr>
          </thead>

          <tbody>
            {users.map((u) => (
              <tr key={u.user_id}>
                <td>{u.user_id}</td>

                <td style={{ fontWeight: 900 }}>{u.login_id}</td>

                <td>{u.name}</td>

                <td>{roleLabel(u.role)}</td>

                <td>{u.role === "OWNER" ? "전체지점" : u.branch_name}</td>

                <td>{u.use_yn === "Y" ? "사용중" : "중지"}</td>

                <td>{u.created_at?.slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}