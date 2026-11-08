"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { apiFetch } from "@/lib/api";

function addMonths(dateString: string, months: number) {
  // 시작일 포함 30일 × 개월수 (이지스포 동일: 11/2 등록 → 12/1 만료)
  const date = new Date(dateString);
  date.setDate(date.getDate() + months * 30 - 1);
  return date.toISOString().slice(0, 10);
}

const today = new Date().toISOString().slice(0, 10);
const pageSize = 13;

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
  has_uniform: 0,
  has_locker: 0,
});

export default function MembersPage() {
  const [members, setMembers] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [user, setUser] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [branch, setBranch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "EXPIRED">("ALL");
  const [autoEditId, setAutoEditId] = useState("");
  const [returnToDetail, setReturnToDetail] = useState(false);
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

  const [showBulkExtend, setShowBulkExtend] = useState(false);
  const [bulkExtendDays, setBulkExtendDays] = useState("1");
  const [bulkExtendBranch, setBulkExtendBranch] = useState("");

  const [extendForm, setExtendForm] = useState({
    months: 1,
    count: 1,
    customMonths: "",
    customCount: "",
  });

  const [reregForm, setReregForm] = useState({
    product_name: "",
    payment_date: today,
    start_date: today,
    payment_method: "CARD",
    amount: "",
    discount_amount: "0",
    final_amount: "",
    memo: "",
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
  // DIRECTOR는 자기 지점만 보므로 지점 컬럼 숨김
  const showBranchCol = isAdminOrOwner;
  const memberGridColumns = showBranchCol
    ? "36px 80px 60px 110px 155px 55px 50px 60px 55px 75px 125px"
    : "36px 100px 120px 155px 60px 55px 70px 60px 82px 125px";

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
    setReturnToDetail(params.get("return") === "detail");

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

  const openEdit = async (m: any) => {
    setIsEdit(true);

    // 최근 결제 불러오기
    let latestPayment: any = null;
    try {
      const pRes = await apiFetch(`/api/payments/latest?member_id=${m.member_id}`);
      const pData = await pRes.json();
      if (pData.success && pData.payment) latestPayment = pData.payment;
    } catch {}

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
      has_uniform: m.has_uniform || 0,
      has_locker: m.has_locker || 0,
      // 최근 결제 채우기
      payment_amount: latestPayment ? String(latestPayment.final_amount) : "",
      payment_method_new: latestPayment?.payment_method || "CARD",
      payment_date_new: latestPayment?.payment_date?.slice(0, 10) || today,
      latest_payment_id: latestPayment?.payment_id || null,
    } as any);

    setReregForm({
      product_name: m.product_name || "",
      payment_date: today,
      payment_method: "CARD",
      amount: "",
      discount_amount: "0",
      final_amount: "",
      memo: "",
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
    const monthMatch = productName.match(/(\d+)\s*개월/);
    const months = monthMatch ? parseInt(monthMatch[1]) : 1;
    const countValue = Number(product?.count_value || 0);
    // "주N회" 패턴: 주간 횟수 × 개월 × 4주로 총 횟수 계산
    const weeklyMatch = productName.match(/주\s*(\d+)\s*회/);
    const countMatch = productName.match(/(\d+)\s*회/);
    const countFromName = weeklyMatch
      ? parseInt(weeklyMatch[1]) * months * 4
      : countMatch ? parseInt(countMatch[1]) : 0;
    const finalCount = countValue || countFromName;
    const countMonths = passType === "COUNT" ? (monthMatch ? months : Math.ceil(finalCount / 12) || 1) : 0;

    setForm({
      ...form,
      product_name: productName,
      pass_type: passType,
      remaining_count: passType === "COUNT" ? finalCount || form.remaining_count || 12 : 0,
      end_date:
        passType === "PERIOD"
          ? addMonths(form.start_date, months)
          : addMonths(form.start_date, countMonths),
    });
  };

  const saveMember = async () => {
    const targetForm = {
      ...form,
      branch_name: isAdminOrOwner ? form.branch_name : user?.branch_name,
    };

    // end_date가 오늘 이후인데 EXPIRED면 자동으로 ACTIVE로 보정
    if (targetForm.status === "EXPIRED" && targetForm.end_date && targetForm.end_date >= today) {
      targetForm.status = "ACTIVE";
    }

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
      const newMemberId = data.member_id;
      // 결제금액 처리
      const payAmt = Number((targetForm as any).payment_amount || 0);
      const payMemberId = isEdit ? targetForm.member_id : newMemberId;
      const latestPaymentId = (targetForm as any).latest_payment_id;
      if (payMemberId && payAmt > 0) {
        if (isEdit && latestPaymentId) {
          // 기존 결제 수정
          await apiFetch(`/api/payments/${latestPaymentId}`, {
            method: "PATCH",
            body: JSON.stringify({
              payment_date: (targetForm as any).payment_date_new || today,
              payment_method: (targetForm as any).payment_method_new || "CARD",
              amount: payAmt,
              final_amount: payAmt,
            }),
          });
        } else {
          // 신규 결제 등록
          await apiFetch("/api/payments/add", {
            method: "POST",
            body: JSON.stringify({
              member_id: payMemberId,
              branch_name: targetForm.branch_name,
              payment_date: (targetForm as any).payment_date_new || today,
              start_date: targetForm.start_date,
              payment_method: (targetForm as any).payment_method_new || "CARD",
              product_name: targetForm.product_name,
              amount: payAmt,
              final_amount: payAmt,
              memo: "",
              payment_purpose: "PASS",
            }),
          });
        }
      }
      alert(isEdit ? "회원 수정 완료!" : "회원 등록 완료!");
      setShowForm(false);
      setIsEdit(false);
      setForm(makeDefaultForm());
      if (returnToDetail && isEdit && form.member_id) {
        location.href = `/member-detail?member_id=${form.member_id}`;
        return;
      }
      loadMembers(user);
    } else {
      alert(data.message || "저장 실패");
    }
  };

  const openExtend = (m: any) => {
    setExtendMember(m);
    const autoStart = m.end_date && m.end_date.slice(0, 10) > today ? m.end_date.slice(0, 10) : today;
    setReregForm({
      product_name: m.product_name || "",
      payment_date: today,
      start_date: autoStart,
      payment_method: "CARD",
      amount: "",
      discount_amount: "0",
      final_amount: "",
      memo: "",
    });

    setShowExtendForm(true);
    setShowForm(false);
    setShowHoldForm(false);
    setShowSmsPreview(false);

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveRereg = async () => {
    if (!extendMember) return;
    if (!reregForm.product_name) { alert("상품을 선택해주세요"); return; }
    if (!reregForm.final_amount) { alert("결제금액을 입력해주세요"); return; }

    const startDate = (reregForm as any).start_date || reregForm.payment_date;
    const res = await apiFetch("/api/payments/add", {
      method: "POST",
      body: JSON.stringify({
        member_id: extendMember.member_id,
        branch_name: extendMember.branch_name,
        payment_date: reregForm.payment_date,
        start_date: startDate,
        payment_method: reregForm.payment_method,
        product_name: reregForm.product_name,
        amount: Number(reregForm.amount) || Number(reregForm.final_amount),
        discount_amount: Number(reregForm.discount_amount) || 0,
        final_amount: Number(reregForm.final_amount),
        memo: reregForm.memo,
        payment_purpose: "PASS",
      }),
    });

    const data = await res.json();

    if (data.success) {
      alert("재등록 완료!");
      setShowExtendForm(false);
      setExtendMember(null);
      loadMembers(user);
    } else {
      alert(data.message || "재등록 실패");
    }
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
        status: "ACTIVE",
      }),
    });

    const data = await res.json();

    if (data.success) {
      const extendedMonths = extendMember.pass_type === "PERIOD"
        ? (extendForm.customMonths ? Number(extendForm.customMonths) : extendForm.months)
        : null;
      const extendedCount = extendMember.pass_type !== "PERIOD"
        ? (extendForm.customCount ? Number(extendForm.customCount) : extendForm.count)
        : null;
      const extendLabel = extendMember.pass_type === "PERIOD"
        ? `${extendedMonths}개월 연장`
        : `${extendedCount}회 연장`;
      const message = `${extendMember.name} 회원님
안녕하세요 스트롱복싱 ${extendMember.branch_name}입니다 🥊

회원권 연장이 완료되었습니다.

상품 : ${extendMember.product_name} (${extendLabel})

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

  const getRemainingDisplay = (m: any) => {
    if (m.status === "REST") return { text: "휴회중", color: "#f59e0b" };
    if (m.pass_type === "COUNT") {
      const count = Number(m.remaining_count ?? 0);
      return count > 0
        ? { text: `${count}회`, color: "#60a5fa" }
        : { text: "0회", color: "#ef4444" };
    }
    if (!m.end_date) return { text: "-", color: "#666" };
    const endStr = m.end_date.slice(0, 10);
    const diff = Math.ceil(
      (new Date(endStr).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diff < 0) return { text: "만료", color: "#ef4444" };
    if (diff === 0) return { text: "오늘", color: "#ff4d6d" };
    return {
      text: `${diff}일`,
      color: diff <= 7 ? "#ff4d6d" : diff <= 30 ? "#f59e0b" : "#22c55e",
    };
  };

  const getStatus = (m: any) => {
    if (m.status === "REST") return { text: "휴회", color: "#f59e0b" };

    const todayStr = new Date().toISOString().slice(0, 10);
    const endStr = m.end_date?.slice(0, 10);

    if (m.status === "EXPIRED" && !(endStr && endStr >= todayStr)) return { text: "만료", color: "#ef4444" };
    if (!endStr || endStr < todayStr) return { text: "만료", color: "#ef4444" };

    const diff = (new Date(endStr).getTime() - new Date(todayStr).getTime()) / (1000 * 60 * 60 * 24);
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

    const todayDate = new Date().toISOString().slice(0, 10);
    const isExpired = (m.status === "EXPIRED" && !(m.end_date && m.end_date.slice(0, 10) >= todayDate)) ||
      (m.pass_type !== "COUNT" && m.end_date && m.end_date.slice(0, 10) < todayDate) ||
      (m.pass_type === "COUNT" && Number(m.remaining_count) <= 0);
    const matchStatus =
      statusFilter === "ALL" ||
      (statusFilter === "ACTIVE" && !isExpired && m.status !== "REST") ||
      (statusFilter === "EXPIRED" && isExpired);

    return matchBranch && matchSearch && matchStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pagedMembers = filtered.slice((page - 1) * pageSize, page * pageSize);

  const activeCount = members.filter((m) => {
    const td = new Date().toISOString().slice(0, 10);
    const exp =
      (m.status === "EXPIRED" && !(m.end_date && m.end_date.slice(0, 10) >= td)) ||
      (m.pass_type !== "COUNT" && m.end_date && m.end_date.slice(0, 10) < td) ||
      (m.pass_type === "COUNT" && Number(m.remaining_count) <= 0);
    return !exp && m.status !== "REST";
  }).length;
  const expiredCount = members.filter((m) => {
    const td = new Date().toISOString().slice(0, 10);
    return (
      (m.status === "EXPIRED" && !(m.end_date && m.end_date.slice(0, 10) >= td)) ||
      (m.pass_type !== "COUNT" && m.end_date && m.end_date.slice(0, 10) < td) ||
      (m.pass_type === "COUNT" && Number(m.remaining_count) <= 0)
    );
  }).length;

  return (
    <AppShell title="회원관리">
      {/* 컴팩트 툴바 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
          marginBottom: 8,
          padding: "6px 0",
        }}
      >
        {/* 필터 탭 */}
        <div style={{ display: "flex", gap: 4 }}>
          {([
            ["ALL", `전체 ${members.length}`],
            ["ACTIVE", `유효 ${activeCount}`],
            ["EXPIRED", `만료 ${expiredCount}`],
          ] as const).map(([val, label]) => (
            <button
              key={val}
              className={statusFilter === val ? "btn" : "btn secondary"}
              style={{ fontSize: 12, padding: "4px 12px", height: 32 }}
              onClick={() => { setStatusFilter(val); setPage(1); }}
            >
              {label}
            </button>
          ))}
        </div>

        <div style={{ width: 1, height: 24, background: "#374151", margin: "0 4px" }} />

        {/* 지점 필터 (admin/owner) */}
        {isAdminOrOwner && (
          <select
            className="input"
            style={{ width: 110, height: 32, padding: "0 8px", fontSize: 13 }}
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
          >
            <option value="">전체 지점</option>
            <option value="철산점">철산점</option>
            <option value="목동점">목동점</option>
            <option value="신정점">신정점</option>
            <option value="개봉점">개봉점</option>
          </select>
        )}

        {/* 검색 */}
        <input
          className="input"
          placeholder="이름 · 전화 · 회원권 검색"
          style={{ width: 220, height: 32, padding: "0 10px", fontSize: 13 }}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          onKeyDown={(e) => { if (e.key === "Enter") loadMembers(user); }}
        />

        <span style={{ fontSize: 12, color: "#9ca3af", marginLeft: 2 }}>
          {filtered.length}명
        </span>

        {/* 오른쪽 버튼 그룹 */}
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <button
            className="btn"
            style={{ background: "#f97316", color: "#fff", height: 32, fontSize: 13, padding: "0 14px" }}
            onClick={() => {
              setBulkExtendBranch(isAdminOrOwner ? "" : (user?.branch_name || ""));
              setBulkExtendDays("1");
              setShowBulkExtend(true);
            }}
          >
            일괄 연장
          </button>
          <button className="btn" style={{ height: 32, fontSize: 13, padding: "0 14px" }} onClick={openAdd}>
            회원등록
          </button>
          <label className="btn secondary" style={{ cursor: "pointer", height: 32, fontSize: 13, padding: "0 14px", display: "flex", alignItems: "center" }}>
            {uploading ? "업로드중..." : "엑셀업로드"}
            <input hidden type="file" accept=".xlsx,.xls" onChange={uploadExcel} />
          </label>
          <button className="btn secondary" style={{ height: 32, fontSize: 13, padding: "0 12px" }} onClick={() => loadMembers(user)}>
            새로고침
          </button>
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
              alignItems: "start",
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
<input className="input" placeholder="락카번호" value={form.locker_no} onChange={(e) => setForm({ ...form, locker_no: e.target.value })} />

            <input className="input" placeholder="담당자" value={form.staff_name} onChange={(e) => setForm({ ...form, staff_name: e.target.value })} />

            <select className="input" value={form.product_name} onChange={(e) => handleProductChange(e.target.value)}>
              <option value="">회원권 선택</option>
              {products.map((p) => (
                <option key={p.option_id} value={p.option_name}>{p.option_name}</option>
              ))}
            </select>

            {/* 시작일 / 만료일 / 잔여횟수 — 라벨 포함, 3열 나란히 */}
            <div style={{ gridColumn: "2 / 5", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
              <div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>시작일</div>
                <input className="input" type="date" value={form.start_date} onChange={(e) => {
                  const newStart = e.target.value;
                  const monthMatch = form.product_name?.match(/(\d+)\s*개월/);
                  const months = monthMatch ? parseInt(monthMatch[1]) : 1;
                  setForm({ ...form, start_date: newStart, end_date: form.pass_type === "PERIOD" ? addMonths(newStart, months) : form.end_date });
                }} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>만료일</div>
                <input className="input" type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>잔여횟수</div>
                <input className="input" type="number" placeholder="잔여횟수" value={form.remaining_count} onChange={(e) => setForm({ ...form, remaining_count: Number(e.target.value) })} />
              </div>
            </div>

            <div
              style={{
                gridColumn: "2 / 5",
                display: "flex",
                alignItems: "center",
                gap: 22,
                background: "var(--panel2)",
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

              <label>
                <input
                  type="checkbox"
                  checked={Number(form.has_uniform) === 1}
                  onChange={(e) => setForm({ ...form, has_uniform: e.target.checked ? 1 : 0 })}
                />{" "}
                운동복 대여
              </label>

              <label>
                <input
                  type="checkbox"
                  checked={Number(form.has_locker) === 1}
                  onChange={(e) => setForm({ ...form, has_locker: e.target.checked ? 1 : 0 })}
                />{" "}
                락카 사용
              </label>
            </div>

            <textarea
              className="input"
              placeholder="메모"
              value={form.memo}
              onChange={(e) => setForm({ ...form, memo: e.target.value })}
              style={{ gridColumn: "1 / 5", minHeight: 82 }}
            />

            <>
              <div style={{ gridColumn: "1 / 5", fontSize: 13, fontWeight: 700, color: "var(--accent)", marginTop: 4 }}>💳 결제 정보 (선택)</div>
              {/* 결제금액 + 수단 + 결제일 한 줄 */}
              <div style={{ gridColumn: "1 / 5", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <input
                  className="input"
                  type="number"
                  placeholder="결제금액 (원)"
                  style={{ flex: "1 1 140px", maxWidth: 200 }}
                  value={(form as any).payment_amount || ""}
                  onChange={(e) => setForm({ ...form, payment_amount: e.target.value } as any)}
                />
                <div style={{ display: "flex", gap: 6, flex: "0 0 auto" }}>
                  {[["CARD", "카드"], ["CASH", "현금"], ["TRANSFER", "계좌이체"]].map(([v, l]) => (
                    <button key={v} className={(form as any).payment_method_new === v ? "btn" : "btn secondary"} style={{ fontSize: 12, padding: "0 14px" }}
                      onClick={() => setForm({ ...form, payment_method_new: v } as any)}>{l}</button>
                  ))}
                </div>
                <div style={{ flex: "0 0 auto" }}>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 3 }}>결제일</div>
                  <input
                    className="input"
                    type="date"
                    style={{ width: 148 }}
                    value={(form as any).payment_date_new || today}
                    onChange={(e) => setForm({ ...form, payment_date_new: e.target.value } as any)}
                  />
                </div>
              </div>
            </>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
            <button className="btn" onClick={saveMember}>
              {isEdit ? "수정 저장" : "회원 저장"}
            </button>

            {isEdit && form.member_id && (
              <>
                <button
                  className="btn secondary"
                  onClick={() => { setShowForm(false); openHold({ ...form, member_id: form.member_id }); }}
                >
                  휴회
                </button>
                <button
                  className="btn secondary"
                  onClick={() => { location.href = `/member-detail?member_id=${form.member_id}`; }}
                >
                  상세
                </button>
              </>
            )}

            <button className="btn secondary" onClick={() => setShowForm(false)}>
              취소
            </button>

            {isEdit && form.member_id && (
              <button
                className="btn secondary"
                style={{ color: "#ff4d6d", marginLeft: "auto" }}
                onClick={() => { deleteMember(form); setShowForm(false); }}
              >
                삭제
              </button>
            )}
          </div>

        </div>
      )}

      {showExtendForm && extendMember && (
        <div className="card" style={{ marginBottom: 18, borderRadius: 24 }}>
          <h2>회원권 재등록</h2>
          <div style={{ color: "#aaa", marginBottom: 20 }}>
            {extendMember.name} / 현재: {extendMember.product_name}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>상품 선택</div>
              <select
                className="input"
                value={reregForm.product_name}
                onChange={(e) => setReregForm({ ...reregForm, product_name: e.target.value })}
              >
                <option value="">상품 선택</option>
                {products.map((p: any) => (
                  <option key={p.option_name} value={p.option_name}>{p.option_name}</option>
                ))}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>결제일</div>
              <input
                className="input"
                type="date"
                value={reregForm.payment_date}
                onChange={(e) => setReregForm({ ...reregForm, payment_date: e.target.value })}
              />
            </div>
            <div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>시작일 <span style={{ color: "#2563eb" }}>(만료일 이후 이어붙이기 가능)</span></div>
              <input
                className="input"
                type="date"
                value={(reregForm as any).start_date || reregForm.payment_date}
                onChange={(e) => setReregForm({ ...reregForm, start_date: e.target.value } as any)}
              />
            </div>
            <div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>결제수단</div>
              <select
                className="input"
                value={reregForm.payment_method}
                onChange={(e) => setReregForm({ ...reregForm, payment_method: e.target.value })}
              >
                <option value="CARD">카드</option>
                <option value="CASH">현금</option>
                <option value="TRANSFER">계좌이체</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>실결제금액</div>
              <input
                className="input"
                type="number"
                placeholder="0"
                value={reregForm.final_amount}
                onChange={(e) => setReregForm({ ...reregForm, final_amount: e.target.value, amount: e.target.value })}
                style={{ fontWeight: 700, color: "var(--accent)" }}
              />
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>메모</div>
            <input
              className="input"
              placeholder="메모"
              value={reregForm.memo}
              onChange={(e) => setReregForm({ ...reregForm, memo: e.target.value })}
            />
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button className="btn" onClick={saveRereg}>
              재등록 저장
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

      {showBulkExtend && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 9999,
          display: "flex", alignItems: "center", justifyContent: "center"
        }}>
          <div className="card" style={{ width: 360, borderRadius: 20, padding: 28 }}>
            <h2 style={{ marginTop: 0, fontSize: 18 }}>유효회원 기간 일괄 연장</h2>
            <p style={{ color: "#666", fontSize: 13, marginTop: -8 }}>
              기간권(DATE)이고 현재 유효한 회원의 만료일을 일괄 연장합니다.
            </p>

            {isAdminOrOwner && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 13, fontWeight: 600 }}>지점 선택</label>
                <select
                  className="input"
                  style={{ width: "100%", marginTop: 6 }}
                  value={bulkExtendBranch}
                  onChange={e => setBulkExtendBranch(e.target.value)}
                >
                  <option value="">지점을 선택하세요</option>
                  <option value="철산점">철산점</option>
                  <option value="목동점">목동점</option>
                  <option value="신정점">신정점</option>
                  <option value="개봉점">개봉점</option>
                </select>
              </div>
            )}

            {!isAdminOrOwner && (
              <div style={{ marginBottom: 14, fontSize: 13, color: "#555" }}>
                지점: <strong>{user?.branch_name}</strong>
              </div>
            )}

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13, fontWeight: 600 }}>연장 일수</label>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                <input
                  className="input"
                  type="number"
                  min={1}
                  style={{ width: 100 }}
                  value={bulkExtendDays}
                  onChange={e => setBulkExtendDays(e.target.value)}
                />
                <span style={{ fontSize: 13 }}>일</span>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                className="btn"
                style={{ flex: 1, background: "#f97316", color: "#fff" }}
                onClick={async () => {
                  const targetBranch = isAdminOrOwner ? bulkExtendBranch : user?.branch_name;
                  if (!targetBranch) { alert("지점을 선택해주세요"); return; }
                  const days = parseInt(bulkExtendDays);
                  if (!days || days <= 0) { alert("연장 일수를 입력해주세요"); return; }
                  if (!confirm(`${targetBranch} 유효회원 만료일을 ${days}일 연장하시겠습니까?`)) return;
                  const res = await apiFetch("/api/members/bulk-extend", {
                    method: "POST",
                    body: JSON.stringify({ branch_name: targetBranch, days }),
                  });
                  const data = await res.json();
                  if (data.success) {
                    alert(data.message);
                    setShowBulkExtend(false);
                    loadMembers(user);
                  } else {
                    alert(data.message || "연장 실패");
                  }
                }}
              >
                연장하기
              </button>
              <button className="btn" style={{ flex: 1 }} onClick={() => setShowBulkExtend(false)}>
                취소
              </button>
            </div>
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

      {/* 테이블 — 고정 헤더 + 내부 스크롤 */}
      <div
        className="card"
        style={{
          borderRadius: 12,
          padding: 0,
          overflow: "hidden",
        }}
      >
        {/* 고정 헤더 */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: memberGridColumns,
            gap: 8,
            padding: "7px 12px",
            borderBottom: "1px solid #374151",
            color: "#9ca3af",
            fontSize: 11,
            fontWeight: 900,
            alignItems: "center",
            background: "rgba(255,255,255,0.04)",
            flexShrink: 0,
            letterSpacing: "0.03em",
          }}
        >
          <div>#</div>
          <div>회원명</div>
          {showBranchCol && <div>지점</div>}
          <div>프로그램</div>
          <div>이용기간</div>
          <div>잔여</div>
          <div>락카</div>
          <div>출석번호</div>
          <div>상태</div>
          <div>가입일</div>
          <div>관리</div>
        </div>

        <div>
          {pagedMembers.map((m, index) => {
            const status = getStatus(m);
            const remaining = getRemainingDisplay(m);

            return (
              <div
                key={m.member_id}
                style={{
                  display: "grid",
                  gridTemplateColumns: memberGridColumns,
                  gap: 8,
                  padding: "5px 12px",
                  borderBottom: "1px solid #1f2937",
                  alignItems: "center",
                  cursor: "pointer",
                  fontSize: 13,
                  minHeight: 36,
                }}
                onClick={() => {
                  location.href = `/member-detail?member_id=${m.member_id}`;
                }}
              >
                <div style={{ color: "#6b7280", fontSize: 11 }}>{(page - 1) * pageSize + index + 1}</div>

                <div style={{ fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name}</div>

                {showBranchCol && (
                  <div style={{ color: "#60a5fa", fontSize: 12, fontWeight: 700 }}>
                    {m.branch_name}
                  </div>
                )}

                <div style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.product_name || <span style={{ color: "#555" }}>미등록</span>}</div>

                <div style={{ fontSize: 11, color: "#9ca3af" }}>
                  {m.start_date?.slice(0, 10) || "-"} ~ {m.end_date?.slice(0, 10) || "-"}
                </div>

                <div style={{ fontWeight: 700, color: remaining.color, fontSize: 13 }}>
                  {remaining.text}
                </div>

                <div style={{ fontSize: 12, color: m.locker_no ? "#e2e8f0" : "#4b5563" }}>
                  {m.locker_no || "없음"}
                </div>

                <div style={{ fontSize: 12, color: "#9ca3af" }}>{m.checkin_code || "-"}</div>

                <div>
                  <span
                    style={{
                      background: `${status.color}22`,
                      color: status.color,
                      padding: "2px 7px",
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 900,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {status.text}
                  </span>
                </div>

                <div style={{ fontSize: 11, color: "#6b7280" }}>
                  {m.join_date?.slice(0, 10) || m.start_date?.slice(0, 10) || "-"}
                </div>

                <div
                  style={{ display: "flex", gap: 5, flexWrap: "nowrap" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    className="btn secondary"
                    onClick={() => openEdit(m)}
                    style={{ ...miniBtnStyle, height: 28, padding: "3px 8px" }}
                  >
                    수정
                  </button>
                  <button
                    className="btn"
                    onClick={() => openExtend(m)}
                    style={{ ...miniBtnStyle, height: 28, padding: "3px 8px" }}
                  >
                    재등록
                  </button>
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div style={{ padding: 32, textAlign: "center", color: "#555" }}>
              회원이 없습니다.
            </div>
          )}
        </div>

        {/* 페이지네이션 (테이블 하단 고정) */}
        {totalPages > 1 && (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: 4,
              padding: "6px 12px",
              borderTop: "1px solid #1f2937",
              flexShrink: 0,
              flexWrap: "wrap",
            }}
          >
            <button
              className="btn secondary"
              style={{ height: 28, padding: "0 10px", fontSize: 12 }}
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
                  {startPage > 1 && (
                    <button className="btn secondary" style={{ height: 28, padding: "0 8px", fontSize: 12 }}
                      onClick={() => setPage(Math.max(1, startPage - groupSize))}>◀◀</button>
                  )}
                  {Array.from({ length: endPage - startPage + 1 }).map((_, i) => {
                    const pageNum = startPage + i;
                    return (
                      <button key={pageNum}
                        className={page === pageNum ? "btn" : "btn secondary"}
                        style={{ height: 28, minWidth: 32, padding: "0 6px", fontSize: 12 }}
                        onClick={() => setPage(pageNum)}>
                        {pageNum}
                      </button>
                    );
                  })}
                  {endPage < totalPages && (
                    <button className="btn secondary" style={{ height: 28, padding: "0 8px", fontSize: 12 }}
                      onClick={() => setPage(Math.min(totalPages, startPage + groupSize))}>▶▶</button>
                  )}
                </>
              );
            })()}

            <button
              className="btn secondary"
              style={{ height: 28, padding: "0 10px", fontSize: 12 }}
              disabled={page === totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              다음
            </button>

            <span style={{ fontSize: 11, color: "#6b7280", marginLeft: 4 }}>
              {page} / {totalPages}
            </span>
          </div>
        )}
      </div>
    </AppShell>
  );
}