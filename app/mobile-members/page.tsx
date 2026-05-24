"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

const formatDate = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
  name: "",
  phone: "",
  checkin_code: "",
  pass_type: "PERIOD",
  product_name: "",
  remaining_count: 0,
  start_date: today,
  end_date: addMonths(today, 1),
  status: "ACTIVE",
  memo: "",
});

export default function MobileMembersPage() {
  const [user, setUser] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState("전체");

  const [showForm, setShowForm] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [form, setForm] = useState(makeDefaultForm());

  const getUser = () => {
    try {
      const saved = localStorage.getItem("user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  };

  const isAdminOrOwner =
    user?.role === "ADMIN" || user?.role === "OWNER";

  const loadBranches = async () => {
    const res = await apiFetch("/api/settings?option_type=BRANCH");
    const json = await res.json();
    setBranches(json.rows || []);
  };

  const loadProducts = async () => {
    const res = await apiFetch("/api/settings?option_type=PASS_PRODUCT");
    const json = await res.json();
    const rows = json.rows || [];
    setProducts(rows);
  };

  const loadMembers = async (targetUser = user) => {
    let url = "/api/members";

    const params: string[] = [];

    if (
      targetUser &&
      targetUser.role !== "ADMIN" &&
      targetUser.role !== "OWNER"
    ) {
      params.push(`branch_name=${encodeURIComponent(targetUser.branch_name)}`);
    }

    if (
      targetUser &&
      (targetUser.role === "ADMIN" || targetUser.role === "OWNER") &&
      branchFilter !== "전체"
    ) {
      params.push(`branch_name=${encodeURIComponent(branchFilter)}`);
    }

    if (search.trim()) {
      params.push(`search=${encodeURIComponent(search.trim())}`);
    }

    if (params.length > 0) {
      url += `?${params.join("&")}`;
    }

    const res = await apiFetch(url);
    const json = await res.json();
    setMembers(json.rows || []);
  };

  useEffect(() => {
    const savedUser = getUser();

    if (!savedUser) {
      window.location.replace("/login");
      return;
    }

    setUser(savedUser);
    loadBranches();
    loadProducts();
    loadMembers(savedUser);
  }, []);

  useEffect(() => {
    if (user) loadMembers(user);
  }, [branchFilter]);

  const openAdd = () => {
    const firstProduct = products[0];

    setIsEdit(false);
    setForm({
      ...makeDefaultForm(),
      branch_name: isAdminOrOwner
        ? branches[0]?.option_name || "철산점"
        : user?.branch_name,
      product_name: firstProduct?.option_name || "",
      pass_type: firstProduct?.option_value || "PERIOD",
    });

    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openEdit = (m: any) => {
    setIsEdit(true);

    setForm({
      member_id: m.member_id,
      branch_name: m.branch_name || "철산점",
      name: m.name || "",
      phone: m.phone || "",
      checkin_code: m.checkin_code || "",
      pass_type: m.pass_type || "PERIOD",
      product_name: m.product_name || "",
      remaining_count: m.remaining_count || 0,
      start_date: m.start_date?.slice(0, 10) || today,
      end_date: m.end_date?.slice(0, 10) || today,
      status: m.status || "ACTIVE",
      memo: m.memo || "",
    });

    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleProductChange = (productName: string) => {
    const product = products.find((p) => p.option_name === productName);
    const passType = product?.option_value || "PERIOD";

    setForm({
      ...form,
      product_name: productName,
      pass_type: passType,
      remaining_count: passType === "COUNT" ? form.remaining_count || 12 : 0,
      end_date:
        passType === "PERIOD" ? addMonths(form.start_date, 1) : form.end_date,
    });
  };

  const saveMember = async () => {
    if (!form.name.trim()) {
      alert("회원 이름을 입력해주세요.");
      return;
    }

    const url = isEdit ? "/api/members/update" : "/api/members/add";

    const payload = {
      ...form,
      branch_name: isAdminOrOwner ? form.branch_name : user?.branch_name,
    };

    const res = await apiFetch(url, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const json = await res.json();

    if (json.success) {
      alert(isEdit ? "회원 수정 완료!" : "회원 등록 완료!");
      setShowForm(false);
      setForm(makeDefaultForm());
      loadMembers(user);
    } else {
      alert(json.message || "저장 실패");
    }
  };

  const extendOneMonth = async (m: any) => {
    const nextEndDate =
      m.pass_type === "PERIOD"
        ? addMonths(m.end_date?.slice(0, 10) || today, 1)
        : m.end_date?.slice(0, 10);

    const nextCount =
      m.pass_type === "COUNT" ? Number(m.remaining_count || 0) + 1 : m.remaining_count;

    const res = await apiFetch("/api/members/update", {
      method: "POST",
      body: JSON.stringify({
        ...m,
        end_date: nextEndDate,
        remaining_count: nextCount,
      }),
    });

    const json = await res.json();

    if (json.success) {
      alert("연장 완료!");
      loadMembers(user);
    } else {
      alert(json.message || "연장 실패");
    }
  };

  const getStatus = (m: any) => {
    if (m.status === "REST") return { text: "휴회", color: "#f59e0b" };
    if (m.status === "EXPIRED") return { text: "만료", color: "#ef4444" };

    const end = new Date(m.end_date?.slice(0, 10));
    const now = new Date();
    const diff = (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

    if (diff <= 7) return { text: "만료임박", color: "#ff4d6d" };

    return { text: "정상", color: "#22c55e" };
  };

  const filtered = members.filter((m) => {
    if (!search.trim()) return true;

    return (
      m.name?.includes(search) ||
      m.phone?.includes(search) ||
      m.product_name?.includes(search) ||
      m.memo?.includes(search)
    );
  });

  if (!user) {
    return (
      <div style={{ padding: 20, color: "white", background: "#08090d" }}>
        로딩중...
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#08090d",
        color: "white",
        padding: "18px 18px 90px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 18,
        }}
      >
        <div>
          <div style={{ fontSize: 28, fontWeight: 900 }}>
            STRONG <span style={{ color: "#2ee59d" }}>MEMBERS</span>
          </div>
          <div style={{ color: "#888", marginTop: 4 }}>
            {isAdminOrOwner ? "전체 지점 회원관리" : user.branch_name}
          </div>
        </div>

        <button className="btn" onClick={openAdd}>
          + 등록
        </button>
      </div>

      <div
        className="card"
        style={{
          borderRadius: 24,
          marginBottom: 16,
          display: "grid",
          gap: 10,
        }}
      >
        {isAdminOrOwner && (
          <select
            className="input"
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
          >
            <option>전체</option>
            {branches.map((b) => (
              <option key={b.option_id}>{b.option_name}</option>
            ))}
          </select>
        )}

        <input
          className="input"
          placeholder="이름 / 전화번호 / 상품명 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") loadMembers(user);
          }}
        />

        <button className="btn secondary" onClick={() => loadMembers(user)}>
          검색 / 새로고침
        </button>

        <div style={{ color: "#aaa", fontSize: 13 }}>
          총 {filtered.length}명
        </div>
      </div>

      {showForm && (
        <div
          className="card"
          style={{
            borderRadius: 24,
            marginBottom: 16,
            display: "grid",
            gap: 10,
          }}
        >
          <h2 style={{ marginTop: 0 }}>
            {isEdit ? "회원 수정" : "회원 등록"}
          </h2>

          {isAdminOrOwner ? (
            <select
              className="input"
              value={form.branch_name}
              onChange={(e) =>
                setForm({ ...form, branch_name: e.target.value })
              }
            >
              {branches.map((b) => (
                <option key={b.option_id}>{b.option_name}</option>
              ))}
            </select>
          ) : (
            <div className="input" style={{ color: "#aaa" }}>
              {user.branch_name}
            </div>
          )}

          <input
            className="input"
            placeholder="이름"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />

          <input
            className="input"
            placeholder="전화번호"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />

          <input
            className="input"
            placeholder="출석번호 4자리"
            maxLength={4}
            value={form.checkin_code}
            onChange={(e) =>
              setForm({
                ...form,
                checkin_code: e.target.value.replace(/[^0-9]/g, "").slice(0, 4),
              })
            }
          />

          <select
            className="input"
            value={form.product_name}
            onChange={(e) => handleProductChange(e.target.value)}
          >
            {products.map((p) => (
              <option key={p.option_id}>{p.option_name}</option>
            ))}
          </select>

          <div className="input" style={{ color: "#aaa" }}>
            {form.pass_type === "COUNT" ? "횟수권" : "기간권"}
          </div>

          {form.pass_type === "COUNT" && (
            <input
              className="input"
              type="number"
              placeholder="남은 횟수"
              value={form.remaining_count}
              onChange={(e) =>
                setForm({ ...form, remaining_count: Number(e.target.value) })
              }
            />
          )}

          <input
            className="input"
            type="date"
            value={form.start_date}
            onChange={(e) => setForm({ ...form, start_date: e.target.value })}
          />

          <input
            className="input"
            type="date"
            value={form.end_date}
            onChange={(e) => setForm({ ...form, end_date: e.target.value })}
          />

          <textarea
            className="input"
            placeholder="메모"
            value={form.memo}
            onChange={(e) => setForm({ ...form, memo: e.target.value })}
            style={{ minHeight: 90 }}
          />

          <button className="btn" onClick={saveMember}>
            {isEdit ? "수정 저장" : "회원 저장"}
          </button>

          <button className="btn secondary" onClick={() => setShowForm(false)}>
            취소
          </button>
        </div>
      )}

      <div style={{ display: "grid", gap: 12 }}>
        {filtered.map((m) => {
          const status = getStatus(m);

          return (
            <div
              key={m.member_id}
              className="card"
              style={{
                borderRadius: 22,
                padding: 16,
              }}
            >
              <div
                onClick={() => {
                  window.location.href = `/mobile-member-detail?member_id=${m.member_id}`;
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 23, fontWeight: 900 }}>
                      {m.name}
                    </div>
                    <div style={{ color: "#888", marginTop: 5 }}>
                      {m.phone || "-"}
                    </div>
                  </div>

                  <div
                    style={{
                      background: `${status.color}22`,
                      color: status.color,
                      padding: "7px 12px",
                      borderRadius: 999,
                      fontSize: 13,
                      fontWeight: 900,
                      height: "fit-content",
                    }}
                  >
                    {status.text}
                  </div>
                </div>

                <div
                  style={{
                    marginTop: 14,
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 10,
                    color: "#ddd",
                  }}
                >
                  <div>
                    <div style={{ color: "#777", fontSize: 12 }}>지점</div>
                    <b>{m.branch_name}</b>
                  </div>

                  <div>
                    <div style={{ color: "#777", fontSize: 12 }}>출석번호</div>
                    <b>#{m.checkin_code || "-"}</b>
                  </div>

                  <div>
                    <div style={{ color: "#777", fontSize: 12 }}>상품</div>
                    <b>{m.product_name || "-"}</b>
                  </div>

                  <div>
                    <div style={{ color: "#777", fontSize: 12 }}>만료/횟수</div>
                    <b>
                      {m.pass_type === "COUNT"
                        ? `${m.remaining_count || 0}회`
                        : m.end_date?.slice(0, 10)}
                    </b>
                  </div>
                </div>

                {m.memo && (
                  <div
                    style={{
                      marginTop: 12,
                      color: "#888",
                      fontSize: 13,
                      borderTop: "1px solid #1f2937",
                      paddingTop: 10,
                    }}
                  >
                    {m.memo}
                  </div>
                )}
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 8,
                  marginTop: 14,
                }}
              >
                <button className="btn secondary" onClick={() => openEdit(m)}>
                  수정
                </button>

                <button className="btn" onClick={() => extendOneMonth(m)}>
                  +연장
                </button>

                <button
                  className="btn secondary"
                  onClick={() => {
                    window.location.href = `/mobile-member-detail?member_id=${m.member_id}`;
                  }}
                >
                  상세
                </button>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div
            className="card"
            style={{
              borderRadius: 24,
              textAlign: "center",
              color: "#888",
            }}
          >
            회원이 없습니다.
          </div>
        )}
      </div>

      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "#0f172a",
          borderTop: "1px solid #1f2937",
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          padding: "10px 0",
          zIndex: 999,
        }}
      >
        <Link href="/mobile-branch" style={tabStyle}>
          홈
        </Link>
        <Link href="/mobile-members" style={{ ...tabStyle, color: "#2ee59d", fontWeight: 900 }}>
          회원
        </Link>
        <Link href="/attendance-live" style={tabStyle}>
          출석
        </Link>
        <Link href="/payments" style={tabStyle}>
          결제
        </Link>
        <Link href="/crm" style={tabStyle}>
          상담
        </Link>
      </div>
    </div>
  );
}

const tabStyle = {
  textAlign: "center" as const,
  color: "white",
  textDecoration: "none",
  fontSize: 12,
};