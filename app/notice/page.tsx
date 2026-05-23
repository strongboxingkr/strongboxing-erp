"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { apiFetch } from "@/lib/api";

export default function NoticePage() {
  const [rows, setRows] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);

  const [form, setForm] = useState({
    branch_name: "전체",
    title: "",
    content: "",
  });

useEffect(() => {
  if (typeof window !== "undefined") {
    const savedUser = localStorage.getItem("user");

    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }
}, []);

const isAdminOrOwner =
  user?.role === "ADMIN" || user?.role === "OWNER";

  const loadBranches = async () => {
    const res = await apiFetch("/api/settings?option_type=BRANCH");
    const data = await res.json();
    setBranches(data.rows || []);
  };

  const load = async () => {
    const res = await apiFetch("/api/notices");
    const data = await res.json();
    setRows(data.rows || []);
  };

  useEffect(() => {
    loadBranches();
    load();
  }, []);

  const save = async () => {
    if (!form.title.trim()) {
      alert("제목을 입력해주세요.");
      return;
    }

    const res = await apiFetch("/api/notices/add", {
      method: "POST",
      body: JSON.stringify(form),
    });

    const data = await res.json();

    if (data.success) {
      alert("공지 등록 완료!");
      setForm({
        branch_name: "전체",
        title: "",
        content: "",
      });
      load();
    } else {
      alert(data.message || "공지 등록 실패");
    }
  };

  const remove = async (notice_id: number) => {
    if (!confirm("공지사항을 삭제할까요?")) return;

    const res = await apiFetch("/api/notices/delete", {
      method: "POST",
      body: JSON.stringify({ notice_id }),
    });

    const data = await res.json();

    if (data.success) {
      alert("삭제 완료!");
      load();
    } else {
      alert(data.message || "삭제 실패");
    }
  };

  return (
    <AppShell title="공지사항">
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 34, fontWeight: 900 }}>
          공지사항
        </h1>
        <p style={{ color: "#aaa", marginTop: 8 }}>
          전체 또는 지점별 공지를 등록하고 확인합니다.
        </p>
      </div>

      {isAdminOrOwner && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h2>공지 등록</h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "180px 1fr auto",
              gap: 12,
              marginBottom: 12,
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
              <option>전체</option>
              {branches.map((b) => (
                <option key={b.option_id}>{b.option_name}</option>
              ))}
            </select>

            <input
              className="input"
              placeholder="공지 제목"
              value={form.title}
              onChange={(e) =>
                setForm({
                  ...form,
                  title: e.target.value,
                })
              }
            />

            <button className="btn" onClick={save}>
              등록
            </button>
          </div>

          <textarea
            className="input"
            placeholder="공지 내용을 입력하세요."
            value={form.content}
            onChange={(e) =>
              setForm({
                ...form,
                content: e.target.value,
              })
            }
            style={{ minHeight: 120 }}
          />
        </div>
      )}

      <div style={{ display: "grid", gap: 14 }}>
        {rows.map((n) => (
          <div
            className="card"
            key={n.notice_id}
            style={{
              borderLeft:
                n.branch_name === "전체"
                  ? "6px solid #2ee59d"
                  : "6px solid #5da9ff",
            }}
          >
            <div
              className="row"
              style={{
                justifyContent: "space-between",
                alignItems: "flex-start",
              }}
            >
              <div>
                <div
                  style={{
                    display: "inline-block",
                    padding: "6px 12px",
                    borderRadius: 999,
                    background:
                      n.branch_name === "전체"
                        ? "rgba(46,229,157,0.15)"
                        : "rgba(93,169,255,0.15)",
                    color: n.branch_name === "전체" ? "#2ee59d" : "#5da9ff",
                    fontWeight: 900,
                    marginBottom: 10,
                  }}
                >
                  {n.branch_name}
                </div>

                <h2 style={{ margin: "0 0 8px 0" }}>{n.title}</h2>

                <div style={{ color: "#aaa", marginBottom: 12 }}>
                  작성자 {n.created_by || "-"} /{" "}
                  {n.created_at?.slice(0, 16).replace("T", " ")}
                </div>

                <div
                  style={{
                    whiteSpace: "pre-wrap",
                    lineHeight: 1.7,
                  }}
                >
                  {n.content}
                </div>
              </div>

              {isAdminOrOwner && (
                <button
                  className="btn secondary"
                  onClick={() => remove(n.notice_id)}
                >
                  삭제
                </button>
              )}
            </div>
          </div>
        ))}

        {rows.length === 0 && (
          <div className="card">
            <p style={{ color: "#aaa" }}>등록된 공지사항이 없습니다.</p>
          </div>
        )}
      </div>
    </AppShell>
  );
}