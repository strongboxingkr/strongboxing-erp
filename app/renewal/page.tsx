"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { apiFetch } from "@/lib/api";

const branches = ["철산점", "목동점", "개봉점", "신정점"];

export default function RenewalPage() {
  const [branch, setBranch] = useState("철산점");
  const [rows, setRows] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [message, setMessage] = useState("");

  const loadRows = async () => {
    const res = await apiFetch(
      `/api/member-alerts?branch_name=${encodeURIComponent(branch)}`
    );
    const data = await res.json();

    setRows(data.rows || []);
    setSelectedIds((data.rows || []).map((r: any) => r.member_id));
  };

  useEffect(() => {
    loadRows();
  }, [branch]);

  useEffect(() => {
    setMessage(`[스트롱복싱 ${branch}]
회원권 만료 또는 잔여횟수가 얼마 남지 않았습니다.

재등록 상담이 필요하시면 편하게 문의주세요 🥊`);
  }, [branch]);

  const toggle = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const sendSms = async () => {
    if (selectedIds.length === 0) {
      alert("발송 대상을 선택해주세요.");
      return;
    }

    if (!message.trim()) {
      alert("문자 내용을 입력해주세요.");
      return;
    }

    const ok = confirm(`${selectedIds.length}명에게 문자를 발송할까요?`);
    if (!ok) return;

    const res = await apiFetch("/api/sms/send", {
      method: "POST",
      body: JSON.stringify({
        branch_name: branch,
        message,
        selected_members: selectedIds,
        is_test: false,
      }),
    });

    const data = await res.json();

    if (data.success) {
      alert(`문자 발송 완료! ${data.sent_count}건`);
    } else {
      alert(data.message || "문자 발송 실패");
    }
  };

  return (
    <AppShell title="재등록 관리">
      <div className="card" style={{ marginBottom: 18, borderRadius: 24 }}>
        <h1 style={{ margin: 0, fontSize: 34, fontWeight: 900 }}>
          재등록 관리
        </h1>
        <p style={{ color: "#888", marginTop: 8 }}>
          만료 임박 / 횟수 부족 회원을 확인하고 문자 발송합니다.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 420px",
          gap: 18,
          alignItems: "start",
        }}
      >
        <div className="card" style={{ borderRadius: 24 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <select
              className="input"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              style={{ width: 180 }}
            >
              {branches.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="btn secondary"
                onClick={() => setSelectedIds(rows.map((r) => r.member_id))}
              >
                전체선택
              </button>
              <button className="btn secondary" onClick={() => setSelectedIds([])}>
                전체해제
              </button>
              <button className="btn secondary" onClick={loadRows}>
                새로고침
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            {rows.map((m) => (
              <div
                key={m.member_id}
                style={{
                  background: "#111827",
                  borderRadius: 18,
                  padding: 16,
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontSize: 20, fontWeight: 900 }}>{m.name}</div>
                  <div style={{ color: "#888", marginTop: 6 }}>{m.phone}</div>
                  <div style={{ color: "#aaa", marginTop: 8, fontSize: 13 }}>
                    {m.product_name} / 만료일 {m.end_date?.slice(0, 10)} / 남은횟수{" "}
                    {m.remaining_count}
                  </div>
                </div>

                <input
                  type="checkbox"
                  checked={selectedIds.includes(m.member_id)}
                  onChange={() => toggle(m.member_id)}
                  style={{ width: 22, height: 22 }}
                />
              </div>
            ))}

            {rows.length === 0 && (
              <div style={{ color: "#888" }}>관리 대상 회원이 없습니다.</div>
            )}
          </div>
        </div>

        <div className="card" style={{ borderRadius: 24, position: "sticky", top: 20 }}>
          <h2 style={{ marginTop: 0 }}>문자 미리보기</h2>

          <div style={{ color: "#aaa", marginBottom: 10 }}>
            선택 {selectedIds.length}명
          </div>

          <textarea
            className="input"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            style={{ width: "100%", minHeight: 260, marginBottom: 14 }}
          />

          <button className="btn" onClick={sendSms} style={{ width: "100%" }}>
            선택 회원 문자 발송
          </button>
        </div>
      </div>
    </AppShell>
  );
}