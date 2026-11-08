"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";

/**
 * 오늘의 마무리 운동 관리 (지점·날짜별 3개 운동).
 * 기본값: 담당 지점 + 한국 시간 오늘. 임시 저장 / 게시 / 게시 취소, 지난 운동 복사(새 날짜 임시 저장).
 */
type Item = { name: string; amount: string; note: string };
const emptyItems = (): Item[] => [0, 1, 2].map(() => ({ name: "", amount: "", note: "" }));
const STATUS: Record<string, string> = { DRAFT: "임시 저장", PUBLISHED: "게시 중", UNPUBLISHED: "게시 취소" };

export default function FinishersPage() {
  const [user, setUser] = useState<{ role: string; branch_name: string | null } | null>(null);
  const [branches, setBranches] = useState<string[]>([]);
  const [branch, setBranch] = useState("");
  const [today, setToday] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [exercises, setExercises] = useState<string[]>([]);
  const [amounts, setAmounts] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [id, setId] = useState<number | null>(null);
  const [date, setDate] = useState("");
  const [status, setStatus] = useState("DRAFT");
  const [items, setItems] = useState<Item[]>(emptyItems());
  const [rounds, setRounds] = useState("");
  const [rest, setRest] = useState("");
  const [note, setNote] = useState("");
  const [copyDate, setCopyDate] = useState<Record<number, string>>({});

  const isHq = user?.role === "ADMIN" || user?.role === "OWNER";

  const load = async (b = branch) => {
    setErr(null);
    const res = await fetch(`/api/finishers${b ? `?branch_name=${encodeURIComponent(b)}` : ""}`, { cache: "no-store" });
    const d = await res.json().catch(() => ({}));
    if (!res.ok || !d.success) {
      setErr(d.message || "조회 실패");
      return null;
    }
    setUser(d.user);
    setRows(d.rows || []);
    setExercises(d.exercises || []);
    setAmounts(d.amounts || []);
    setToday(d.today);
    return d;
  };

  useEffect(() => {
    fetch("/api/settings?option_type=BRANCH")
      .then((r) => r.json())
      .then((d) => setBranches((d.rows || []).map((x: any) => x.option_name)))
      .catch(() => {});
    load("").then((d) => {
      if (!d) return;
      const b = d.user.branch_name || "";
      setBranch(b);
      setDate(d.today);
      if (b) load(b);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 지점·날짜가 바뀌면 그 날 등록된 것을 불러오고, 없으면 새로 작성
  useEffect(() => {
    if (!branch || !date) return;
    const r = rows.find((x) => x.branch_name === branch && String(x.finisher_date).slice(0, 10) === date);
    if (r) {
      const its = typeof r.items === "string" ? JSON.parse(r.items) : r.items;
      setId(r.finisher_id);
      setStatus(r.status);
      setItems([0, 1, 2].map((i) => ({ name: its?.[i]?.name || "", amount: its?.[i]?.amount || "", note: its?.[i]?.note || "" })));
      setRounds(r.rounds ? String(r.rounds) : "");
      setRest(r.rest_seconds ? String(r.rest_seconds) : "");
      setNote(r.note || "");
    } else {
      setId(null);
      setStatus("DRAFT");
      setItems(emptyItems());
      setRounds("");
      setRest("");
      setNote("");
    }
  }, [branch, date, rows]);

  const setItem = (i: number, patch: Partial<Item>) => setItems(items.map((it, k) => (k === i ? { ...it, ...patch } : it)));
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j > 2) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    setItems(next);
  };

  const save = async (nextStatus: string) => {
    if (busy) return;
    if (nextStatus === "PUBLISHED" && items.some((i) => !i.name.trim() || !i.amount.trim())) return alert("게시하려면 운동 3개의 운동명과 횟수(시간)를 모두 입력해 주세요.");
    setBusy(true);
    const body = { branch_name: branch, finisher_date: date, items, rounds, rest_seconds: rest, note, status: nextStatus };
    const res = await fetch(id ? `/api/finishers/${id}` : "/api/finishers", {
      method: id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!d.success) return alert(d.message || "저장 실패");
    await load(branch);
  };

  const copy = async (srcId: number) => {
    const target = copyDate[srcId];
    if (!target) return alert("복사할 날짜를 선택해 주세요.");
    const res = await fetch(`/api/finishers/${srcId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ finisher_date: target, branch_name: branch }) });
    const d = await res.json().catch(() => ({}));
    if (!d.success) return alert(d.message || "복사 실패");
    await load(branch);
    setDate(target); // 복사된 임시 저장본을 바로 수정
  };

  const label = { fontSize: 12, color: "#94a3b8" } as const;

  return (
    <AppShell title="마무리 운동">
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 30, fontWeight: 900 }}>오늘의 마무리 운동</h1>
        <p style={{ color: "#aaa", marginTop: 8 }}>지점·날짜별 마무리 운동 3개를 등록합니다. 게시한 날짜·지점의 회원 앱 홈에만 표시됩니다.</p>
      </div>
      {err && <div className="card" style={{ color: "#fca5a5", marginBottom: 12 }}>{err} {err.includes("세션") && "— 로그아웃 후 다시 로그인해 주세요."}</div>}

      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end" }}>
          <label>
            <span style={label}>지점</span>
            <select className="input" value={branch} disabled={!isHq} onChange={(e) => { setBranch(e.target.value); load(e.target.value); }}>
              <option value="">선택</option>
              {(isHq ? branches : [user?.branch_name || ""]).filter(Boolean).map((b) => <option key={b}>{b}</option>)}
            </select>
          </label>
          <label>
            <span style={label}>날짜</span>
            <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          {date && date === today && <span className="badge">오늘</span>}
          <span className="badge">{id ? STATUS[status] : "새로 작성"}</span>
        </div>

        <datalist id="sbm-exercises">{exercises.map((x) => <option key={x} value={x} />)}</datalist>
        {items.map((it, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "28px 1.4fr 1fr 1.6fr auto", gap: 8, marginTop: 12, alignItems: "center" }}>
            <b style={{ fontSize: 18 }}>{i + 1}</b>
            <input className="input" list="sbm-exercises" placeholder="운동명 (선택 또는 입력)" value={it.name} onChange={(e) => setItem(i, { name: e.target.value })} />
            <div>
              <input className="input" style={{ width: "100%" }} placeholder="20회 / 30초" value={it.amount} onChange={(e) => setItem(i, { amount: e.target.value })} />
              <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
                {amounts.map((a) => (
                  <button key={a} type="button" onClick={() => setItem(i, { amount: a })} style={{ fontSize: 11, padding: "2px 6px", borderRadius: 6, border: "1px solid #475569", background: it.amount === a ? "#ef4444" : "transparent", color: "#e2e8f0" }}>{a}</button>
                ))}
              </div>
            </div>
            <input className="input" placeholder="설명 (선택)" value={it.note} onChange={(e) => setItem(i, { note: e.target.value })} />
            <div style={{ display: "flex", gap: 4 }}>
              <button className="btn" style={{ padding: "4px 8px" }} disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
              <button className="btn" style={{ padding: "4px 8px" }} disabled={i === 2} onClick={() => move(i, 1)}>↓</button>
            </div>
          </div>
        ))}

        <div style={{ display: "grid", gridTemplateColumns: "120px 140px 1fr", gap: 8, marginTop: 14 }}>
          <label><span style={label}>라운드 수 (선택)</span><input className="input" type="number" min={1} value={rounds} onChange={(e) => setRounds(e.target.value)} /></label>
          <label><span style={label}>라운드 휴식(초, 선택)</span><input className="input" type="number" min={0} value={rest} onChange={(e) => setRest(e.target.value)} /></label>
          <label><span style={label}>공통 안내 (선택)</span><input className="input" style={{ width: "100%" }} value={note} onChange={(e) => setNote(e.target.value)} /></label>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
          <button className="btn" disabled={busy || !branch || !date} onClick={() => save("PUBLISHED")}>{status === "PUBLISHED" ? "수정 저장(게시 유지)" : "게시하기"}</button>
          {status !== "PUBLISHED" && <button className="btn" style={{ background: "#334155" }} disabled={busy || !branch || !date} onClick={() => save("DRAFT")}>임시 저장</button>}
          {id && status === "PUBLISHED" && <button className="btn" style={{ background: "#7f1d1d" }} disabled={busy} onClick={() => confirm("회원 앱에서 내릴까요?") && save("UNPUBLISHED")}>게시 취소</button>}
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>{branch || "지점"} 등록 내역</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>날짜</th><th>상태</th><th>운동</th><th>복사</th></tr></thead>
            <tbody>
              {rows.map((r) => {
                const its = typeof r.items === "string" ? JSON.parse(r.items) : r.items;
                const d = String(r.finisher_date).slice(0, 10);
                return (
                  <tr key={r.finisher_id}>
                    <td><button className="btn" style={{ padding: "4px 8px" }} onClick={() => { setBranch(r.branch_name); setDate(d); }}>{d}</button></td>
                    <td>{STATUS[r.status]}</td>
                    <td>{(its || []).map((x: any) => `${x.name} ${x.amount}`).filter((s: string) => s.trim()).join(" / ")}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <input type="date" className="input" style={{ width: 140 }} value={copyDate[r.finisher_id] || ""} onChange={(e) => setCopyDate({ ...copyDate, [r.finisher_id]: e.target.value })} />{" "}
                      <button className="btn" style={{ padding: "4px 8px" }} onClick={() => copy(r.finisher_id)}>복사</button>
                    </td>
                  </tr>
                );
              })}
              {!rows.length && <tr><td colSpan={4} style={{ color: "#94a3b8", textAlign: "center" }}>등록된 마무리 운동이 없습니다.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
