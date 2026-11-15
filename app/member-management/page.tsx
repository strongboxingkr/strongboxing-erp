"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { apiFetch } from "@/lib/api";

type Row = {
  member_id: number;
  branch_name: string;
  name: string;
  phone: string;
  pass_type: string;
  remaining_count: number | null;
  end_date: string | null;
  status: string;
  product_name: string | null;
  alert_type: string | null;
};

const EXPIRY_DAYS = 3;
const COUNT_THRESHOLD = 3;

const getAlertBadgeStyle = (alert_type: string | null) => {
  if (!alert_type) return { bg: "#f3f4f6", color: "#6b7280" };
  if (alert_type.includes("기간 만료") || alert_type.includes("횟수 소진")) return { bg: "#fee2e2", color: "#dc2626" };
  if (alert_type.includes("오늘")) return { bg: "#fef3c7", color: "#d97706" };
  if (alert_type.includes("1일")) return { bg: "#fef9c3", color: "#ca8a04" };
  if (alert_type.includes("횟수 부족")) return { bg: "#f3e8ff", color: "#7c3aed" };
  return { bg: "#dbeafe", color: "#1d4ed8" };
};

type Tab = "전체" | "만료 예정" | "횟수 부족" | "만료·소진";
const TABS: Tab[] = ["전체", "만료 예정", "횟수 부족", "만료·소진"];

function MemberManagementInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as Tab) || "전체";

  const [rows, setRows] = useState<Row[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [branch, setBranch] = useState("전체");
  const [search, setSearch] = useState("");
  const [user, setUser] = useState<any>(null);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [loading, setLoading] = useState(false);

  const isAdminOrOwner = user?.role === "ADMIN" || user?.role === "OWNER";

  const load = useCallback(async (currentUser = user, currentBranch = branch) => {
    setLoading(true);
    let url = "/api/member-management";
    const params: string[] = [];
    if (currentUser && currentUser.role !== "ADMIN" && currentUser.role !== "OWNER") {
      params.push(`branch_name=${encodeURIComponent(currentUser.branch_name)}`);
    } else if (currentBranch !== "전체") {
      params.push(`branch_name=${encodeURIComponent(currentBranch)}`);
    }
    if (params.length) url += "?" + params.join("&");
    const res = await apiFetch(url);
    const data = await res.json();
    setRows(data.rows || []);
    setLoading(false);
  }, [user, branch]);

  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    const u = savedUser ? JSON.parse(savedUser) : null;
    setUser(u);
    apiFetch("/api/settings?option_type=BRANCH").then(r => r.json()).then(d => setBranches(d.rows || []));
    load(u, "전체");
  }, []);

  useEffect(() => {
    if (user) load(user, branch);
  }, [branch]);

  const handleMemberClick = (member_id: number) => {
    const params = new URLSearchParams({ tab, branch, search });
    router.push(`/members/${member_id}?back=/member-management&${params}`);
  };

  const filterRows = (all: Row[]): Row[] => {
    let filtered = all;
    if (tab === "만료 예정") {
      filtered = all.filter(r =>
        r.pass_type === "DATE" &&
        r.end_date &&
        new Date(r.end_date.slice(0, 10)) >= new Date(new Date().toISOString().slice(0, 10))
      );
    } else if (tab === "횟수 부족") {
      filtered = all.filter(r =>
        r.pass_type === "COUNT" &&
        r.remaining_count !== null &&
        r.remaining_count > 0 &&
        r.remaining_count <= COUNT_THRESHOLD
      );
    } else if (tab === "만료·소진") {
      filtered = all.filter(r =>
        (r.pass_type === "DATE" && r.end_date && new Date(r.end_date.slice(0, 10)) < new Date(new Date().toISOString().slice(0, 10))) ||
        (r.pass_type === "COUNT" && (r.remaining_count === 0 || r.remaining_count === null))
      );
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(r =>
        r.name.toLowerCase().includes(q) || (r.phone || "").replace(/-/g, "").includes(q.replace(/-/g, ""))
      );
    }
    return filtered;
  };

  const displayRows = filterRows(rows);

  const tabCounts: Record<Tab, number> = {
    "전체": filterRows(rows).length,
    "만료 예정": rows.filter(r => r.pass_type === "DATE" && r.end_date && new Date(r.end_date.slice(0, 10)) >= new Date(new Date().toISOString().slice(0, 10))).length,
    "횟수 부족": rows.filter(r => r.pass_type === "COUNT" && r.remaining_count !== null && r.remaining_count > 0 && r.remaining_count <= COUNT_THRESHOLD).length,
    "만료·소진": rows.filter(r =>
      (r.pass_type === "DATE" && r.end_date && new Date(r.end_date.slice(0, 10)) < new Date(new Date().toISOString().slice(0, 10))) ||
      (r.pass_type === "COUNT" && (r.remaining_count === 0 || r.remaining_count === null))
    ).length,
  };

  return (
    <AppShell title="회원권 관리">
      <style>{`
        .mm-toolbar { display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-bottom:12px; }
        .mm-search { height:36px; padding:0 10px; border:1px solid #e2e5eb; border-radius:7px; font-size:13px; width:200px; outline:none; }
        .mm-search:focus { border-color:#1d4ed8; }
        .mm-info { font-size:12px; color:#9ca3af; padding:4px 0; margin-bottom:8px; }
        .mm-tabs { display:flex; gap:0; border-bottom:2px solid #e2e5eb; margin-bottom:0; }
        .mm-tab { padding:9px 18px; font-size:13px; font-weight:600; color:#6b7280; cursor:pointer; border-bottom:2px solid transparent; margin-bottom:-2px; white-space:nowrap; background:none; border-top:none; border-left:none; border-right:none; }
        .mm-tab.active { color:#0f2044; border-bottom-color:#0f2044; }
        .mm-tab-count { font-size:11px; font-weight:700; background:#f3f4f6; color:#6b7280; border-radius:999px; padding:1px 6px; margin-left:5px; }
        .mm-tab.active .mm-tab-count { background:#0f2044; color:#fff; }
        .mm-wrap { background:#fff; border:1px solid #e2e5eb; border-radius:10px; overflow:hidden; }
        .mm-table { width:100%; border-collapse:collapse; font-size:14px; }
        .mm-table th { text-align:left; padding:10px 14px; font-size:11px; font-weight:700; color:#9ca3af; border-bottom:1px solid #e2e5eb; white-space:nowrap; background:#f9fafb; }
        .mm-table td { padding:11px 14px; border-bottom:1px solid #f1f3f5; vertical-align:middle; }
        .mm-table tr:last-child td { border-bottom:none; }
        .mm-table tr:hover td { background:#f8faff; }
        .mm-name-btn { background:none; border:none; font-size:14px; font-weight:700; color:#0f2044; cursor:pointer; padding:0; text-align:left; text-decoration:underline; text-underline-offset:2px; }
        .mm-name-btn:hover { color:#1d4ed8; }
        .mm-badge { display:inline-block; padding:2px 8px; border-radius:999px; font-size:11px; font-weight:700; white-space:nowrap; }
        .mm-detail-btn { height:28px; padding:0 10px; font-size:12px; border:1px solid #e2e5eb; border-radius:5px; background:#fff; color:#374151; cursor:pointer; }
        .mm-detail-btn:hover { background:#f4f5f7; }
        .mm-empty { padding:40px 24px; text-align:center; color:#9ca3af; font-size:13px; }

        /* 모바일 */
        @media(max-width:720px) {
          .mm-table thead { display:none; }
          .mm-table, .mm-table tbody, .mm-table tr, .mm-table td { display:block; width:100%; }
          .mm-table tr { padding:12px 14px; border-bottom:1px solid #f1f3f5; }
          .mm-table tr:last-child { border-bottom:none; }
          .mm-table td { padding:0; border:none; }
          .mm-table td[data-hide-mobile] { display:none; }
          .mm-row-top { display:flex; align-items:center; gap:8px; margin-bottom:4px; }
          .mm-row-bot { font-size:12px; color:#6b7280; margin-top:3px; }
        }
      `}</style>

      {/* 도구줄 */}
      <div className="mm-toolbar">
        {isAdminOrOwner && (
          <select className="input" style={{ height: 36, fontSize: 13, width: 130 }} value={branch}
            onChange={(e) => setBranch(e.target.value)}>
            <option>전체</option>
            {branches.map((b: any) => <option key={b.option_id}>{b.option_name}</option>)}
          </select>
        )}
        <input className="mm-search" placeholder="이름 또는 전화번호" value={search}
          onChange={(e) => setSearch(e.target.value)} />
        <button className="btn secondary" style={{ height: 36, fontSize: 13 }}
          onClick={() => load(user, branch)}>새로고침</button>
      </div>

      {/* 조회 기준 안내 */}
      <div className="mm-info">
        조회 기준: 기간권 오늘~{EXPIRY_DAYS}일 이내 만료 예정 · 횟수권 {COUNT_THRESHOLD}회 이하 · 이미 만료·소진된 활성 회원 포함 &nbsp;|&nbsp; 휴회·삭제·미래 시작 회원은 제외됩니다.
      </div>

      {/* 탭 + 목록 */}
      <div className="mm-wrap">
        <div className="mm-tabs">
          {TABS.map(t => (
            <button key={t} className={`mm-tab${tab === t ? " active" : ""}`} onClick={() => setTab(t)}>
              {t}<span className="mm-tab-count">{tabCounts[t]}</span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="mm-empty">불러오는 중...</div>
        ) : displayRows.length === 0 ? (
          <div className="mm-empty">해당하는 회원이 없습니다.</div>
        ) : (
          <table className="mm-table">
            <thead>
              <tr>
                <th>회원명</th>
                <th>지점</th>
                <th>회원권</th>
                <th>만료일</th>
                <th>잔여횟수</th>
                <th>관리 사유</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map(r => {
                const { bg, color } = getAlertBadgeStyle(r.alert_type);
                const isDate = r.pass_type === "DATE";
                return (
                  <tr key={r.member_id}>
                    <td>
                      <div className="mm-row-top">
                        <button className="mm-name-btn" onClick={() => handleMemberClick(r.member_id)}>
                          {r.name}
                        </button>
                      </div>
                      <div className="mm-row-bot" style={{ display: "none" }}>
                        {/* 모바일에서 mm-row-top/bot 렌더 */}
                      </div>
                    </td>
                    <td data-hide-mobile="">{r.branch_name}</td>
                    <td>{r.product_name || <span style={{ color: "#9ca3af" }}>—</span>}</td>
                    <td>{isDate ? (r.end_date?.slice(0, 10) || "—") : <span style={{ color: "#9ca3af", fontSize: 12 }}>해당 없음</span>}</td>
                    <td>{!isDate ? (r.remaining_count ?? 0) + "회" : <span style={{ color: "#9ca3af", fontSize: 12 }}>해당 없음</span>}</td>
                    <td>
                      <span className="mm-badge" style={{ background: bg, color }}>
                        {r.alert_type || "—"}
                      </span>
                    </td>
                    <td>
                      <button className="mm-detail-btn"
                        onClick={() => handleMemberClick(r.member_id)}>
                        상세
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </AppShell>
  );
}

export default function MemberManagementPage() {
  return (
    <Suspense>
      <MemberManagementInner />
    </Suspense>
  );
}
