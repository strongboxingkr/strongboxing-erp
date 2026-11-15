"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { apiFetch } from "@/lib/api";

const today = new Date().toISOString().slice(0, 10);

const getStatusColor = (s: string) => {
  if (s === "예약접수") return "#3b82f6";
  if (s === "예약확정") return "#16a34a";
  if (s === "상담완료") return "#d97706";
  if (s === "노쇼") return "#dc2626";
  return "#6b7280";
};

const SOURCE_OPTIONS = ["전화문의", "카카오톡", "인스타그램", "홈페이지", "지인소개", "방문문의", "당근", "기타"];
const PURPOSE_OPTIONS = ["방문상담", "일일권", "기타"];

export default function CalendarPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [branch, setBranch] = useState("전체");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [smsModalOpen, setSmsModalOpen] = useState(false);
  const [smsReservation, setSmsReservation] = useState<any>(null);
  const [smsMessage, setSmsMessage] = useState("");
  const [user, setUser] = useState<any>(null);

  const [form, setForm] = useState({
    branch_name: "",
    customer_name: "",
    phone: "",
    purpose: "방문상담",
    source_type: "전화문의",
    start_datetime: "",
    ops_memo: "",
  });

  const isAdminOrOwner = user?.role === "ADMIN" || user?.role === "OWNER";

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem("user") || "null");
    setUser(u);
    apiFetch("/api/settings?option_type=BRANCH").then(r => r.json()).then(d => setBranches(d.rows || []));
  }, []);

  const load = async () => {
    let url = `/api/calendar-events?start_date=${startDate}&end_date=${endDate}&include_cancelled=true`;
    if (branch !== "전체") url += `&branch_name=${encodeURIComponent(branch)}`;
    const res = await apiFetch(url);
    const json = await res.json();
    setRows(json.rows || []);
  };

  useEffect(() => {
    if (user !== null) load();
  }, [branch, startDate, endDate, user]);

  const filtered = rows.filter((r) => {
    if (!search.trim()) return true;
    return r.customer_name?.includes(search) || r.phone?.includes(search);
  });

  const addReservation = async () => {
    if (!form.branch_name) return alert("지점을 선택해주세요.");
    if (!form.customer_name) return alert("이름을 입력해주세요.");
    if (!form.start_datetime) return alert("방문일시를 선택해주세요.");

    const res = await apiFetch("/api/calendar-events/add", {
      method: "POST",
      body: JSON.stringify({
        branch_name: form.branch_name,
        customer_name: form.customer_name,
        phone: form.phone,
        start_datetime: form.start_datetime,
        event_type: form.source_type,
        title: form.purpose,
        memo: form.ops_memo,
        status: "예약접수",
      }),
    });
    const json = await res.json();
    if (json.success) {
      alert("예약 등록 완료");
      setForm({ branch_name: "", customer_name: "", phone: "", purpose: "방문상담", source_type: "전화문의", start_datetime: "", ops_memo: "" });
      load();
    } else {
      alert(json.message || "등록 실패");
    }
  };

  return (
    <AppShell title="예약 등록">
      <style>{`
        .form-grid { display:grid; gap:12px; }
        .field { display:flex; flex-direction:column; gap:4px; }
        .field-label { font-size:12px; font-weight:600; color:#374151; }
        .field-label .req { color:#dc2626; }
        .modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.45); display:flex; align-items:center; justify-content:center; z-index:9999; padding:16px; }
        .modal-box { width:100%; max-width:500px; max-height:92vh; background:#fff; border-radius:10px; display:flex; flex-direction:column; box-shadow:0 8px 40px rgba(0,0,0,.18); overflow:hidden; }
        .modal-header { padding:16px 18px 12px; border-bottom:1px solid #e5e7eb; flex-shrink:0; }
        .modal-body { flex:1; overflow-y:auto; padding:14px 18px; }
        .modal-footer { padding:11px 18px; border-top:1px solid #e5e7eb; flex-shrink:0; display:flex; gap:8px; justify-content:flex-end; }
        .status-btn { height:32px; padding:0 12px; border-radius:5px; font-size:12px; font-weight:600; cursor:pointer; border:1px solid #e5e7eb; background:#f9fafb; color:#374151; }
        .status-btn.active { border-color:transparent; color:#fff; }
      `}</style>

      {/* 예약 등록 폼 */}
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "18px 20px", marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 14 }}>예약 등록</div>

        {/* 행 1: 지점 / 이름 / 전화번호 */}
        <div className="form-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", marginBottom: 10 }}>
          <div className="field">
            <label className="field-label">지점 <span className="req">*</span></label>
            <select className="input" style={{ height: 38 }} value={form.branch_name} onChange={(e) => setForm({ ...form, branch_name: e.target.value })}>
              <option value="">지점 선택</option>
              {branches.map((b) => <option key={b.option_id} value={b.option_name}>{b.option_name}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="field-label">이름 <span className="req">*</span></label>
            <input className="input" style={{ height: 38 }} placeholder="이름" value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} />
          </div>
          <div className="field">
            <label className="field-label">전화번호</label>
            <input className="input" style={{ height: 38 }} placeholder="010-0000-0000" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
        </div>

        {/* 행 2: 예약 목적 / 유입경로 / 방문일시 */}
        <div className="form-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", marginBottom: 10 }}>
          <div className="field">
            <label className="field-label">예약 목적</label>
            <select className="input" style={{ height: 38 }} value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })}>
              {PURPOSE_OPTIONS.map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="field-label">유입경로</label>
            <select className="input" style={{ height: 38 }} value={form.source_type} onChange={(e) => setForm({ ...form, source_type: e.target.value })}>
              {SOURCE_OPTIONS.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="field-label">방문일시 <span className="req">*</span></label>
            <input className="input" type="datetime-local" style={{ height: 38, fontSize: 13 }} value={form.start_datetime} onChange={(e) => setForm({ ...form, start_datetime: e.target.value })} />
          </div>
        </div>

        {/* 행 3: 운영 메모 */}
        <div className="field" style={{ marginBottom: 12 }}>
          <label className="field-label">운영 메모 <span style={{ fontWeight: 400, color: "#9ca3af" }}>(선택)</span></label>
          <textarea className="input" style={{ minHeight: 64, resize: "vertical", fontSize: 13 }} placeholder="내부 메모를 입력하세요. 문자 발송에 포함되지 않습니다."
            value={form.ops_memo} onChange={(e) => setForm({ ...form, ops_memo: e.target.value })} />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button className="btn" style={{ height: 38, minWidth: 90 }} onClick={addReservation}>등록</button>
        </div>
      </div>

      {/* 조회 필터 */}
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "12px 16px", marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {isAdminOrOwner ? (
            <select className="input" style={{ width: 120, height: 36 }} value={branch} onChange={(e) => setBranch(e.target.value)}>
              <option>전체</option>
              {branches.map((b) => <option key={b.option_id}>{b.option_name}</option>)}
            </select>
          ) : (
            <span style={{ fontSize: 14, color: "#374151", fontWeight: 600 }}>{user?.branch_name}</span>
          )}
          <input className="input" type="date" style={{ width: 150, height: 36 }} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <span style={{ color: "#9ca3af" }}>~</span>
          <input className="input" type="date" style={{ width: 150, height: 36 }} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          <input className="input" style={{ flex: 1, minWidth: 160, height: 36 }} placeholder="이름 / 전화번호" value={search} onChange={(e) => setSearch(e.target.value)} />
          <button className="btn" style={{ height: 36 }} onClick={load}>조회</button>
          <button className="btn secondary" style={{ height: 36 }} onClick={() => { setStartDate(today); setEndDate(today); setSearch(""); setBranch("전체"); }}>초기화</button>
        </div>
      </div>

      {/* 결과 테이블 */}
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid #e5e7eb" }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>
            {startDate === endDate ? `${startDate} 예약` : `${startDate} ~ ${endDate}`}
          </span>
          <span style={{ color: "#6b7280", fontSize: 13 }}>총 {filtered.length}건</span>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                {["예약일시", "이름", "전화번호", "예약 목적", "지점", "유입경로", "상태", "메모"].map(h => (
                  <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#6b7280", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const isCan = ["취소", "예약취소"].includes(r.status);
                const purpose = (() => {
                  const t = String(r.title || "");
                  if (/방문상담|상담예약|체험/.test(t)) return "방문상담";
                  if (/일일권|원데이|1day/i.test(t)) return "일일권";
                  return t.length <= 20 && !/^(네이버예약|홈페이지예약)/.test(t) ? t : "-";
                })();
                return (
                  <tr key={r.event_id} onClick={() => setSelected(r)}
                    style={{ cursor: "pointer", borderBottom: "1px solid #f3f4f6", opacity: isCan ? 0.5 : 1 }}>
                    <td style={{ padding: "10px 12px", whiteSpace: "nowrap", color: "#374151", fontWeight: 600, textDecoration: isCan ? "line-through" : "none" }}>
                      {r.start_datetime?.slice(0, 16).replace("T", " ")}
                    </td>
                    <td style={{ padding: "10px 12px", fontWeight: 600, color: "#111827" }}>{r.customer_name || "-"}</td>
                    <td style={{ padding: "10px 12px", color: "#374151" }}>{r.phone || "-"}</td>
                    <td style={{ padding: "10px 12px", color: "#374151" }}>{purpose}</td>
                    <td style={{ padding: "10px 12px", color: "#374151" }}>{r.branch_name || "-"}</td>
                    <td style={{ padding: "10px 12px", color: "#374151" }}>{r.event_type || "-"}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: getStatusColor(r.status) }}>{r.status || "-"}</span>
                    </td>
                    <td style={{ padding: "10px 12px", color: "#6b7280", fontSize: 13, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.memo?.split("---MAIL---")[0]?.trim() || "-"}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={8} style={{ padding: 28, textAlign: "center", color: "#9ca3af", fontSize: 13 }}>예약이 없습니다.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 수정 모달 */}
      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>예약 수정</div>
                <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", fontSize: 18, color: "#9ca3af", cursor: "pointer" }}>✕</button>
              </div>
            </div>
            <div className="modal-body">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px" }}>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 3 }}>이름</div>
                  <input className="input" style={{ height: 36 }} value={selected.customer_name || ""} onChange={(e) => setSelected({ ...selected, customer_name: e.target.value })} />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 3 }}>방문일시</div>
                  <input className="input" type="datetime-local" style={{ height: 36, fontSize: 13 }} value={selected.start_datetime?.slice(0, 16) || ""} onChange={(e) => setSelected({ ...selected, start_datetime: e.target.value })} />
                </div>
              </div>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 3 }}>전화번호</div>
                <input className="input" style={{ height: 36 }} value={selected.phone || ""} onChange={(e) => setSelected({ ...selected, phone: e.target.value })} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px", marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 3 }}>예약 목적</div>
                  <select className="input" style={{ height: 36 }} value={selected.title || ""} onChange={(e) => setSelected({ ...selected, title: e.target.value })}>
                    {PURPOSE_OPTIONS.map(p => <option key={p}>{p}</option>)}
                    {selected.title && !PURPOSE_OPTIONS.includes(selected.title) && <option value={selected.title}>{selected.title}</option>}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 3 }}>유입경로</div>
                  <select className="input" style={{ height: 36 }} value={selected.event_type || ""} onChange={(e) => setSelected({ ...selected, event_type: e.target.value })}>
                    {SOURCE_OPTIONS.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 3 }}>운영 메모</div>
                <textarea className="input" style={{ minHeight: 72, resize: "vertical", fontSize: 13 }}
                  value={selected.memo?.split("---MAIL---")[0]?.trim() || ""}
                  onChange={(e) => {
                    const mailPart = selected.memo?.includes("---MAIL---")
                      ? selected.memo.split("---MAIL---").slice(1).join("---MAIL---")
                      : "";
                    const newMemo = mailPart ? `${e.target.value}\n---MAIL---\n${mailPart}` : e.target.value;
                    setSelected({ ...selected, memo: newMemo });
                  }}
                  placeholder="운영 메모 (선택)"
                />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 6 }}>상태</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {["예약접수", "예약확정", "상담완료", "노쇼", "취소"].map((s) => {
                    const label = s === "취소" ? "예약 취소" : s;
                    const active = selected.status === s;
                    return (
                      <button key={s}
                        className={`status-btn${active ? " active" : ""}`}
                        style={active ? { background: getStatusColor(s) } : {}}
                        onClick={async () => {
                          if (s === "예약확정") {
                            setSmsReservation(selected);
                            setSmsMessage(`[스트롱복싱 ${selected.branch_name}]\n\n${selected.customer_name}님 예약이 확정되었습니다.\n\n방문일시 : ${selected.start_datetime?.slice(0, 16).replace("T", " ")}\n예약내용 : ${selected.title || "방문 상담"}\n\n편한 복장과 실내 운동화를 지참 후 방문 부탁드립니다.\n처음 방문이신 경우 예약시간 5~10분 전 도착 부탁드립니다.\n\n감사합니다.\n스트롱복싱 ${selected.branch_name}`);
                            setSelected(null);
                            setSmsModalOpen(true);
                            return;
                          }
                          const res = await apiFetch("/api/calendar-events/edit", {
                            method: "POST",
                            body: JSON.stringify({ event_id: selected.event_id, customer_name: selected.customer_name, phone: selected.phone, start_datetime: selected.start_datetime, event_type: selected.event_type, title: selected.title, status: s, memo: selected.memo }),
                          });
                          const json = await res.json();
                          if (json.success) { setSelected(null); load(); }
                          else alert(json.message || "처리 실패");
                        }}
                      >{label}</button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn secondary" style={{ height: 36, fontSize: 13 }} onClick={async () => {
                if (!confirm("예약을 삭제하시겠습니까?")) return;
                const res = await apiFetch("/api/calendar-events/delete", { method: "POST", body: JSON.stringify({ event_id: selected.event_id }) });
                const json = await res.json();
                if (json.success) { setSelected(null); load(); }
                else alert(json.message || "삭제 실패");
              }}>삭제</button>
              <button className="btn secondary" style={{ height: 36, fontSize: 13 }} onClick={() => setSelected(null)}>닫기</button>
              <button className="btn" style={{ height: 36, fontSize: 13 }} onClick={async () => {
                const res = await apiFetch("/api/calendar-events/edit", {
                  method: "POST",
                  body: JSON.stringify({ event_id: selected.event_id, customer_name: selected.customer_name, phone: selected.phone, start_datetime: selected.start_datetime, event_type: selected.event_type, title: selected.title, status: selected.status, memo: selected.memo }),
                });
                const json = await res.json();
                if (json.success) { setSelected(null); load(); }
                else alert(json.message || "저장 실패");
              }}>저장</button>
            </div>
          </div>
        </div>
      )}

      {/* 문자 발송 모달 */}
      {smsModalOpen && smsReservation && (
        <div className="modal-overlay" onClick={() => setSmsModalOpen(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>예약확정 안내문자</div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{smsReservation.customer_name} · {smsReservation.phone || "연락처 없음"}</div>
            </div>
            <div className="modal-body">
              <textarea className="input" value={smsMessage} onChange={(e) => setSmsMessage(e.target.value)} style={{ minHeight: 220, resize: "vertical", fontSize: 13 }} />
            </div>
            <div className="modal-footer">
              <button className="btn secondary" style={{ height: 36, fontSize: 13 }} onClick={() => setSmsModalOpen(false)}>닫기</button>
              <button className="btn secondary" style={{ height: 36, fontSize: 13 }} onClick={async () => {
                const res = await apiFetch("/api/calendar-events/edit", {
                  method: "POST",
                  body: JSON.stringify({ event_id: smsReservation.event_id, customer_name: smsReservation.customer_name, phone: smsReservation.phone, start_datetime: smsReservation.start_datetime, event_type: smsReservation.event_type, title: smsReservation.title, status: "예약확정", memo: smsReservation.memo }),
                });
                const json = await res.json();
                setSmsModalOpen(false);
                setSmsReservation(null);
                load();
                alert(json.success ? "예약확정 완료 (문자 미발송)" : json.message || "처리 실패");
              }}>문자 없이 확정</button>
              <button className="btn" style={{ height: 36, fontSize: 13 }} onClick={async () => {
                const saveRes = await apiFetch("/api/calendar-events/edit", {
                  method: "POST",
                  body: JSON.stringify({ event_id: smsReservation.event_id, customer_name: smsReservation.customer_name, phone: smsReservation.phone, start_datetime: smsReservation.start_datetime, event_type: smsReservation.event_type, title: smsReservation.title, status: "예약확정", memo: smsReservation.memo }),
                });
                const saveJson = await saveRes.json();
                if (!saveJson.success) return alert(saveJson.message || "예약확정 실패");
                const smsRes = await apiFetch("/api/sms/send", {
                  method: "POST",
                  body: JSON.stringify({ branch_name: smsReservation.branch_name, message: smsMessage, is_test: true, test_phone: smsReservation.phone }),
                });
                const smsJson = await smsRes.json();
                setSmsModalOpen(false);
                setSmsReservation(null);
                load();
                alert(smsJson.success ? "예약확정 + 문자발송 완료" : (smsJson.message || "예약확정은 됐지만 문자 발송 실패"));
              }}>발송 후 확정</button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
