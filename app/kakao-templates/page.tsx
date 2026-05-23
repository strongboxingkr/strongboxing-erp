"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { apiFetch } from "@/lib/api";

export default function KakaoTemplatesPage() {
  const [rows, setRows] = useState<any[]>([]);

  const [form, setForm] = useState({
    template_code: "",
    template_name: "",
    message: "",
  });

  const load = async () => {
    const res = await apiFetch("/api/kakao-templates");
    const data = await res.json();
    setRows(data.rows || []);
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    if (!form.template_code || !form.template_name || !form.message) {
      alert("템플릿 코드, 이름, 내용을 모두 입력해주세요.");
      return;
    }

    const res = await apiFetch("/api/kakao-templates/add", {
      method: "POST",
      body: JSON.stringify(form),
    });

    const data = await res.json();

    if (data.success) {
      alert("템플릿 추가 완료!");

      setForm({
        template_code: "",
        template_name: "",
        message: "",
      });

      load();
    } else {
      alert(data.message || "템플릿 추가 실패");
    }
  };

  const remove = async (template_id: number) => {
    if (!confirm("템플릿을 삭제할까요?")) return;

    const res = await apiFetch("/api/kakao-templates/delete", {
      method: "POST",
      body: JSON.stringify({ template_id }),
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
    <AppShell title="알림톡 템플릿">
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 34, fontWeight: 900 }}>
          알림톡 템플릿
        </h1>
        <p style={{ color: "#aaa", marginTop: 8 }}>
          카카오 알림톡 발송에 사용할 템플릿을 관리합니다.
        </p>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2>템플릿 추가</h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr auto",
            gap: 12,
            marginBottom: 12,
          }}
        >
          <input
            className="input"
            placeholder="템플릿 코드 예: EXPIRING_7DAYS"
            value={form.template_code}
            onChange={(e) =>
              setForm({
                ...form,
                template_code: e.target.value,
              })
            }
          />

          <input
            className="input"
            placeholder="템플릿 이름 예: 만료 7일 전"
            value={form.template_name}
            onChange={(e) =>
              setForm({
                ...form,
                template_name: e.target.value,
              })
            }
          />

          <button className="btn" onClick={save}>
            추가
          </button>
        </div>

        <textarea
          className="input"
          placeholder="알림톡 내용"
          value={form.message}
          onChange={(e) =>
            setForm({
              ...form,
              message: e.target.value,
            })
          }
          style={{ minHeight: 140 }}
        />
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>번호</th>
              <th>코드</th>
              <th>이름</th>
              <th>내용</th>
              <th>관리</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((r) => (
              <tr key={r.template_id}>
                <td>{r.template_id}</td>
                <td style={{ fontWeight: 900 }}>{r.template_code}</td>
                <td>{r.template_name}</td>
                <td style={{ whiteSpace: "pre-wrap" }}>{r.message}</td>
                <td>
                  <button
                    className="btn secondary"
                    onClick={() => remove(r.template_id)}
                  >
                    삭제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}