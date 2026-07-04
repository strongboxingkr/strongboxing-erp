"use client";

import { useEffect, useState } from "react";

const BRANCHES = ["철산점", "목동점", "개봉점", "신정점"];
const STATUS_OPTIONS = ["예약접수", "예약확정", "상담완료", "확인완료", "노쇼", "취소"];
const TYPE_OPTIONS = ["PHONE", "HOMEPAGE", "KAKAO"];

const getStatusColor = (s: string) => {
  if (s === "예약접수") return { bg: "#eff6ff", color: "#3b82f6" };
  if (s === "예약확정") return { bg: "#f0fdf4", color: "#22c55e" };
  if (s === "확인완료") return { bg: "#f5f3ff", color: "#8b5cf6" };
  if (s === "상담완료") return { bg: "#fffbeb", color: "#f59e0b" };
  if (s === "노쇼") return { bg: "#fef2f2", color: "#ef4444" };
  if (s === "취소") return { bg: "#f1f5f9", color: "#94a3b8" };
  return { bg: "#f1f5f9", color: "#64748b" };
};

const getTypeInfo = (t: string) => {
  if (String(t).includes("NAVER")) return { label: "네이버", color: "#03c75a" };
  if (String(t).includes("HOMEPAGE")) return { label: "홈페이지", color: "#3b82f6" };
  if (String(t).includes("KAKAO")) return { label: "카카오", color: "#f59e0b" };
  if (String(t).includes("PHONE")) return { label: "전화", color: "#f97316" };
  return { label: "기타", color: "#94a3b8" };
};

const isNaver = (r: any) => String(r.event_type || "").includes("NAVER");

const EMPTY_FORM = {
  branch_name: "철산점",
  customer_name: "",
  phone: "",
  start_datetime: "",
  title: "방문 상담",
  memo: "",
  status: "예약접수",
  event_type: "PHONE",
};

