"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { apiFetch } from "@/lib/api";

function addMonths(dateString: string, months: number) {
  const date = new Date(dateString);
  date.setMonth(date.getMonth() + months);
  return date.toISOString().slice(0, 10);
}

const today = new Date().toISOString().slice(0, 10);
const pageSize = 15;

const memberGridColumns =
  "50px 90px 140px 90px 130px 190px 70px 70px 90px 90px 260px";

const miniBtnStyle = {
  padding: "5px 9px",
  fontSize: 12,
  height: 30,
  minWidth: 42,
  borderRadius: 10,
  whiteSpace: "nowrap" as const,
};

const makeDefaultForm = () => ({
  member_id: null as any,
  branch_name: "",
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
  locker_no: "",
  member_no: "",
  gender: "",
  birth_date: "",
  emergency_contact: "",
  address: "",
  join_date: today,
  staff_name: "",
  checkin_sms_enabled: 0,
  checkout_sms_enabled: 0,
});

export default function MembersPage() {
  const [members, setMembers] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [user, setUser] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [branch, setBranch] = useState("");
  const [autoEditId, setAutoEditId] = useState("");
  const [uploading, setUploading] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [form, setForm] = useState(makeDefaultForm());

  const [showHoldForm, setShowHoldForm] = useState(false);
  const [holdMember, setHoldMember] = useState<any>(null);

  const [showExtendForm, setShowExtendForm] = useState(false);
  const [extendMember, setExtendMember] = useState<any>(null);

  const [showSmsPreview, setShowSmsPreview] = useState(false);
  const [smsMessage, setSmsMessage] = useState("");

  const [extendForm, setExtendForm] = useState({
    months: 1,
    count: 1,
    customMonths: "",
    customCount: "",
  });

  const [holdForm, setHoldForm] = useState({
    hold_start: today,
    hold_end: today,
    reason: "",
  });

  const getUser = () => {
    if (typeof window === "undefined") return null;
    const savedUser = localStorage.getItem("user");
    return savedUser ? JSON.parse(savedUser) : null;
  };

  const isAdminOrOwner = user?.role === "ADMIN" || user?.role === "OWNER";

  const loadBranches = async () => {
    const res = await apiFetch("/api/settings?option_type=BRANCH");
    const data = await res.json();
    setBranches(data.rows || []);
  };

  const loadProducts = async () => {
    const res = await apiFetch("/api/settings?option_type=PASS_PRODUCT");
    const data = await res.json();
    const rows = data.rows || [];
    setProducts(rows);

    if (rows.length > 0) {
      setForm((prev) => ({
        ...prev,
        product_name: prev.product_name || rows[0].option_name,
        pass_type: rows[0].option_value || "PERIOD",
      }));
    }
  };

  const loadMembers = async (currentUser = user) => {
    let url = "/api/members";

    if (
      currentUser &&
      currentUser.role !== "ADMIN" &&
      currentUser.role !== "OWNER"
    ) {
      url += `?branch_name=${encodeURIComponent(currentUser.branch_name)}`;
    }

    if (search) {
      url += `${url.includes("?") ? "&" : "?"}search=${encodeURIComponent(
        search
      )}`;
    }

    const res = await apiFetch(url);
    const data = await res.json();

    setMembers(data.rows || []);
    setPage(1);
  };

  useEffect(() => {
    const savedUser = getUser();
    setUser(savedUser);

    const params = new URLSearchParams(window.location.search);
    setAutoEditId(params.get("member_id") || "");

    loadBranches();
    loadProducts();
    loadMembers(savedUser);
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    if (!autoEditId || members.length === 0) return;

    const target = members.find(
      (m: any) => String(m.member_id) === String(autoEditId)
    );

    if (!target) return;

    openEdit(target);
    setAutoEditId("");
    window.history.replaceState({}, "", "/members");
  }, [autoEditId, members]);

  const openAdd = () => {
    const firstProduct = products[0];
    const firstBranch = branches[0];

    setIsEdit(false);
    setForm({
      ...makeDefaultForm(),
      branch_name:
        user && user.role !== "ADMIN" && user.role !== "OWNER"
          ? user.branch_name
          : firstBranch?.option_name || "",
      product_name: firstProduct?.option_name || "",
      pass_type: firstProduct?.option_value || "PERIOD",
    });

    setShowForm(true);
    setShowHoldForm(false);
    setShowExtendForm(false);
    setShowSmsPreview(false);

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openEdit = (m: any) => {
    setIsEdit(true);
    setForm({
      member_id: m.member_id,
      branch_name: m.branch_name || "",
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
      locker_no: m.locker_no || "",
      member_no: m.member_no || "",
      gender: m.gender || "",
      birth_date: m.birth_date?.slice(0, 10) || "",
      emergency_contact: m.emergency_contact || "",
      address: m.address || "",
      join_date: m.join_date?.slice(0, 10) || "",
      staff_name: m.staff_name || "",
      checkin_sms_enabled: m.checkin_sms_enabled || 0,
      checkout_sms_enabled: m.checkout_sms_enabled || 0,
    });

    setShowForm(true);
    setShowHoldForm(false);
    setShowExtendForm(false);
    setShowSmsPreview(false);

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
    const targetForm = {
      ...form,
      branch_name: isAdminOrOwner ? form.branch_name : user?.branch_name,
    };

    if (!targetForm.branch_name) {
      alert("지점을 선택해주세요.");
      return;
    }

    const url = isEdit ? "/api/members/update" : "/api/members/add";

    const res = await apiFetch(url, {
      method: "POST",
      body: JSON.stringify(targetForm),
    });

    const data = await res.json();

    if (data.success) {
      alert(isEdit ? "회원 수정 완료!" : "회원 등록 완료!");
      setShowForm(false);
      setIsEdit(false);
      setForm(makeDefaultForm());
      loadMembers(user);
    } else {
      alert(data.message || "저장 실패");
    }
  };

  const openExtend = (m: any) => {
    setExtendMember(m);
    setExtendForm({
      months: 1,
      count: 1,
      customMonths: "",
      customCount: "",
    });

    setShowExtendForm(true);
    setShowForm(false);
    setShowHoldForm(false);
    setShowSmsPreview(false);

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveExtend = async () => {
    if (!extendMember) return;

    let nextEndDate = extendMember.end_date;
    let nextCount = Number(extendMember.remaining_count || 0);

    if (extendMember.pass_type === "PERIOD") {
      const addValue = extendForm.customMonths
        ? Number(extendForm.customMonths)
        : extendForm.months;

      nextEndDate = addMonths(extendMember.end_date, addValue);
    } else {
      const addValue = extendForm.customCount
        ? Number(extendForm.customCount)
        : extendForm.count;

      nextCount += addValue;
    }

    const res = await apiFetch("/api/members/update", {
      method: "POST",
      body: JSON.stringify({
        ...extendMember,
        end_date: nextEndDate,
        remaining_count: nextCount,
      }),
    });

    const data = await res.json();

    if (data.success) {
      const message = `${extendMember.name} 회원님
안녕하세요 스트롱복싱 ${extendMember.branch_name}입니다 🥊

회원권 연장이 완료되었습니다.

상품 : ${extendMember.product_name}

${
  extendMember.pass_type === "PERIOD"
    ? `만료일 : ${nextEndDate}`
    : `남은횟수 : ${nextCount}회`
}

감사합니다 😄`;

      setSmsMessage(message);
      setShowSmsPreview(true);
      setShowExtendForm(false);
      loadMembers(user);
    } else {
      alert(data.message || "연장 실패");
    }
  };

  const openHold = (m: any) => {
    setHoldMember(m);
    setHoldForm({
      hold_start: today,
      hold_end: today,
      reason: "",
    });

    setShowHoldForm(true);
    setShowForm(false);
    setShowExtendForm(false);
    setShowSmsPreview(false);

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveHold = async () => {
    if (!holdMember) return;

    const res = await apiFetch("/api/members/hold", {
      method: "POST",
      body: JSON.stringify({
        member_id: holdMember.member_id,
        hold_start: holdForm.hold_start,
        hold_end: holdForm.hold_end,
        reason: holdForm.reason,
      }),
    });

    const data = await res.json();

    if (data.success) {
      alert("휴회 처리 완료!");
      setShowHoldForm(false);
      setHoldMember(null);
      loadMembers(user);
    } else {
      alert(data.message || "휴회 처리 실패");
    }
  };

  const deleteMember = async (m: any) => {
    if (!confirm(`${m.name} 회원을 삭제 처리할까요?`)) return;

    const res = await apiFetch("/api/members/delete", {
      method: "POST",
      body: JSON.stringify({
        member_id: m.member_id,
      }),
    });

    const data = await res.json();

    if (data.success) {
      alert("회원 삭제 완료");
      loadMembers(user);
    } else {
      alert(data.message || "회원 삭제 실패");
    }
  };

  const uploadExcel = async (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);

    try {
      const formData = new FormData();

      formData.append("file", file);
      formData.append(
        "branch_name",
        branch || user?.branch_name || ""
      );

      const res = await fetch("/api/members/import", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (data.success) {
        alert(data.message);
        loadMembers(user);
      } else {
        alert(data.message);
      }
    } finally {
      setUploading(false);
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
    const matchBranch = !branch || m.branch_name === branch;

    const matchSearch =
      !search ||
      m.name?.includes(search) ||
      m.phone?.includes(search) ||
      m.product_name?.includes(search) ||
      m.memo?.includes(search);

    return matchBranch && matchSearch;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pagedMembers = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <AppShell title="회원관리">
      <div className="card" style={{ marginBottom: 18, borderRadius: 24 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 14,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: 34, fontWeight: 900 }}>
              회원관리
            </h1>

            <p style={{ color: "#888", marginTop: 8 }}>
              총 {filtered.length}명 / {page}페이지
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <select
              className="input"
              style={{ width: 140 }}
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
            >
              <option value="">전체 지점</option>
              <option value="철산점">철산점</option>
              <option value="목동점">목동점</option>
              <option value="신정점">신정점</option>
              <option value="개봉점">개봉점</option>
            </select>

            <input
              className="input"
              placeholder="회원 검색"
              style={{ width: 280 }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") loadMembers(user);
              }}
            />

            <button className="btn" onClick={openAdd}>
              회원등록
            </button>

            <label className="btn secondary" style={{ cursor: "pointer" }}>
              {uploading ? "업로드중..." : "엑셀업로드"}

              <input
                hidden
                type="file"
                accept=".xlsx,.xls"
                onChange={uploadExcel}
              />
            </label>

            <button className="btn secondary" onClick={() => loadMembers(user)}>
              새로고침
            </button>
          </div>
        </div>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 18, borderRadius: 24 }}>
          <h2 style={{ marginTop: 0 }}>{isEdit ? "회원 수정" : "회원 등록"}</h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: 14,
            }}
          >
            {isAdminOrOwner ? (
              <select className="input" value={form.branch_name} onChange={(e) => setForm({ ...form, branch_name: e.target.value })}>
                <option value="">지점 선택</option>
                {branches.map((b) => (
                  <option key={b.option_id} value={b.option_name}>{b.option_name}</option>
                ))}
              </select>
            ) : (
              <div className="input" style={{ color: "#aaa" }}>{user?.branch_name}</div>
            )}

            <input className="input" placeholder="회원명" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className="input" placeholder="전화번호" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <input className="input" placeholder="출석번호 4자리" maxLength={4} value={form.checkin_code} onChange={(e) => setForm({ ...form, checkin_code: e.target.value.replace(/[^0-9]/g, "").slice(0, 4) })} />

            <select className="input" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
              <option value="">성별</option>
              <option value="남">남</option>
              <option value="여">여</option>
            </select>

            <input className="input" type="date" value={form.birth_date} onChange={(e) => setForm({ ...form, birth_date: e.target.value })} />
            <input className="input" placeholder="비상연락처 / 보호자" value={form.emergency_contact} onChange={(e) => setForm({ ...form, emergency_contact: e.target.value })} />
            <input className="input" placeholder="락카번호" value={form.locker_no} onChange={(e) => setForm({ ...form, locker_no: e.target.value })} />

            <input className="input" placeholder="담당자" value={form.staff_name} onChange={(e) => setForm({ ...form, staff_name: e.target.value })} />

            <select className="input" value={form.product_name} onChange={(e) => handleProductChange(e.target.value)}>
              <option value="">회원권 선택</option>
              {products.map((p) => (
                <option key={p.option_id} value={p.option_name}>{p.option_name}</option>
              ))}
            </select>

            <input className="input" type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
            <input className="input" type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />

            {form.pass_type === "COUNT" ? (
              <input className="input" type="number" placeholder="남은횟수" value={form.remaining_count} onChange={(e) => setForm({ ...form, remaining_count: Number(e.target.value) })} />
            ) : (
              <div className="input" style={{ color: "#aaa" }}>기간권</div>
            )}

            <div
              style={{
                gridColumn: "2 / 5",
                display: "flex",
                alignItems: "center",
                gap: 22,
                background: "#111827",
                border: "1px solid #1f2937",
                borderRadius: 14,
                padding: "0 14px",
                minHeight: 48,
                color: "#ddd",
              }}
            >
              <label>
                <input
                  type="checkbox"
                  checked={Number(form.checkin_sms_enabled) === 1}
                  onChange={(e) => setForm({ ...form, checkin_sms_enabled: e.target.checked ? 1 : 0 })}
                />{" "}
                입장 문자 발송
              </label>

              <label>
                <input
                  type="checkbox"
                  checked={Number(form.checkout_sms_enabled) === 1}
                  onChange={(e) => setForm({ ...form, checkout_sms_enabled: e.target.checked ? 1 : 0 })}
                />{" "}
                운동 종료 문자 발송
              </label>
            </div>

            <textarea
              className="input"
              placeholder="메모"
              value={form.memo}
              onChange={(e) => setForm({ ...form, memo: e.target.value })}
              style={{ gridColumn: "1 / 5", minHeight: 82 }}
            />
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <button className="btn" onClick={saveMember}>
              {isEdit ? "수정 저장" : "회원 저장"}
            </button>

            <button className="btn secondary" onClick={() => setShowForm(false)}>
              취소
            </button>
          </div>
        </div>
      )}

      {showExtendForm && extendMember && (
        <div className="card" style={{ marginBottom: 18, borderRadius: 24 }}>
          <h2>회원권 연장</h2>
          <div style={{ color: "#aaa", marginBottom: 16 }}>
            {extendMember.name} / {extendMember.product_name}
          </div>

          {extendMember.pass_type === "PERIOD" ? (
            <>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
                {[1, 3, 6].map((m) => (
                  <button
                    key={m}
                    className={
                      extendForm.months === m && !extendForm.customMonths
                        ? "btn"
                        : "btn secondary"
                    }
                    onClick={() =>
                      setExtendForm({
                        ...extendForm,
                        months: m,
                        customMonths: "",
                      })
                    }
                  >
                    +{m}개월
                  </button>
                ))}
              </div>

              <input
                className="input"
                type="number"
                placeholder="직접 개월 입력"
                value={extendForm.customMonths}
                onChange={(e) =>
                  setExtendForm({
                    ...extendForm,
                    customMonths: e.target.value,
                  })
                }
              />
            </>
          ) : (
            <>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
                {[1, 12, 24].map((c) => (
                  <button
                    key={c}
                    className={
                      extendForm.count === c && !extendForm.customCount
                        ? "btn"
                        : "btn secondary"
                    }
                    onClick={() =>
                      setExtendForm({
                        ...extendForm,
                        count: c,
                        customCount: "",
                      })
                    }
                  >
                    +{c}회
                  </button>
                ))}
              </div>

              <input
                className="input"
                type="number"
                placeholder="직접 횟수 입력"
                value={extendForm.customCount}
                onChange={(e) =>
                  setExtendForm({
                    ...extendForm,
                    customCount: e.target.value,
                  })
                }
              />
            </>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button className="btn" onClick={saveExtend}>
              연장 저장
            </button>

            <button className="btn secondary" onClick={() => setShowExtendForm(false)}>
              취소
            </button>
          </div>
        </div>
      )}

      {showSmsPreview && (
        <div className="card" style={{ marginBottom: 18, borderRadius: 24 }}>
          <h2>문자 미리보기</h2>

          <textarea
            className="input"
            value={smsMessage}
            onChange={(e) => setSmsMessage(e.target.value)}
            style={{ minHeight: 220, width: "100%" }}
          />

          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button
              className="btn"
              onClick={async () => {
                const res = await apiFetch("/api/sms/send", {
                  method: "POST",
                  body: JSON.stringify({
                    branch_name: extendMember?.branch_name,
                    message: smsMessage,
                    is_test: true,
                    test_phone: extendMember?.phone,
                  }),
                });

                const data = await res.json();

                if (data.success) {
                  alert("문자 발송 완료 😎");
                } else {
                  alert(data.message || "문자 발송 실패");
                }

                setShowSmsPreview(false);
                setExtendMember(null);
              }}
            >
              문자 보내기
            </button>

            <button
              className="btn secondary"
              onClick={() => {
                setShowSmsPreview(false);
                setExtendMember(null);
              }}
            >
              취소
            </button>
          </div>
        </div>
      )}

      {showHoldForm && holdMember && (
        <div className="card" style={{ marginBottom: 18, borderRadius: 24 }}>
          <h2>휴회 처리</h2>

          <div style={{ color: "#aaa", marginBottom: 14 }}>
            {holdMember.name} / 현재 만료일 {holdMember.end_date?.slice(0, 10)}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <input
              className="input"
              type="date"
              value={holdForm.hold_start}
              onChange={(e) =>
                setHoldForm({ ...holdForm, hold_start: e.target.value })
              }
            />

            <input
              className="input"
              type="date"
              value={holdForm.hold_end}
              onChange={(e) =>
                setHoldForm({ ...holdForm, hold_end: e.target.value })
              }
            />

            <input
              className="input"
              placeholder="휴회 사유"
              value={holdForm.reason}
              onChange={(e) =>
                setHoldForm({ ...holdForm, reason: e.target.value })
              }
            />
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <button className="btn" onClick={saveHold}>
              휴회 처리
            </button>

            <button className="btn secondary" onClick={() => setShowHoldForm(false)}>
              취소
            </button>
          </div>
        </div>
      )}

      <div
        className="card"
        style={{
          borderRadius: 16,
          padding: 0,
          overflow: "hidden",
          marginBottom: 18,
        }}
      >
        <div
          style={{
            padding: "14px 16px 10px",
            fontSize: 18,
            fontWeight: 900,
            borderBottom: "1px solid #1f2937",
          }}
        >
          회원 목록
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: memberGridColumns,
            gap: 10,
            padding: "10px 14px",
            borderBottom: "1px solid #374151",
            color: "#9ca3af",
            fontSize: 12,
            fontWeight: 900,
            alignItems: "center",
            background: "rgba(255,255,255,0.03)",
          }}
        >
          <div>No</div>
          <div>회원번호</div>
          <div>회원명</div>
          <div>지점</div>
          <div>프로그램</div>
          <div>이용기간</div>
          <div>잔여</div>
          <div>락카</div>
          <div>출석번호</div>
          <div>상태</div>
          <div>관리</div>
        </div>

        {pagedMembers.map((m, index) => {
          const status = getStatus(m);

          return (
            <div
              key={m.member_id}
              style={{
                display: "grid",
                gridTemplateColumns: memberGridColumns,
                gap: 10,
                padding: "8px 14px",
                borderBottom: "1px solid #1f2937",
                alignItems: "center",
                cursor: "pointer",
                fontSize: 13,
              }}
              onClick={() => {
                location.href = `/member-detail?member_id=${m.member_id}`;
              }}
            >
              <div>{(page - 1) * pageSize + index + 1}</div>

              <div style={{ color: "#aaa" }}>
                {m.member_no || m.checkin_code || "-"}
              </div>

              <div style={{ fontWeight: 900 }}>{m.name}</div>

              <div style={{ color: "#60a5fa", fontWeight: 700 }}>
                {m.branch_name}
              </div>

              <div>{m.product_name || "-"}</div>

              <div>
                {m.start_date?.slice(0, 10) || "-"} ~{" "}
                {m.end_date?.slice(0, 10) || "-"}
              </div>

              <div>{m.pass_type === "COUNT" ? `${m.remaining_count || 0}` : "-"}</div>

              <div>{m.locker_no || "-"}</div>

              <div>{m.checkin_code || "-"}</div>

              <div>
                <span
                  style={{
                    background: `${status.color}22`,
                    color: status.color,
                    padding: "4px 8px",
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 900,
                  }}
                >
                  {status.text}
                </span>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 6,
                  justifyContent: "flex-start",
                  flexWrap: "nowrap",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  className="btn secondary"
                  onClick={() => openEdit(m)}
                  style={miniBtnStyle}
                >
                  수정
                </button>

                <button className="btn" onClick={() => openExtend(m)} style={miniBtnStyle}>
                  연장
                </button>

                <button
                  className="btn secondary"
                  onClick={() => openHold(m)}
                  style={miniBtnStyle}
                >
                  휴회
                </button>

                <button
                  className="btn secondary"
                  onClick={() => {
                    location.href = `/member-detail?member_id=${m.member_id}`;
                  }}
                  style={miniBtnStyle}
                >
                  상세
                </button>

                <button
                  className="btn secondary"
                  onClick={() => deleteMember(m)}
                  style={{ ...miniBtnStyle, color: "#ff4d6d" }}
                >
                  삭제
                </button>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div style={{ padding: 24, textAlign: "center", color: "#888" }}>
            회원이 없습니다.
          </div>
        )}
      </div>

      {filtered.length > pageSize && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 8,
            marginTop: 20,
            flexWrap: "wrap",
          }}
        >
          <button
            className="btn secondary"
            disabled={page === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            이전
          </button>

          {(() => {
            const groupSize = 10;
            const currentGroup = Math.floor((page - 1) / groupSize);
            const startPage = currentGroup * groupSize + 1;
            const endPage = Math.min(startPage + groupSize - 1, totalPages);

            return (
              <>
                <button
                  className="btn secondary"
                  disabled={startPage === 1}
                  onClick={() => setPage(Math.max(1, startPage - groupSize))}
                >
                  ◀◀
                </button>

                {Array.from({ length: endPage - startPage + 1 }).map((_, i) => {
                  const pageNum = startPage + i;

                  return (
                    <button
                      key={pageNum}
                      className={page === pageNum ? "btn" : "btn secondary"}
                      onClick={() => setPage(pageNum)}
                    >
                      {pageNum}
                    </button>
                  );
                })}

                <button
                  className="btn secondary"
                  disabled={endPage === totalPages}
                  onClick={() => setPage(Math.min(totalPages, startPage + groupSize))}
                >
                  ▶▶
                </button>
              </>
            );
          })()}

          <button
            className="btn secondary"
            disabled={page === totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            다음
          </button>
        </div>
      )}
    </AppShell>
  );
}