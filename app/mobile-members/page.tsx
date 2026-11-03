"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";

const formatDate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};

const today = formatDate(new Date());

function addMonths(dateString: string, months: number) {
  const date = new Date(dateString);
  date.setMonth(date.getMonth() + months);
  return formatDate(date);
}

const money = (v: any) => `${Number(v || 0).toLocaleString()}원`;

const makeDefaultForm = () => ({
  member_id: null as any,
  branch_name: "철산점",
  name: "", phone: "", checkin_code: "",
  pass_type: "PERIOD", product_name: "", remaining_count: 0,
  start_date: today, end_date: addMonths(today, 1),
  status: "ACTIVE", memo: "", locker_no: "", member_no: "",
  gender: "", birth_date: "", emergency_contact: "",
  address: "", join_date: today, staff_name: "",
});

function getStatus(m: any) {
  if (m.status === "REST") return { text: "휴회", color: "#f59e0b", bg: "#fef3c7" };
  if (m.status === "EXPIRED") return { text: "만료", color: "#ef4444", bg: "#fee2e2" };
  if (m.pass_type === "COUNT" && Number(m.remaining_count || 0) <= 0) return { text: "소진", color: "#ef4444", bg: "#fee2e2" };

  if (m.pass_type === "PERIOD" && m.end_date) {
    const diff = (new Date(m.end_date.slice(0, 10)).getTime() - new Date().setHours(0,0,0,0)) / 86400000;
    if (diff <= 7) return { text: "만료임박", color: "#dc2626", bg: "#fee2e2" };
  }
  if (m.pass_type === "COUNT" && Number(m.remaining_count || 0) <= 3) return { text: "잔여부족", color: "#d97706", bg: "#fef3c7" };

  return { text: "정상", color: "#16a34a", bg: "#dcfce7" };
}

function daysLeft(dateStr: string) {
  const diff = Math.ceil((new Date(dateStr.slice(0, 10)).getTime() - new Date().setHours(0,0,0,0)) / 86400000);
  if (diff < 0) return `${Math.abs(diff)}일 초과`;
  if (diff === 0) return "오늘 만료";
  return `D-${diff}`;
}

type StatusFilter = "전체" | "정상" | "만료임박" | "만료" | "휴회";
const STATUS_FILTERS: StatusFilter[] = ["전체", "정상", "만료임박", "만료", "휴회"];

const getQueryValue = (key: string) => {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get(key) || "";
};