export default function PublicCalendarPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [branch, setBranch] = useState("전체");
  const [mobile, setMobile] = useState(false);
  const [modal, setModal] = useState<{ mode: "add" | "edit"; data: any } | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const check = () => setMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => { load(); }, [branch]);

  const load = async () => {
    const q = branch !== "전체" ? `?branch_name=${encodeURIComponent(branch)}` : "";
    const res = await fetch(`/api/public-calendar-events${q}`);
    const data = await res.json();
    setRows(data.rows || []);
  };

  const filtered = rows.filter((r) => {
    if (!search) return true;
    return (
      String(r.customer_name || "").includes(search) ||
      String(r.phone || "").includes(search) ||
      String(r.branch_name || "").includes(search)
    );
  });

  const openAdd = () => setModal({ mode: "add", data: { ...EMPTY_FORM, branch_name: branch !== "전체" ? branch : "철산점" } });

  const openEdit = (r: any) => {
    if (isNaver(r)) return;
    setModal({
      mode: "edit",
      data: {
        event_id: r.event_id,
        branch_name: r.branch_name,
        customer_name: r.customer_name,
        phone: r.phone || "",
        start_datetime: String(r.start_datetime || "").slice(0, 16).replace(" ", "T"),
        title: r.title || "",
        memo: r.memo || "",
        status: r.status,
        event_type: r.event_type,
      },
    });
  };

  const save = async () => {
    if (!modal) return;
    setSaving(true);
    try {
      await fetch("/api/public-calendar-events", {
        method: modal.mode === "add" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(modal.data),
      });
      setModal(null);
      load();
    } finally {
      setSaving(false);
    }
  };

  const upd = (k: string, v: string) => setModal((m) => m ? { ...m, data: { ...m.data, [k]: v } } : m);

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #f8fafc; font-family: -apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif; color: #0f172a; }
        .tbl { width: 100%; border-collapse: collapse; }
        .tbl th { background: #f8fafc; color: #94a3b8; font-size: 12px; font-weight: 700; padding: 11px 18px; text-align: left; border-bottom: 2px solid #e2e8f0; white-space: nowrap; letter-spacing: 0.3px; }
        .tbl td { padding: 14px 18px; border-bottom: 1px solid #f1f5f9; font-size: 14px; vertical-align: middle; }
        .tbl tbody tr.editable:hover td { background: #f8fafc; cursor: pointer; }
        .tbl tbody tr.locked td { color: #b0bec5; }
        .badge { display: inline-block; padding: 4px 11px; border-radius: 999px; font-size: 11px; font-weight: 700; }
        .inp { width: 100%; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 9px 13px; font-size: 14px; background: #fff; outline: none; font-family: inherit; color: #0f172a; transition: border 0.15s; }
        .inp:focus { border-color: #0f172a; }
        .btn-pri { background: #0f172a; color: white; border: none; border-radius: 10px; padding: 10px 22px; font-size: 13px; font-weight: 700; cursor: pointer; transition: opacity 0.15s; }
        .btn-pri:hover { opacity: 0.85; }
        .btn-sec { background: #f1f5f9; color: #334155; border: none; border-radius: 10px; padding: 10px 22px; font-size: 13px; font-weight: 700; cursor: pointer; }
      `}</style>

      <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
        {/* 헤더 */}
        <div style={{ background: "white", borderBottom: "1px solid #e2e8f0", padding: mobile ? "16px 18px" : "20px 40px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 21, fontWeight: 900, color: "#0f172a", letterSpacing: -0.5 }}>스트롱복싱 예약</div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 3 }}>총 {filtered.length}건</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input className="inp" placeholder="이름 / 전화번호 검색" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 200 }} />
            <button className="btn-pri" onClick={openAdd}>+ 예약 추가</button>
          </div>
        </div>

        {/* 지점 탭 */}
        <div style={{ background: "white", borderBottom: "1px solid #e2e8f0", padding: "0 40px", display: "flex", overflowX: "auto" }}>
          {["전체", ...BRANCHES].map((b) => (
            <button key={b} onClick={() => setBranch(b)} style={{
              background: "none", border: "none", padding: "13px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
              color: branch === b ? "#0f172a" : "#94a3b8",
              borderBottom: branch === b ? "2px solid #0f172a" : "2px solid transparent",
              transition: "color 0.15s",
            }}>{b}</button>
          ))}
        </div>

        {/* 테이블 */}
        <div style={{ padding: mobile ? "14px 8px" : "28px 40px" }}>
          <div style={{ background: "white", borderRadius: 18, boxShadow: "0 1px 6px rgba(0,0,0,0.06)", overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>날짜</th>
                    <th>시간</th>
                    <th>이름</th>
                    {!mobile && <th>연락처</th>}
                    {branch === "전체" && !mobile && <th>지점</th>}
                    {!mobile && <th>예약내용</th>}
                    <th>출처</th>
                    <th>상태</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={8} style={{ textAlign: "center", padding: 56, color: "#cbd5e1", fontSize: 14 }}>예약이 없습니다</td></tr>
                  ) : filtered.map((r) => {
                    const naver = isNaver(r);
                    const type = getTypeInfo(r.event_type);
                    const sc = getStatusColor(r.status);
                    return (
                      <tr key={r.event_id} className={naver ? "locked" : "editable"} onClick={() => openEdit(r)}>
                        <td style={{ fontWeight: 600, color: naver ? "#b0bec5" : "#0f172a" }}>{String(r.start_datetime || "").slice(0, 10)}</td>
                        <td style={{ fontWeight: 800, fontSize: 15, color: naver ? "#b0bec5" : "#0f172a" }}>{String(r.start_datetime || "").slice(11, 16)}</td>
                        <td style={{ fontWeight: 700, color: naver ? "#b0bec5" : "#0f172a" }}>
                          {naver && <span style={{ fontSize: 10, marginRight: 4, opacity: 0.5 }}>🔒</span>}
                          {r.customer_name || "-"}
                        </td>
                        {!mobile && <td style={{ color: "#64748b" }}>{r.phone || "-"}</td>}
                        {branch === "전체" && !mobile && <td style={{ color: "#64748b", whiteSpace: "nowrap" }}>{r.branch_name}</td>}
                        {!mobile && <td style={{ color: "#64748b", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title || "-"}</td>}
                        <td><span className="badge" style={{ background: `${type.color}15`, color: type.color }}>{type.label}</span></td>
                        <td><span className="badge" style={{ background: sc.bg, color: sc.color }}>{r.status}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* 모달 */}
      {modal && (
        <div onClick={() => setModal(null)} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "grid", placeItems: "center", zIndex: 9999, padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "white", borderRadius: 20, padding: 28, width: "100%", maxWidth: 460, display: "flex", flexDirection: "column", gap: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.12)" }}>
            <h3 style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", marginBottom: 2 }}>{modal.mode === "add" ? "예약 추가" : "예약 수정"}</h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 5 }}>지점</label>
                <select className="inp" value={modal.data.branch_name} onChange={(e) => upd("branch_name", e.target.value)}>
                  {BRANCHES.map((b) => <option key={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 5 }}>출처</label>
                <select className="inp" value={modal.data.event_type} onChange={(e) => upd("event_type", e.target.value)}>
                  {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{getTypeInfo(t).label}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 5 }}>이름 *</label>
              <input className="inp" value={modal.data.customer_name} onChange={(e) => upd("customer_name", e.target.value)} placeholder="고객 이름" />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 5 }}>연락처</label>
              <input className="inp" value={modal.data.phone} onChange={(e) => upd("phone", e.target.value)} placeholder="010-0000-0000" />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 5 }}>방문 일시 *</label>
              <input className="inp" type="datetime-local" value={modal.data.start_datetime} onChange={(e) => upd("start_datetime", e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 5 }}>예약내용</label>
              <input className="inp" value={modal.data.title} onChange={(e) => upd("title", e.target.value)} placeholder="방문 상담" />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 5 }}>상태</label>
              <select className="inp" value={modal.data.status} onChange={(e) => upd("status", e.target.value)}>
                {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 5 }}>메모</label>
              <textarea className="inp" value={modal.data.memo} onChange={(e) => upd("memo", e.target.value)} rows={3} style={{ resize: "none" }} />
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <button className="btn-sec" style={{ flex: 1 }} onClick={() => setModal(null)}>취소</button>
              <button className="btn-pri" style={{ flex: 1 }} onClick={save} disabled={saving}>{saving ? "저장 중..." : "저장"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
