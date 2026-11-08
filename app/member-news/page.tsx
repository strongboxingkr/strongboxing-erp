"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { apiFetch } from "@/lib/api";

/**
 * 회원 앱 소식 관리: 대상 지점 선택 → 작성 / 수정 / 게시 / 숨김.
 * 게시(PUBLISHED)한 휴무·운영시간 변경·중요 공지는 회원 앱 알림으로 발송됩니다(수정 시 재발송 없음).
 */
const CATEGORY = [
  ["NOTICE", "공지"],
  ["CLOSURE", "휴무"],
  ["HOURS", "운영시간 변경"],
  ["EVENT", "이벤트"],
  ["BLOG", "블로그 링크"],
] as const;
const STATUS: Record<string, string> = { DRAFT: "임시저장", PUBLISHED: "게시 중", HIDDEN: "숨김" };

const empty = {
  news_id: 0,
  branch_name: "",
  category: "NOTICE",
  title: "",
  body: "",
  is_pinned: false,
  start_date: "",
  end_date: "",
  hours_text: "",
  link_url: "",
  thumbnail_url: "",
  status: "DRAFT",
};

export default function MemberNewsPage() {
  const [user, setUser] = useState<any>(null);
  const [branches, setBranches] = useState<string[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState<any>(empty);
  const [links, setLinks] = useState<any[]>([]);
  const [linkForm, setLinkForm] = useState({ branch_name: "", kakao_chat_url: "", naver_blog_id: "" });
  const [filter, setFilter] = useState("전체보기");
  const [saving, setSaving] = useState(false);

  const isAdmin = user?.role === "ADMIN" || user?.role === "OWNER";

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem("user") || "null");
      setUser(u);
      if (u && !(u.role === "ADMIN" || u.role === "OWNER")) setForm({ ...empty, branch_name: u.branch_name });
    } catch {}
    apiFetch("/api/settings?option_type=BRANCH")
      .then((r) => r.json())
      .then((d) => setBranches((d.rows || []).map((b: any) => b.option_name)));
    load();
    loadLinks();
  }, []);

  const load = async () => {
    const d = await (await apiFetch("/api/member-news")).json();
    if (!d.success) alert(d.message || "조회 실패");
    setRows(d.rows || []);
  };
  const loadLinks = async () => {
    const d = await (await apiFetch("/api/member-news/branch-links")).json();
    setLinks(d.rows || []);
  };

  const save = async (status?: string) => {
    const body = { ...form, status: status || form.status };
    if (body.status === "PUBLISHED" && !confirm(`[${body.branch_name}] 회원 앱에 게시할까요?\n휴무·운영시간 변경·중요 공지는 해당 회원에게 알림이 발송됩니다.`)) return;
    setSaving(true);
    const res = await apiFetch("/api/member-news", { method: form.news_id ? "PUT" : "POST", body: JSON.stringify(body) });
    const d = await res.json();
    setSaving(false);
    if (!d.success) return alert(d.message || "저장 실패");
    setForm(isAdmin ? empty : { ...empty, branch_name: user?.branch_name });
    load();
  };

  const setStatus = async (row: any, status: string) => {
    const res = await apiFetch("/api/member-news", { method: "PUT", body: JSON.stringify({ ...row, is_pinned: !!row.is_pinned, status }) });
    const d = await res.json();
    if (!d.success) return alert(d.message || "변경 실패");
    load();
  };

  const edit = (r: any) => {
    setForm({
      ...empty,
      ...r,
      is_pinned: !!r.is_pinned,
      start_date: r.start_date ? String(r.start_date).slice(0, 10) : "",
      end_date: r.end_date ? String(r.end_date).slice(0, 10) : "",
      hours_text: r.hours_text || "",
      link_url: r.link_url || "",
      thumbnail_url: r.thumbnail_url || "",
      body: r.body || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveLink = async () => {
    const res = await apiFetch("/api/member-news/branch-links", { method: "PUT", body: JSON.stringify(linkForm) });
    const d = await res.json();
    if (!d.success) return alert(d.message || "저장 실패");
    alert(d.blogTitle ? `저장 완료 (블로그 확인: ${d.blogTitle})` : "저장 완료");
    loadLinks();
  };

  const needsDate = form.category === "CLOSURE" || form.category === "HOURS" || form.category === "EVENT";
  const shown = rows.filter((r) => filter === "전체보기" || r.branch_name === filter);
  const label = { fontSize: 13, color: "#94a3b8", marginBottom: 4, display: "block" } as const;

  return (
    <AppShell title="회원앱 소식">
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 30, fontWeight: 900 }}>회원앱 소식</h1>
        <p style={{ color: "#aaa", marginTop: 8 }}>
          회원 앱 &gt; 소식 탭에 보이는 공지·휴무·운영시간 변경·이벤트·블로그 링크를 관리합니다. 직원용 공지사항과는 별도입니다.
        </p>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ marginTop: 0 }}>{form.news_id ? `소식 수정 #${form.news_id}` : "새 소식 작성"}</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          <label>
            <span style={label}>대상 지점</span>
            <select className="input" value={form.branch_name} disabled={!isAdmin} onChange={(e) => setForm({ ...form, branch_name: e.target.value })}>
              <option value="">선택</option>
              {isAdmin && <option value="전체">전체 지점 공통</option>}
              {(isAdmin ? branches : [user?.branch_name]).filter(Boolean).map((b: string) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          </label>
          <label>
            <span style={label}>분류</span>
            <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {CATEGORY.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          {needsDate && (
            <>
              <label>
                <span style={label}>{form.category === "CLOSURE" ? "휴무 시작일" : "적용 시작일"}</span>
                <input type="date" className="input" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
              </label>
              <label>
                <span style={label}>종료일 (하루면 비움)</span>
                <input type="date" className="input" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
              </label>
            </>
          )}
          {form.category === "HOURS" && (
            <label>
              <span style={label}>변경 운영시간</span>
              <input className="input" placeholder="14:00~20:00" value={form.hours_text} onChange={(e) => setForm({ ...form, hours_text: e.target.value })} />
            </label>
          )}
        </div>

        <label style={{ display: "block", marginTop: 12 }}>
          <span style={label}>제목</span>
          <input className="input" style={{ width: "100%" }} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="예) 11월 15일(토) 내부 공사로 휴무합니다" />
        </label>
        <label style={{ display: "block", marginTop: 12 }}>
          <span style={label}>내용</span>
          <textarea className="input" style={{ width: "100%", minHeight: 110 }} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
        </label>
        {(form.category === "BLOG" || form.category === "EVENT") && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
            <label>
              <span style={label}>{form.category === "BLOG" ? "블로그 글 주소 (필수)" : "자세히 보기 링크 (선택)"}</span>
              <input className="input" style={{ width: "100%" }} placeholder="https://blog.naver.com/..." value={form.link_url} onChange={(e) => setForm({ ...form, link_url: e.target.value })} />
            </label>
            <label>
              <span style={label}>썸네일 이미지 주소 (선택)</span>
              <input className="input" style={{ width: "100%" }} placeholder="https://..." value={form.thumbnail_url} onChange={(e) => setForm({ ...form, thumbnail_url: e.target.value })} />
            </label>
          </div>
        )}
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
          <input type="checkbox" checked={form.is_pinned} onChange={(e) => setForm({ ...form, is_pinned: e.target.checked })} />
          중요 공지 (회원 앱 상단 고정 + 알림 발송)
        </label>

        <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
          <button className="btn" disabled={saving} onClick={() => save("PUBLISHED")}>
            {form.news_id && form.status === "PUBLISHED" ? "수정 저장" : "게시하기"}
          </button>
          {form.status !== "PUBLISHED" && (
            <button className="btn" disabled={saving} style={{ background: "#334155" }} onClick={() => save("DRAFT")}>
              임시저장
            </button>
          )}
          {form.news_id > 0 && (
            <button className="btn" style={{ background: "#334155" }} onClick={() => setForm(isAdmin ? empty : { ...empty, branch_name: user?.branch_name })}>
              새로 작성
            </button>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h2 style={{ margin: 0 }}>소식 목록</h2>
          <select className="input" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ width: 160 }}>
            <option>전체보기</option>
            <option>전체</option>
            {branches.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
        </div>
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table>
            <thead>
              <tr>
                <th>상태</th>
                <th>지점</th>
                <th>분류</th>
                <th>제목</th>
                <th>기간</th>
                <th>게시일</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.news_id}>
                  <td>{STATUS[r.status]}</td>
                  <td>{r.branch_name === "전체" ? "전체 지점" : r.branch_name}</td>
                  <td>
                    {CATEGORY.find((c) => c[0] === r.category)?.[1]}
                    {r.is_pinned ? " · 중요" : ""}
                  </td>
                  <td>{r.title}</td>
                  <td>
                    {r.start_date ? String(r.start_date).slice(0, 10) : ""}
                    {r.end_date && r.end_date !== r.start_date ? ` ~ ${String(r.end_date).slice(0, 10)}` : ""}
                    {r.hours_text ? ` ${r.hours_text}` : ""}
                  </td>
                  <td>{r.published_at ? String(r.published_at).slice(0, 16) : "-"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button className="btn" style={{ padding: "6px 10px" }} onClick={() => edit(r)}>
                      수정
                    </button>{" "}
                    {r.status === "PUBLISHED" ? (
                      <button className="btn" style={{ padding: "6px 10px", background: "#7f1d1d" }} onClick={() => confirm("회원 앱에서 숨길까요?") && setStatus(r, "HIDDEN")}>
                        숨김
                      </button>
                    ) : (
                      <button className="btn" style={{ padding: "6px 10px" }} onClick={() => confirm("회원 앱에 게시할까요? (해당 회원에게 알림이 갈 수 있습니다)") && setStatus(r, "PUBLISHED")}>
                        게시
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!shown.length && (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", color: "#94a3b8" }}>
                    등록된 회원 소식이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>지점 연결 정보</h2>
        <p style={{ color: "#94a3b8", marginTop: 0, fontSize: 14 }}>
          회원 앱의 카카오톡 문의 버튼과 네이버 블로그 자동 연동(RSS)에 사용합니다. 전화번호·운영시간은 홈페이지 관리 &gt; 지점관리 값을 그대로 씁니다.
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>지점</th>
                <th>카카오톡 채널</th>
                <th>네이버 블로그 ID</th>
              </tr>
            </thead>
            <tbody>
              {branches.map((b) => {
                const l = links.find((x) => x.branch_name === b);
                return (
                  <tr key={b} onClick={() => isAdmin && setLinkForm({ branch_name: b, kakao_chat_url: l?.kakao_chat_url || "", naver_blog_id: l?.naver_blog_id || "" })} style={{ cursor: isAdmin ? "pointer" : "default" }}>
                    <td>{b}</td>
                    <td>{l?.kakao_chat_url || <span style={{ color: "#94a3b8" }}>미등록</span>}</td>
                    <td>{l?.naver_blog_id || <span style={{ color: "#94a3b8" }}>미연동</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {isAdmin && linkForm.branch_name && (
          <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 1fr auto", gap: 8, marginTop: 12, alignItems: "center" }}>
            <b>{linkForm.branch_name}</b>
            <input className="input" placeholder="https://pf.kakao.com/_xxxx/chat" value={linkForm.kakao_chat_url} onChange={(e) => setLinkForm({ ...linkForm, kakao_chat_url: e.target.value })} />
            <input className="input" placeholder="블로그 ID 또는 주소" value={linkForm.naver_blog_id} onChange={(e) => setLinkForm({ ...linkForm, naver_blog_id: e.target.value })} />
            <button className="btn" onClick={saveLink}>
              저장
            </button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
