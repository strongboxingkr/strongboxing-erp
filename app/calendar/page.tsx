"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { apiFetch } from "@/lib/api";

const today = new Date().toISOString().slice(0, 10);

const BRANCH_COLORS: Record<string, string> = {
  "개봉점": "#3b82f6",
  "신정점": "#22c55e",
  "목동점": "#f59e0b",
  "철산점": "#ec4899",
  "영등포점": "#8b5cf6",
};
const getBranchColor = (b: string) => BRANCH_COLORS[b] || "#94a3b8";

const SOURCE_COLORS: Record<string, string> = {
  "전화문의": "#3b82f6",
  "인스타그램": "#ec4899",
  "홈페이지": "#8b5cf6",
  "카카오톡": "#facc15",
  "지인소개": "#22c55e",
  "방문문의": "#f97316",
  "당근": "#f97316",
  "기타": "#94a3b8",
};
const getSourceColor = (s: string) => SOURCE_COLORS[s] || "#94a3b8";

const STATUS_COLORS: Record<string, string> = {
  "예약접수": "#3b82f6",
  "예약확정": "#22c55e",
  "상담완료": "#f59e0b",
  "노쇼": "#ef4444",
  "취소": "#6b7280",
};
const getStatusColor = (s: string) => STATUS_COLORS[s] || "#94a3b8";

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
    start_datetime: "",
    memo: "",
    source_type: "전화문의",
  });

  const isAdminOrOwner = user?.role === "ADMIN" || user?.role === "OWNER";

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem("user") || "null");
    setUser(u);
    apiFetch("/api/settings?option_type=BRANCH").then((r) => r.json()).then((d) => setBranches(d.rows || []));
  }, []);

  const load = async () => {
    let url = `/api/calendar-events?start_date=${startDate}&end_date=${endDate}`;
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
    if (!form.start_datetime) return alert("예약 일시를 선택해주세요.");

    const res = await apiFetch("/api/calendar-events/add", {
      method: "POST",
      body: JSON.stringify({ ...form, event_type: form.source_type }),
    });
    const json = await res.json();
    if (json.success) {
      alert("예약 등록 완료");
      setForm({ branch_name: "", customer_name: "", phone: "", start_datetime: "", memo: "", source_type: "전화문의" });
      load();
    } else {
      alert(json.message || "등록 실패");
    }
  };

  return (
    <AppShell title="예약 등록">
      {/* 예약 등록 폼 */}
      <div className="card" style={{ marginBottom: 18 }}>
        <h2 style={{ marginTop: 0 }}>예약 등록</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12 }}>
          <select className="input" value={form.branch_name} onChange={(e) => setForm({ ...form, branch_name: e.target.value })}>
            <option value="">지점 선택</option>
            {branches.map((b) => <option key={b.option_id} value={b.option_name}>{b.option_name}</option>)}
          </select>
          <input className="input" placeholder="이름" value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} />
          <input className="input" placeholder="전화번호" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <select className="input" value={form.source_type} onChange={(e) => setForm({ ...form, source_type: e.target.value })}>
            <option>전화문의</option>
            <option>인스타그램</option>
            <option>홈페이지</option>
            <option>카카오톡</option>
            <option>지인소개</option>
            <option>방문문의</option>
            <option>당근</option>
            <option>기타</option>
          </select>
          <input className="input" type="datetime-local" value={form.start_datetime} onChange={(e) => setForm({ ...form, start_datetime: e.target.value })} />
          <button className="btn" onClick={addReservation}>예약 등록</button>
        </div>
      </div>

      {/* 조회 필터 */}
      <div className="card" style={{ marginBottom: 18 }}>
        <div style={{ display: "grid", gridTemplateColumns: "160px 160px 160px 1fr auto auto", gap: 12, alignItems: "center" }}>
          {isAdminOrOwner ? (
            <select className="input" value={branch} onChange={(e) => setBranch(e.target.value)}>
              <option>전체</option>
              {branches.map((b) => <option key={b.option_id}>{b.option_name}</option>)}
            </select>
          ) : (
            <div className="input" style={{ color: "#94a3b8" }}>{user?.branch_name}</div>
          )}
          <input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <input className="input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          <input className="input" placeholder="이름 / 전화번호 검색" value={search} onChange={(e) => setSearch(e.target.value)} />
          <button className="btn" onClick={load}>조회</button>
          <button className="btn secondary" onClick={() => { setStartDate(today); setEndDate(today); setSearch(""); setBranch("전체"); }}>초기화</button>
        </div>
      </div>

      {/* 결과 테이블 */}
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h2 style={{ margin: 0 }}>
            {startDate === endDate ? `${startDate} 예약` : `${startDate} ~ ${endDate} 예약`}
          </h2>
          <span style={{ color: "#94a3b8", fontSize: 14 }}>총 {filtered.length}건</span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>예약일시</th>
                <th>이름</th>
                <th>전화번호</th>
                <th>지점</th>
                <th>유입경로</th>
                <th>상태</th>
                <th>메모</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.event_id} onClick={() => setSelected(r)} style={{ cursor: "pointer" }}>
                  <td style={{ fontWeight: 900, color: "#3b82f6", whiteSpace: "nowrap" }}>
                    {r.start_datetime?.slice(0, 16).replace("T", " ")}
                  </td>
                  <td style={{ fontWeight: 900 }}>{r.customer_name || "-"}</td>
                  <td>{r.phone || "-"}</td>
                  <td>
                    <span style={{ padding: "4px 10px", borderRadius: 8, background: `${getBranchColor(r.branch_name)}22`, color: getBranchColor(r.branch_name), fontWeight: 900, borderLeft: `3px solid ${getBranchColor(r.branch_name)}` }}>
                      {r.branch_name || "-"}
                    </span>
                  </td>
                  <td>
                    <span style={{ padding: "4px 10px", borderRadius: 8, background: `${getSourceColor(r.event_type)}22`, color: getSourceColor(r.event_type), fontWeight: 700 }}>
                      {r.event_type || "-"}
                    </span>
                  </td>
                  <td>
                    <span style={{ padding: "4px 10px", borderRadius: 8, background: `${getStatusColor(r.status)}22`, color: getStatusColor(r.status), fontWeight: 900 }}>
                      {r.status || "-"}
                    </span>
                  </td>
                  <td style={{ color: "#94a3b8", fontSize: 13, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.memo || "-"}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: "center", color: "#4b5563", padding: 24 }}>예약이 없습니다.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 수정 팝업 */}
      {selected && (
        <div onClick={() => setSelected(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "grid", placeItems: "center", zIndex: 9999, padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} className="card" style={{ width: 560, borderRadius: 24 }}>
            <h2 style={{ marginTop: 0 }}>예약 수정</h2>

            <input className="input" value={selected.customer_name || ""} onChange={(e) => setSelected({ ...selected, customer_name: e.target.value })} placeholder="이름" style={{ marginBottom: 10 }} />
            <input className="input" value={selected.phone || ""} onChange={(e) => setSelected({ ...selected, phone: e.target.value })} placeholder="전화번호" style={{ marginBottom: 10 }} />
            <input className="input" type="datetime-local" value={selected.start_datetime?.slice(0, 16) || ""} onChange={(e) => setSelected({ ...selected, start_datetime: e.target.value })} style={{ marginBottom: 10 }} />

            <select className="input" value={selected.event_type || "전화문의"} onChange={(e) => setSelected({ ...selected, event_type: e.target.value })} style={{ marginBottom: 10 }}>
              <option>전화문의</option>
              <option>인스타그램</option>
              <option>홈페이지</option>
              <option>카카오톡</option>
              <option>지인소개</option>
              <option>방문문의</option>
              <option>당근</option>
              <option>기타</option>
            </select>

            <textarea className="input" value={selected.memo || ""} onChange={(e) => setSelected({ ...selected, memo: e.target.value })} placeholder="메모" style={{ width: "100%", minHeight: 100, resize: "none", marginBottom: 14 }} />

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontWeight: 900, marginBottom: 8 }}>상태 변경</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {["예약접수", "예약확정", "상담완료", "노쇼", "취소"].map((s) => (
                  <button
                    key={s}
                    className={selected.status === s ? "btn" : "btn secondary"}
                    onClick={async () => {
                      if (s === "예약확정") {
                        setSmsReservation(selected);
                        setSmsMessage(
`[스트롱복싱 ${selected.branch_name}]

${selected.customer_name}님 예약이 확정되었습니다.

방문일시 : ${selected.start_datetime?.slice(0, 16).replace("T", " ")}
예약내용 : ${selected.event_type || "방문 상담"}

편한 복장과 실내 운동화를 지참 후 방문 부탁드립니다.
처음 방문이신 경우 예약시간 5~10분 전 도착 부탁드립니다.

감사합니다.
스트롱복싱 ${selected.branch_name}`
                        );
                        setSelected(null);
                        setSmsModalOpen(true);
                        return;
                      }

                      const res = await apiFetch("/api/calendar-events/edit", {
                        method: "POST",
                        body: JSON.stringify({ event_id: selected.event_id, customer_name: selected.customer_name, phone: selected.phone, start_datetime: selected.start_datetime, event_type: selected.event_type, status: s, memo: selected.memo }),
                      });
                      const json = await res.json();
                      if (json.success) { alert(`${s} 처리 완료`); setSelected(null); load(); }
                      else alert(json.message || "처리 실패");
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <button className="btn secondary" onClick={() => setSelected(null)}>닫기</button>
              <button className="btn secondary" onClick={async () => {
                if (!confirm("예약을 삭제하시겠습니까?")) return;
                const res = await apiFetch("/api/calendar-events/delete", { method: "POST", body: JSON.stringify({ event_id: selected.event_id }) });
                const json = await res.json();
                if (json.success) { alert("삭제 완료"); setSelected(null); load(); }
                else alert(json.message || "삭제 실패");
              }}>삭제</button>
              <button className="btn" onClick={async () => {
                const res = await apiFetch("/api/calendar-events/edit", {
                  method: "POST",
                  body: JSON.stringify({ event_id: selected.event_id, customer_name: selected.customer_name, phone: selected.phone, start_datetime: selected.start_datetime, event_type: selected.event_type, status: selected.status, memo: selected.memo }),
                });
                const json = await res.json();
                if (json.success) { alert("저장 완료"); setSelected(null); load(); }
                else alert(json.message || "저장 실패");
              }}>저장</button>
            </div>
          </div>
        </div>
      )}

      {/* 문자 발송 팝업 */}
      {smsModalOpen && smsReservation && (
        <div onClick={() => setSmsModalOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "grid", placeItems: "center", zIndex: 10000, padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} className="card" style={{ width: "100%", maxWidth: 620, borderRadius: 24 }}>
            <h2 style={{ marginTop: 0 }}>문자 발송 확인</h2>
            <textarea className="input" value={smsMessage} onChange={(e) => setSmsMessage(e.target.value)} style={{ width: "100%", minHeight: 240, resize: "vertical", marginBottom: 16 }} />
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="btn secondary" onClick={() => setSmsModalOpen(false)}>취소</button>
              <button className="btn" onClick={async () => {
                const saveRes = await apiFetch("/api/calendar-events/edit", {
                  method: "POST",
                  body: JSON.stringify({ event_id: smsReservation.event_id, customer_name: smsReservation.customer_name, phone: smsReservation.phone, start_datetime: smsReservation.start_datetime, event_type: smsReservation.event_type, status: "예약확정", memo: smsReservation.memo }),
                });
                const saveJson = await saveRes.json();
                if (!saveJson.success) return alert(saveJson.message || "예약확정 실패");

                const smsRes = await apiFetch("/api/sms/send", {
                  method: "POST",
                  body: JSON.stringify({ branch_name: smsReservation.branch_name, message: smsMessage, is_test: true, test_phone: smsReservation.phone }),
                });
                const smsJson = await smsRes.json();
                alert(smsJson.success ? "예약확정 + 문자발송 완료" : (smsJson.message || "예약확정은 됐지만 문자 발송 실패"));
                setSmsModalOpen(false);
                setSmsReservation(null);
                load();
              }}>예약확정 + 문자발송</button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
