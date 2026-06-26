"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";

const optionTypes = [
  { value: "BRANCH", label: "지점" },
  { value: "EXPENSE_CATEGORY", label: "비용분류" },
  { value: "CRM_CHANNEL", label: "상담유입경로" },
  { value: "PASS_PRODUCT", label: "회원권상품" },
  { value: "COACH", label: "코치" },
  { value: "SALARY_TYPE", label: "급여유형" },
];

export default function SettingsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [selectedType, setSelectedType] = useState("BRANCH");
  const [autoSms, setAutoSms] = useState<any>(null);

  const loadAutoSms = async () => {
    const res = await fetch("/api/settings?option_type=AUTO_SMS");
    const data = await res.json();
    if (data.rows?.length > 0) setAutoSms(data.rows[0]);
  };

  const toggleAutoSms = async () => {
    if (!autoSms) return;
    const newVal = autoSms.option_value === "ON" ? "OFF" : "ON";
    await fetch("/api/settings/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ option_id: autoSms.option_id, option_value: newVal }),
    });
    setAutoSms({ ...autoSms, option_value: newVal });
  };

  useEffect(() => { loadAutoSms(); }, []);

  const [form, setForm] = useState({
    option_name: "",
    option_value: "",
    sort_order: 0,
    amount: 0,
    duration_months: 0,
    count_value: 0,
  });

  const load = async () => {
    const res = await fetch(`/api/settings?option_type=${selectedType}`);
    const data = await res.json();
    setRows(data.rows || []);
  };

  useEffect(() => {
    load();
  }, [selectedType]);

  const save = async () => {
    const res = await fetch("/api/settings/add", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        option_type: selectedType,
        option_name: form.option_name,
        option_value: form.option_value || form.option_name,
        sort_order: form.sort_order,
        amount: form.amount,
        duration_months: form.duration_months,
        count_value: form.count_value,
      }),
    });

    const data = await res.json();

    if (data.success) {
      alert("설정 추가 완료!");

      setForm({
        option_name: "",
        option_value: "",
        sort_order: 0,
        amount: 0,
        duration_months: 0,
        count_value: 0,
      });

      load();
    } else {
      alert(data.message || "설정 추가 실패");
    }
  };

  const remove = async (option_id: number) => {
    if (!confirm("삭제할까요?")) return;

    const res = await fetch("/api/settings/delete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ option_id }),
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
    <AppShell title="설정관리">
      {/* 자동 SMS 설정 */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 16 }}>만료 7일 전 자동 SMS</div>
            <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>
              회원권 만료 7일 전에 자동으로 문자를 발송합니다.
            </div>
          </div>
          {autoSms && (
            <div
              onClick={toggleAutoSms}
              style={{
                width: 52, height: 28, borderRadius: 999, cursor: "pointer",
                background: autoSms.option_value === "ON" ? "var(--accent)" : "#d1d5db",
                position: "relative", transition: "background 0.2s",
              }}
            >
              <div style={{
                position: "absolute", top: 3,
                left: autoSms.option_value === "ON" ? 26 : 3,
                width: 22, height: 22, borderRadius: "50%", background: "white",
                transition: "left 0.2s",
              }} />
            </div>
          )}
          {!autoSms && (
            <span style={{ color: "var(--muted)", fontSize: 13 }}>DB 설정 필요 (아래 SQL 참고)</span>
          )}
        </div>
        {!autoSms && (
          <div style={{ marginTop: 10, padding: "8px 12px", background: "var(--panel2)", borderRadius: 8, fontSize: 12, color: "var(--muted)", fontFamily: "monospace" }}>
            INSERT INTO settings_options (option_type, option_name, option_value, use_yn, sort_order) VALUES ('AUTO_SMS', '만료 7일 전 자동 SMS', 'OFF', 'Y', 1);
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2>설정 분류</h2>

        <div className="row" style={{ flexWrap: "wrap" }}>
          {optionTypes.map((type) => (
            <button
              key={type.value}
              className={selectedType === type.value ? "btn" : "btn secondary"}
              onClick={() => setSelectedType(type.value)}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2>
          {optionTypes.find((t) => t.value === selectedType)?.label} 추가
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 2fr 1fr auto",
            gap: 12,
          }}
        >
          <input
            className="input"
            placeholder="표시명 예: 1개월 기간권"
            value={form.option_name}
            onChange={(e) =>
              setForm({
                ...form,
                option_name: e.target.value,
              })
            }
          />

          <input
            className="input"
            placeholder="값 예: PERIOD / COUNT"
            value={form.option_value}
            onChange={(e) =>
              setForm({
                ...form,
                option_value: e.target.value,
              })
            }
          />

          <input
            className="input"
            type="number"
            placeholder="순서"
            value={form.sort_order}
            onChange={(e) =>
              setForm({
                ...form,
                sort_order: Number(e.target.value),
              })
            }
          />

          <button className="btn" onClick={save}>
            추가
          </button>

          {selectedType === "PASS_PRODUCT" && (
            <>
              <input
                className="input"
                type="number"
                placeholder="금액"
                value={form.amount}
                onChange={(e) =>
                  setForm({
                    ...form,
                    amount: Number(e.target.value),
                  })
                }
              />

              <input
                className="input"
                type="number"
                placeholder="기간 개월 예: 1, 3"
                value={form.duration_months}
                onChange={(e) =>
                  setForm({
                    ...form,
                    duration_months: Number(e.target.value),
                  })
                }
              />

              <input
                className="input"
                type="number"
                placeholder="횟수 예: 12, 36"
                value={form.count_value}
                onChange={(e) =>
                  setForm({
                    ...form,
                    count_value: Number(e.target.value),
                  })
                }
              />
            </>
          )}
        </div>

        {selectedType === "PASS_PRODUCT" && (
          <p style={{ color: "#aaa", marginTop: 12 }}>
            기간권은 값에 PERIOD, 횟수권은 COUNT를 넣어. 기간권은 개월 수,
            횟수권은 횟수를 입력하면 결제/회원권에 자동 반영돼.
          </p>
        )}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>번호</th>
              <th>분류</th>
              <th>표시명</th>
              <th>값</th>
              <th>금액</th>
              <th>개월</th>
              <th>횟수</th>
              <th>순서</th>
              <th>관리</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((r) => (
              <tr key={r.option_id}>
                <td>{r.option_id}</td>
                <td>{r.option_type}</td>
                <td style={{ fontWeight: 900 }}>{r.option_name}</td>
                <td>{r.option_value}</td>
                <td>{Number(r.amount || 0).toLocaleString()}원</td>
                <td>{r.duration_months || 0}</td>
                <td>{r.count_value || 0}</td>
                <td>{r.sort_order}</td>
                <td>
                  <button
                    className="btn secondary"
                    onClick={() => remove(r.option_id)}
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