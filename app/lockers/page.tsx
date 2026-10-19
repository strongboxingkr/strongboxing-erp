"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { apiFetch } from "@/lib/api";

export default function LockersPage() {
  const [user, setUser] = useState<any>(null);
  const [branch, setBranch] = useState("");
  const [branches, setBranches] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]);
  const [lockers, setLockers] = useState<any[]>([]);
  const [selectedZone, setSelectedZone] = useState<any>(null);
  const [tab, setTab] = useState<"grid" | "settings">("grid");
  const [modal, setModal] = useState<any>(null);
  const [form, setForm] = useState({ member_name: "", gender: "", start_date: "", end_date: "", memo: "", has_luggage: 0 });
  const [zoneForm, setZoneForm] = useState({ zone_name: "", start_no: "", end_no: "", sort_order: "0", cols: "10" });

  useEffect(() => {
    const saved = localStorage.getItem("user");
    if (saved) {
      const u = JSON.parse(saved);
      setUser(u);
      if (u.role !== "ADMIN" && u.role !== "OWNER") {
        setBranch(u.branch_name || "");
      }
    }
    loadBranches();
  }, []);

  useEffect(() => {
    if (branch) {
      loadZones();
      loadLockers();
    }
  }, [branch]);

  const loadBranches = async () => {
    const res = await apiFetch("/api/settings?option_type=BRANCH");
    const data = await res.json();
    setBranches(data.rows || []);
  };

  const loadZones = async () => {
    const res = await apiFetch(`/api/locker-zones?branch_name=${encodeURIComponent(branch)}`);
    const data = await res.json();
    const rows = data.rows || [];
    setZones(rows);
    if (rows.length > 0 && !selectedZone) setSelectedZone(rows[0]);
    else if (rows.length > 0 && selectedZone) {
      const updated = rows.find((z: any) => z.zone_id === selectedZone.zone_id);
      setSelectedZone(updated || rows[0]);
    }
  };

  const loadLockers = async () => {
    const res = await apiFetch(`/api/lockers?branch_name=${encodeURIComponent(branch)}`);
    const data = await res.json();
    setLockers(data.rows || []);
  };

  const getLocker = (no: number, zoneName: string) =>
    lockers.find((l) => l.locker_no === no && l.locker_zone === zoneName);

  const openModal = (no: number) => {
    const existing = getLocker(no, selectedZone.zone_name);
    setModal({ locker_no: no, zone: selectedZone.zone_name, existing });
    setForm({
      member_name: existing?.member_name || "",
      gender: existing?.gender || "",
      start_date: existing?.start_date?.slice(0, 10) || "",
      end_date: existing?.end_date?.slice(0, 10) || "",
      memo: existing?.memo || "",
      has_luggage: existing?.has_luggage || 0,
    });
  };

  const assign = async () => {
    await apiFetch("/api/lockers/assign", {
      method: "POST",
      body: JSON.stringify({
        branch_name: branch,
        locker_zone: modal.zone,
        locker_no: modal.locker_no,
        member_name: form.member_name,
        gender: form.gender,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        memo: form.memo,
        has_luggage: form.has_luggage,
      }),
    });
    setModal(null);
    loadLockers();
  };

  const release = async () => {
    if (!confirm("락커를 비우시겠습니까?")) return;
    await apiFetch("/api/lockers/release", {
      method: "POST",
      body: JSON.stringify({ locker_id: modal.existing.locker_id }),
    });
    setModal(null);
    loadLockers();
  };

  const addZone = async () => {
    if (!zoneForm.zone_name || !zoneForm.start_no || !zoneForm.end_no) {
      alert("구역명, 시작번호, 끝번호를 입력하세요");
      return;
    }
    await apiFetch("/api/locker-zones", {
      method: "POST",
      body: JSON.stringify({
        branch_name: branch,
        zone_name: zoneForm.zone_name,
        start_no: Number(zoneForm.start_no),
        end_no: Number(zoneForm.end_no),
        sort_order: Number(zoneForm.sort_order),
        cols: Number(zoneForm.cols) || 10,
      }),
    });
    setZoneForm({ zone_name: "", start_no: "", end_no: "", sort_order: "0", cols: "10" });
    loadZones();
  };

  const deleteZone = async (zone_id: number, zone_name: string) => {
    if (!confirm(`"${zone_name}" 구역을 삭제하시겠습니까? 배정된 락커 정보는 유지됩니다.`)) return;
    await apiFetch("/api/locker-zones", {
      method: "DELETE",
      body: JSON.stringify({ zone_id }),
    });
    loadZones();
  };

  const isAdmin = user?.role === "ADMIN" || user?.role === "OWNER" || user?.role === "DIRECTOR";

  const zoneNumbers = selectedZone
    ? Array.from({ length: selectedZone.end_no - selectedZone.start_no + 1 }, (_, i) => i + selectedZone.start_no)
    : [];

  const usedCount = selectedZone
    ? lockers.filter((l) => l.locker_zone === selectedZone.zone_name && l.member_name).length
    : 0;

  return (
    <AppShell title="락커 관리">
      {/* 상단 필터 */}
      <div className="card" style={{ marginBottom: 16, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        {(user?.role === "ADMIN" || user?.role === "OWNER") && (
          <select className="input" style={{ width: 140 }} value={branch} onChange={(e) => { setBranch(e.target.value); setSelectedZone(null); }}>
            <option value="">지점 선택</option>
            {branches.map((b) => <option key={b.option_value} value={b.option_value}>{b.option_name}</option>)}
          </select>
        )}

        {/* 구역 탭 - 단일 구역 선택 (설정 탭에서만) */}
        {branch && zones.length > 0 && tab === "settings" && (
          <div style={{ display: "flex", gap: 8 }}>
            {zones.map((z) => (
              <button
                key={z.zone_id}
                className={selectedZone?.zone_id === z.zone_id ? "btn" : "btn secondary"}
                onClick={() => setSelectedZone(z)}
              >
                {z.zone_name} ({z.start_no}~{z.end_no})
              </button>
            ))}
          </div>
        )}

        {branch && (
          <>
            <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
              {tab === "grid" && selectedZone && (
                <span style={{ fontSize: 13, color: "var(--muted)" }}>
                  사용중 <strong style={{ color: "var(--accent)" }}>{usedCount}</strong> / {zoneNumbers.length}
                </span>
              )}
              {isAdmin && (
                <button
                  className={tab === "settings" ? "btn" : "btn secondary"}
                  onClick={() => setTab(tab === "settings" ? "grid" : "settings")}
                >
                  {tab === "settings" ? "← 그리드" : "⚙ 구역 설정"}
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* 구역 없을 때 */}
      {!branch ? (
        <div className="card" style={{ textAlign: "center", color: "var(--muted)", padding: 40 }}>지점을 선택해주세요</div>
      ) : zones.length === 0 && tab !== "settings" ? (
        <div className="card" style={{ textAlign: "center", color: "var(--muted)", padding: 40 }}>
          구역이 없습니다. {isAdmin && <button className="btn" style={{ marginLeft: 12 }} onClick={() => setTab("settings")}>구역 설정하기</button>}
        </div>
      ) : null}

      {/* 구역 설정 탭 */}
      {tab === "settings" && branch && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 16 }}>구역 설정</div>

          {/* 현재 구역 목록 */}
          {zones.length > 0 && (
            <table className="table" style={{ marginBottom: 20 }}>
              <thead>
                <tr>
                  <th>구역명</th>
                  <th>시작번호</th>
                  <th>끝번호</th>
                  <th>총 수량</th>
                  <th>열 수</th>
                  <th>순서</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {zones.map((z) => (
                  <tr key={z.zone_id}>
                    <td><strong>{z.zone_name}</strong></td>
                    <td>{z.start_no}</td>
                    <td>{z.end_no}</td>
                    <td>{z.end_no - z.start_no + 1}개</td>
                    <td>
                      <input
                        type="number"
                        defaultValue={z.cols || 10}
                        style={{ width: 60, padding: "2px 6px", border: "1px solid var(--line)", borderRadius: 4, fontSize: 13 }}
                        onBlur={async (e) => {
                          const val = Number(e.target.value);
                          if (!val || val < 1) return;
                          await apiFetch("/api/locker-zones", { method: "PATCH", body: JSON.stringify({ zone_id: z.zone_id, cols: val }) });
                          loadZones();
                        }}
                      />
                    </td>
                    <td>{z.sort_order}</td>
                    <td>
                      <button
                        className="btn secondary"
                        style={{ fontSize: 12, padding: "4px 10px", color: "#ef4444" }}
                        onClick={() => deleteZone(z.zone_id, z.zone_name)}
                      >삭제</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* 새 구역 추가 */}
          <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 14 }}>새 구역 추가</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 80px 80px 80px", gap: 8, alignItems: "end" }}>
            <div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>구역명 (예: A구역, 남성)</div>
              <input className="input" value={zoneForm.zone_name} onChange={(e) => setZoneForm({ ...zoneForm, zone_name: e.target.value })} placeholder="A구역" />
            </div>
            <div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>시작번호</div>
              <input className="input" type="number" value={zoneForm.start_no} onChange={(e) => setZoneForm({ ...zoneForm, start_no: e.target.value })} placeholder="1" />
            </div>
            <div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>끝번호</div>
              <input className="input" type="number" value={zoneForm.end_no} onChange={(e) => setZoneForm({ ...zoneForm, end_no: e.target.value })} placeholder="50" />
            </div>
            <div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>열 수</div>
              <input className="input" type="number" value={zoneForm.cols} onChange={(e) => setZoneForm({ ...zoneForm, cols: e.target.value })} placeholder="10" />
            </div>
            <div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>순서</div>
              <input className="input" type="number" value={zoneForm.sort_order} onChange={(e) => setZoneForm({ ...zoneForm, sort_order: e.target.value })} placeholder="0" />
            </div>
            <button className="btn" onClick={addZone}>추가</button>
          </div>
        </div>
      )}

      {/* 락커 그리드 - 전체 구역 한 화면에 */}
      {tab === "grid" && branch && zones.length > 0 && (
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
          {zones.map((zone) => {
            const total = zone.end_no - zone.start_no + 1;
            const COLS = zone.cols || 10;
            const rows = Math.ceil(total / COLS);
            // 열 방향(세로 먼저) 순서로 번호 배열 - 이지스포와 동일
            const nums = Array.from({ length: COLS * rows }, (_, i) => {
              const col = i % COLS;
              const row = Math.floor(i / COLS);
              const no = col * rows + row + zone.start_no;
              return no <= zone.end_no ? no : null;
            });
            const zoneUsed = lockers.filter((l) => l.locker_zone === zone.zone_name && l.member_name).length;
            return (
              <div key={zone.zone_id} style={{ flex: "1 1 400px", minWidth: 340 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <div style={{ fontWeight: 900, fontSize: 18, background: "var(--accent)", color: "#fff", width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {zone.zone_name.charAt(0)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{zone.zone_name}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>사용 {zoneUsed} / {nums.length}</div>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: `repeat(${COLS}, 1fr)`, gap: 6 }}>
                  {nums.map((no, idx) => {
                    if (no === null) return <div key={`empty-${idx}`} />;
                    const locker = getLocker(no, zone.zone_name);
                    const used = !!locker?.member_name;
                    const expired = used && locker.end_date && new Date(locker.end_date) < new Date();
                    const hasLuggage = expired && locker.has_luggage === 1;
                    const borderColor = hasLuggage ? "#ec4899" : expired ? "#ef4444" : used ? "#3b82f6" : "var(--line)";
                    const bgColor = hasLuggage ? "rgba(236,72,153,0.12)" : expired ? "rgba(239,68,68,0.1)" : used ? "rgba(59,130,246,0.12)" : "var(--panel)";
                    const textColor = hasLuggage ? "#ec4899" : expired ? "#ef4444" : used ? "#3b82f6" : "var(--muted)";
                    return (
                      <div
                        key={no}
                        onClick={() => { setSelectedZone(zone); openModal(no); }}
                        style={{
                          padding: "10px 6px",
                          borderRadius: 8,
                          cursor: "pointer",
                          border: `2px solid ${borderColor}`,
                          background: bgColor,
                          textAlign: "center",
                          minHeight: 72,
                          transition: "transform 0.1s",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
                        onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                      >
                        <div style={{ fontSize: 14, fontWeight: 900, color: textColor }}>{no}</div>
                        {used && (
                          <>
                            <div style={{ fontSize: 10, fontWeight: 700, marginTop: 3, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{locker.member_name}</div>
                            <div style={{ fontSize: 9, color: hasLuggage ? "#ec4899" : expired ? "#ef4444" : "var(--muted)", marginTop: 1 }}>
                              {locker.end_date?.slice(0, 10)}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 배정 모달 */}
      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="card" style={{ width: 380, padding: 28 }}>
            <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 20 }}>
              {modal.zone} {modal.locker_no}번 락커
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "end" }}>
                <div>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>회원명</div>
                  <input className="input" value={form.member_name} onChange={(e) => setForm({ ...form, member_name: e.target.value })} placeholder="회원명 입력" />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>성별</div>
                  <select className="input" style={{ width: 80 }} value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                    <option value="">-</option>
                    <option value="남">남</option>
                    <option value="여">여</option>
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>시작일</div>
                  <input className="input" type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>종료일</div>
                  <input className="input" type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>메모</div>
                <input className="input" value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} placeholder="메모" />
              </div>
              {form.end_date && new Date(form.end_date) < new Date() && (
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 14 }}>
                  <input
                    type="checkbox"
                    checked={form.has_luggage === 1}
                    onChange={(e) => setForm({ ...form, has_luggage: e.target.checked ? 1 : 0 })}
                  />
                  <span style={{ color: "#ec4899", fontWeight: 700 }}>짐 미수령 (핑크 표시)</span>
                </label>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
              {modal.existing?.member_name && (
                <button className="btn secondary" style={{ color: "#ef4444" }} onClick={release}>비우기</button>
              )}
              <button className="btn secondary" style={{ marginLeft: "auto" }} onClick={() => setModal(null)}>취소</button>
              <button className="btn" onClick={assign}>저장</button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
