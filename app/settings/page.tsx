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
  const [alertPhones, setAlertPhones] = useState<any[]>([]);
  const [alertPhoneForm, setAlertPhoneForm] = useState({ branch: "", phone: "" });
  const [alertPhoneEditing, setAlertPhoneEditing] = useState<number | null>(null);
  const [alertPhoneEditVal, setAlertPhoneEditVal] = useState("");

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

  const loadAlertPhones = async () => {
    const res = await fetch("/api/settings?option_type=RESERVATION_ALERT_PHONE");
    const data = await res.json();
    setAlertPhones(data.rows || []);
  };

  useEffect(() => { loadAutoSms(); loadAlertPhones(); }, []);

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

      {/* 예약 알림 수신 번호 */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ marginBottom: 12 }}>📢 예약 알림 수신 번호</h2>
        <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 14 }}>
          예약 캘린더에서 '관장에게 예약 알림' 발송 시 수신할 지점별 번호를 설정합니다.<br />
          고객 연락처와 별개입니다. 지점당 하나만 설정하세요.
        </p>

        {/* 목록 */}
        {alertPhones.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 14 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--border)" }}>
                <th style={{ padding: "6px 10px", textAlign: "left", color: "var(--muted)", fontWeight: 700 }}>지점</th>
                <th style={{ padding: "6px 10px", textAlign: "left", color: "var(--muted)", fontWeight: 700 }}>수신 번호</th>
                <th style={{ width: 120 }}></th>
              </tr>
            </thead>
            <tbody>
              {alertPhones.map((r: any) => (
                <tr key={r.option_id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "8px 10px", fontWeight: 600 }}>{r.option_name}</td>
                  <td style={{ padding: "8px 10px" }}>
                    {alertPhoneEditing === r.option_id ? (
                      <input
                        className="input"
                        style={{ height: 32, fontSize: 13, width: 160 }}
                        value={alertPhoneEditVal}
                        onChange={e => setAlertPhoneEditVal(e.target.value)}
                      />
                    ) : (
                      r.option_value
                    )}
                  </td>
                  <td style={{ padding: "8px 10px", display: "flex", gap: 6, justifyContent: "flex-end" }}>
                    {alertPhoneEditing === r.option_id ? (
                      <>
                        <button className="btn" style={{ height: 28, fontSize: 12, padding: "0 10px" }} onClick={async () => {
                          await fetch("/api/settings/update", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ option_id: r.option_id, option_value: alertPhoneEditVal }) });
                          setAlertPhoneEditing(null);
                          loadAlertPhones();
                        }}>저장</button>
                        <button className="btn secondary" style={{ height: 28, fontSize: 12, padding: "0 10px" }} onClick={() => setAlertPhoneEditing(null)}>취소</button>
                      </>
                    ) : (
                      <>
                        <button className="btn secondary" style={{ height: 28, fontSize: 12, padding: "0 10px" }} onClick={() => { setAlertPhoneEditing(r.option_id); setAlertPhoneEditVal(r.option_value); }}>수정</button>
                        <button className="btn secondary" style={{ height: 28, fontSize: 12, padding: "0 10px", color: "#dc2626", borderColor: "#fecaca" }} onClick={async () => {
                          if (!confirm(`${r.option_name} 알림 수신 번호를 삭제할까요?`)) return;
                          await fetch("/api/settings/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ option_id: r.option_id }) });
                          loadAlertPhones();
                        }}>삭제</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* 추가 */}
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", marginBottom: 4 }}>지점명</div>
            <input className="input" style={{ height: 36, fontSize: 13, width: 120 }}
              placeholder="예: 철산점"
              value={alertPhoneForm.branch}
              onChange={e => setAlertPhoneForm({ ...alertPhoneForm, branch: e.target.value })}
            />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", marginBottom: 4 }}>수신 번호 (관장 전화번호)</div>
            <input className="input" style={{ height: 36, fontSize: 13, width: 160 }}
              placeholder="01012345678"
              value={alertPhoneForm.phone}
              onChange={e => setAlertPhoneForm({ ...alertPhoneForm, phone: e.target.value })}
            />
          </div>
          <button className="btn" style={{ height: 36, fontSize: 13 }} onClick={async () => {
            if (!alertPhoneForm.branch || !alertPhoneForm.phone) { alert("지점명과 수신 번호를 모두 입력하세요."); return; }
            const res = await fetch("/api/settings/add", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ option_type: "RESERVATION_ALERT_PHONE", option_name: alertPhoneForm.branch, option_value: alertPhoneForm.phone }),
            });
            const data = await res.json();
            if (data.success) { setAlertPhoneForm({ branch: "", phone: "" }); loadAlertPhones(); }
            else alert(data.message || "추가 실패");
          }}>추가</button>
        </div>
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