export default function MobileMembersPage() {
  const [user, setUser] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [branches, setBranches] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState("전체");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("전체");
  const [showForm, setShowForm] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [form, setForm] = useState(makeDefaultForm());
  const scrollRef = useRef<number>(0);

  const getUser = () => {
    try { return JSON.parse(localStorage.getItem("user") || "null"); } catch { return null; }
  };

  const isAdminOrOwner = user?.role === "ADMIN" || user?.role === "OWNER";

  const loadBranches = async () => {
    const res = await apiFetch("/api/settings?option_type=BRANCH");
    const json = await res.json();
    setBranches(json.rows || []);
  };

  const loadProducts = async () => {
    const res = await apiFetch("/api/settings?option_type=PASS_PRODUCT");
    const json = await res.json();
    setProducts(json.rows || []);
  };

  const loadMembers = async (targetUser = user, keepScroll = false) => {
    if (keepScroll) scrollRef.current = window.scrollY;
    let url = "/api/members";
    const params: string[] = [];

    if (targetUser && !["ADMIN", "OWNER"].includes(targetUser.role)) {
      params.push(`branch_name=${encodeURIComponent(targetUser.branch_name)}`);
    } else if (["ADMIN", "OWNER"].includes(targetUser?.role) && branchFilter !== "전체") {
      params.push(`branch_name=${encodeURIComponent(branchFilter)}`);
    }

    if (search.trim()) params.push(`search=${encodeURIComponent(search.trim())}`);
    if (params.length > 0) url += `?${params.join("&")}`;

    const res = await apiFetch(url);
    const json = await res.json();
    const rows = json.rows || [];
    setMembers(rows);
    setTotalCount(rows.length);

    if (keepScroll) setTimeout(() => window.scrollTo(0, scrollRef.current), 50);
  };

  useEffect(() => {
    const savedUser = getUser();
    if (!savedUser) { window.location.replace("/login"); return; }
    setUser(savedUser);

    const querySearch = getQueryValue("q");
    if (querySearch) setSearch(querySearch);

    const queryName = getQueryValue("name");
    const queryPhone = getQueryValue("phone");
    if (queryName || queryPhone) {
      setShowForm(true);
      setIsEdit(false);
      setForm((prev) => ({
        ...prev,
        name: queryName,
        phone: queryPhone,
        branch_name: ["ADMIN", "OWNER"].includes(savedUser?.role) ? prev.branch_name : savedUser?.branch_name,
      }));
    }

    loadBranches();
    loadProducts();
    loadMembers(savedUser);
  }, []);

  useEffect(() => {
    if (user) loadMembers(user);
  }, [branchFilter]);

  const doSearch = () => loadMembers(user);

  const openAdd = () => {
    setIsEdit(false);
    setForm({
      ...makeDefaultForm(),
      branch_name: isAdminOrOwner ? (branches[0]?.option_name || "철산점") : user?.branch_name,
      product_name: products[0]?.option_name || "",
      pass_type: products[0]?.option_value || "PERIOD",
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openEdit = (m: any) => {
    setIsEdit(true);
    setForm({
      member_id: m.member_id,
      branch_name: m.branch_name || "철산점",
      name: m.name || "", phone: m.phone || "",
      checkin_code: m.checkin_code || "",
      pass_type: m.pass_type || "PERIOD",
      product_name: m.product_name || "",
      remaining_count: m.remaining_count || 0,
      start_date: m.start_date?.slice(0, 10) || today,
      end_date: m.end_date?.slice(0, 10) || today,
      status: m.status || "ACTIVE", memo: m.memo || "",
      locker_no: m.locker_no || "", member_no: m.member_no || "",
      gender: m.gender || "", birth_date: m.birth_date?.slice(0, 10) || "",
      emergency_contact: m.emergency_contact || "",
      address: m.address || "", join_date: m.join_date?.slice(0, 10) || "",
      staff_name: m.staff_name || "",
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleProductChange = (productName: string) => {
    const product = products.find((p) => p.option_name === productName);
    const passType = product?.option_value || "PERIOD";
    setForm({
      ...form, product_name: productName, pass_type: passType,
      remaining_count: passType === "COUNT" ? (form.remaining_count || 12) : 0,
      end_date: passType === "PERIOD" ? addMonths(form.start_date, 1) : form.end_date,
    });
  };

  const saveMember = async () => {
    if (!form.name.trim()) { alert("이름을 입력해주세요."); return; }
    const res = await apiFetch(isEdit ? "/api/members/update" : "/api/members/add", {
      method: "POST",
      body: JSON.stringify({ ...form, branch_name: isAdminOrOwner ? form.branch_name : user?.branch_name }),
    });
    const json = await res.json();
    if (json.success) {
      alert(isEdit ? "수정 완료!" : "등록 완료!");
      setShowForm(false);
      setForm(makeDefaultForm());
      loadMembers(user, true);
    } else {
      alert(json.message || "저장 실패");
    }
  };

  const extendOneMonth = async (m: any) => {
    const nextEnd = m.pass_type === "PERIOD" ? addMonths(m.end_date?.slice(0, 10) || today, 1) : m.end_date?.slice(0, 10);
    const nextCount = m.pass_type === "COUNT" ? Number(m.remaining_count || 0) + 1 : m.remaining_count;
    const res = await apiFetch("/api/members/update", {
      method: "POST",
      body: JSON.stringify({ ...m, end_date: nextEnd, remaining_count: nextCount }),
    });
    const json = await res.json();
    if (json.success) { alert("연장 완료!"); loadMembers(user, true); }
    else alert(json.message || "연장 실패");
  };

  // 상태 필터 클라이언트 적용
  const filtered = members.filter((m) => {
    if (statusFilter === "전체") return true;
    const st = getStatus(m);
    if (statusFilter === "정상") return st.text === "정상";
    if (statusFilter === "만료임박") return st.text === "만료임박" || st.text === "잔여부족";
    if (statusFilter === "만료") return st.text === "만료" || st.text === "소진";
    if (statusFilter === "휴회") return st.text === "휴회";
    return true;
  });

  if (!user) return <div style={{ padding: 20, color: "#94a3b8" }}>로딩중...</div>;

  return (
    <div style={{ background: "#f1f5f9", minHeight: "100vh" }}>
      {/* 헤더 */}
      <div style={{
        background: "#fff", borderBottom: "1px solid #e2e8f0",
        padding: "12px 16px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 800, color: "#1e293b" }}>회원관리</div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 1 }}>
            {isAdminOrOwner ? "전체 지점" : user.branch_name}
          </div>
        </div>
        <button className="btn" onClick={openAdd} style={{ padding: "8px 16px", fontSize: 13 }}>
          + 등록
        </button>
      </div>

      {/* 검색/필터 */}
      <div style={{ padding: "12px 12px 0" }}>
        <div style={card}>
          {isAdminOrOwner && (
            <div style={{ padding: "10px 12px", borderBottom: "1px solid #f1f5f9" }}>
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                style={smallSelect}
              >
                <option>전체</option>
                {branches.map((b) => <option key={b.option_id}>{b.option_name}</option>)}
              </select>
            </div>
          )}
          <div style={{ padding: "10px 12px", borderBottom: "1px solid #f1f5f9", display: "flex", gap: 8 }}>
            <input
              className="input"
              placeholder="이름 / 전화번호 / 상품명"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") doSearch(); }}
              style={{ flex: 1, margin: 0 }}
            />
            <button onClick={doSearch} style={searchBtn}>검색</button>
            <button onClick={() => { setSearch(""); loadMembers(user); }} style={{ ...searchBtn, background: "#f1f5f9", color: "#64748b" }}>↺</button>
          </div>

          {/* 상태 필터 */}
          <div style={{ padding: "8px 12px", display: "flex", gap: 6, overflowX: "auto" }}>
            {STATUS_FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                style={{
                  padding: "4px 12px", borderRadius: 20, border: "none",
                  fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" as const,
                  background: statusFilter === f ? "#2563eb" : "#f1f5f9",
                  color: statusFilter === f ? "#fff" : "#64748b",
                }}
              >
                {f}
              </button>
            ))}
          </div>

          <div style={{ padding: "4px 14px 10px", fontSize: 12, color: "#94a3b8" }}>
            {statusFilter !== "전체" || search ? `검색결과 ${filtered.length}명` : `전체 ${totalCount}명`}
          </div>
        </div>
      </div>

      {/* 등록/수정 폼 */}
      {showForm && (
        <div style={{ padding: "10px 12px 0" }}>
          <div style={{ ...card, padding: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#1e293b", marginBottom: 12 }}>
              {isEdit ? "회원 수정" : "회원 등록"}
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {isAdminOrOwner ? (
                <select className="input" value={form.branch_name}
                  onChange={(e) => setForm({ ...form, branch_name: e.target.value })}>
                  {branches.map((b) => <option key={b.option_id}>{b.option_name}</option>)}
                </select>
              ) : (
                <div className="input" style={{ color: "#94a3b8" }}>{user.branch_name}</div>
              )}
              <input className="input" placeholder="이름" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <input className="input" placeholder="전화번호" type="tel" value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <input className="input" placeholder="출석번호 4자리" maxLength={4} value={form.checkin_code}
                onChange={(e) => setForm({ ...form, checkin_code: e.target.value.replace(/[^0-9]/g, "").slice(0, 4) })} />
              <select className="input" value={form.product_name}
                onChange={(e) => handleProductChange(e.target.value)}>
                {products.map((p) => <option key={p.option_id}>{p.option_name}</option>)}
              </select>
              <div className="input" style={{ color: "#94a3b8", fontSize: 13 }}>
                {form.pass_type === "COUNT" ? "횟수권" : "기간권"}
              </div>
              {form.pass_type === "COUNT" && (
                <input className="input" type="number" placeholder="남은 횟수" value={form.remaining_count}
                  onChange={(e) => setForm({ ...form, remaining_count: Number(e.target.value) })} />
              )}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <input className="input" type="date" value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
                <input className="input" type="date" value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <input className="input" placeholder="락카번호" value={form.locker_no}
                  onChange={(e) => setForm({ ...form, locker_no: e.target.value })} />
                <select className="input" value={form.gender}
                  onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                  <option value="">성별</option>
                  <option value="남">남</option>
                  <option value="여">여</option>
                </select>
              </div>
              <input className="input" placeholder="비상연락처" value={form.emergency_contact}
                onChange={(e) => setForm({ ...form, emergency_contact: e.target.value })} />
              <input className="input" placeholder="담당자" value={form.staff_name}
                onChange={(e) => setForm({ ...form, staff_name: e.target.value })} />
              <textarea className="input" placeholder="메모" value={form.memo}
                onChange={(e) => setForm({ ...form, memo: e.target.value })}
                style={{ minHeight: 70 }} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <button className="btn" onClick={saveMember}>{isEdit ? "수정 저장" : "저장"}</button>
                <button className="btn secondary" onClick={() => setShowForm(false)}>취소</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 회원 목록 */}
      <div style={{ padding: "10px 12px 0", display: "grid", gap: 8 }}>
        {filtered.length === 0 ? (
          <div style={{ ...card, padding: "20px 16px", textAlign: "center", color: "#94a3b8", fontSize: 14 }}>
            {search || statusFilter !== "전체" ? "검색 결과가 없습니다." : "등록된 회원이 없습니다."}
          </div>
        ) : (
          filtered.map((m) => {
            const st = getStatus(m);
            const isCount = m.pass_type === "COUNT";
            const endDay = !isCount && m.end_date ? daysLeft(m.end_date.slice(0, 10)) : null;

            return (
              <div
                key={m.member_id}
                style={card}
                onClick={() => { window.location.href = `/mobile-member-detail?member_id=${m.member_id}`; }}
              >
                {/* 상단: 이름 + 상태 + 전화번호 */}
                <div style={{ padding: "12px 14px 10px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: "#1e293b" }}>
                      {m.name}
                      {Number(m.payment_count || 0) >= 2 && (
                        <span style={{
                          marginLeft: 5, fontSize: 11, fontWeight: 700,
                          color: "#2563eb", verticalAlign: "middle",
                        }}>(재)</span>
                      )}
                    </div>
                    <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>{m.phone || "-"}</div>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: "3px 9px",
                    borderRadius: 20, background: st.bg, color: st.color,
                    whiteSpace: "nowrap" as const, flexShrink: 0,
                  }}>
                    {st.text}
                  </span>
                </div>

                {/* 핵심 지표 */}
                <div style={{
                  padding: "0 14px 10px",
                  display: "flex", gap: 14, flexWrap: "wrap" as const,
                }}>
                  {m.product_name && (
                    <div>
                      <div style={{ fontSize: 11, color: "#94a3b8" }}>상품</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>{m.product_name}</div>
                    </div>
                  )}
                  {isCount ? (
                    <div>
                      <div style={{ fontSize: 11, color: "#94a3b8" }}>잔여횟수</div>
                      <div style={{
                        fontSize: 13, fontWeight: 700,
                        color: Number(m.remaining_count || 0) <= 3 ? "#dc2626" : "#374151",
                      }}>
                        {m.remaining_count || 0}회
                      </div>
                    </div>
                  ) : (
                    <>
                      {m.end_date && (
                        <div>
                          <div style={{ fontSize: 11, color: "#94a3b8" }}>만료일</div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>{m.end_date.slice(0, 10)}</div>
                        </div>
                      )}
                      {endDay && (
                        <div>
                          <div style={{ fontSize: 11, color: "#94a3b8" }}>남은 기간</div>
                          <div style={{
                            fontSize: 13, fontWeight: 700,
                            color: endDay.includes("초과") || endDay === "오늘 만료" ? "#dc2626"
                              : endDay.startsWith("D-") && parseInt(endDay.slice(2)) <= 7 ? "#d97706"
                              : "#374151",
                          }}>
                            {endDay}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  {m.checkin_code && (
                    <div>
                      <div style={{ fontSize: 11, color: "#94a3b8" }}>출석번호</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>#{m.checkin_code}</div>
                    </div>
                  )}
                </div>

                {/* 버튼 (이벤트 버블링 막기) */}
                <div
                  style={{ padding: "0 14px 12px", display: "flex", gap: 8 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    className="btn"
                    onClick={() => { window.location.href = `/mobile-member-detail?member_id=${m.member_id}`; }}
                    style={{ flex: 1, fontSize: 13, padding: "8px 0" }}
                  >
                    상세
                  </button>
                  <button
                    className="btn secondary"
                    onClick={() => extendOneMonth(m)}
                    style={{ flex: 1, fontSize: 13, padding: "8px 0" }}
                  >
                    연장
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div style={{ height: 90 }} />

      {/* 하단 고정 메뉴 */}
      <nav style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: "#fff", borderTop: "1px solid #e2e8f0",
        display: "grid", gridTemplateColumns: "repeat(5, 1fr)",
        paddingBottom: "env(safe-area-inset-bottom, 6px)",
        zIndex: 999,
      }}>
        {[
          { label: "홈", href: "/mobile-branch" },
          { label: "회원", href: "/mobile-members", active: true },
          { label: "출석", href: "/mobile-attendance" },
          { label: "결제", href: "/mobile-payments" },
          { label: "상담", href: "/mobile-crm" },
        ].map((item) => (
          <Link key={item.label} href={item.href} style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", padding: "8px 0",
            fontSize: 11, fontWeight: 600, textDecoration: "none",
            color: item.active ? "#2563eb" : "#94a3b8",
          }}>
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

const card: React.CSSProperties = {
  background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden", cursor: "pointer",
};

const smallSelect: React.CSSProperties = {
  padding: "7px 10px", borderRadius: 8, border: "1px solid #e2e8f0",
  fontSize: 13, background: "#f8fafc", color: "#374151", width: "100%",
};

const searchBtn: React.CSSProperties = {
  padding: "8px 14px", borderRadius: 8, border: "none",
  background: "#2563eb", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
  whiteSpace: "nowrap",
};
