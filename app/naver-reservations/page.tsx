"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { apiFetch } from "@/lib/api";

const statuses = [
  "예약접수",
  "예약확정",
  "확인완료",
  "상담완료",
  "노쇼",
  "취소",
];

const getStatusColor = (status: string) => {
  if (status === "예약접수") return "#3b82f6";
  if (status === "예약확정") return "#22c55e";
  if (status === "확인완료") return "#8b5cf6";
  if (status === "상담완료") return "#f59e0b";
  if (status === "노쇼") return "#ef4444";
  if (status === "취소") return "#6b7280";
  return "#9ca3af";
};

const getSourceInfo = (r: any) => {
  const memo = String(r.memo || "");
  const product = String(r.reservation_product || "");

  if (memo.includes("출처: 홈페이지 예약") || product.includes("홈페이지")) {
    return {
      label: "홈페이지",
      color: "#3b82f6",
      bg: "rgba(59,130,246,0.15)",
    };
  }

  return {
    label: "네이버",
    color: "#22c55e",
    bg: "rgba(34,197,94,0.15)",
  };
};

export default function NaverReservationsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [branch, setBranch] = useState("전체");
  const [selected, setSelected] = useState<any>(null);
  const [modalMemo, setModalMemo] = useState("");
  const [search, setSearch] = useState("");
  const [user, setUser] = useState<any>(null);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [smsModalOpen, setSmsModalOpen] = useState(false);
  const [smsReservation, setSmsReservation] = useState<any>(null);
  const [smsMessage, setSmsMessage] = useState("");

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

  const loadReservations = async (currentUser = user) => {
    let url = "/api/naver-reservations";

    if (
      currentUser &&
      currentUser.role !== "ADMIN" &&
      currentUser.role !== "OWNER"
    ) {
      url += `?branch_name=${encodeURIComponent(currentUser.branch_name)}`;
    } else if (branch !== "전체") {
      url += `?branch_name=${encodeURIComponent(branch)}`;
    }

    const res = await apiFetch(url);
    const data = await res.json();
    setRows(data.rows || []);
  };

  const syncGmail = async () => {
    const res = await apiFetch("/api/naver-reservations/sync");
    const data = await res.json();

    if (data.success) {
      alert(`메일 동기화 완료!\n확인: ${data.checked}건\n신규등록: ${data.inserted}건`);
      loadReservations(user);
    } else {
      alert("메일 동기화 실패");
      console.log(data);
    }
  };

  const updateReservation = async (
    r: any,
    status: string,
    memo?: string,
    smsMessage?: string
  ) => {

  if (status === "노쇼") {
    const ok = confirm("노쇼 처리하시겠습니까?");
    if (!ok) return;
  }

  if (status === "취소") {
    const ok = confirm("예약을 취소하시겠습니까?");
    if (!ok) return;
  }

  const res = await apiFetch("/api/naver-reservations/update", {
      method: "POST",
      body: JSON.stringify({
      reservation_id: r.reservation_id,
      status,
      memo: memo ?? r.memo ?? "",
      sms_message: smsMessage || "",
    }),
    });

    const data = await res.json();

    if (data.success) {
      if (status === "예약확정") {
        alert("예약확정 및 안내문자 발송 완료");
      } else {
        alert("예약 상태 수정 완료");
      }

      await loadReservations(user);
      const updated = {
        ...r,
        status,
        memo: memo ?? r.memo ?? "",
      };
      setSelected(updated);
      setModalMemo(updated.memo || "");
    } else {
      alert(data.message || "수정 실패");
    }
  };

  const openModal = (r: any) => {
    setSelected(r);
    setModalMemo(r.memo || "");
  };

  useEffect(() => {
    const savedUser = getUser();
    setUser(savedUser);

    loadBranches();
    loadReservations(savedUser);
  }, []);

  useEffect(() => {
    if (user) {
      loadReservations(user);

      const timer = setInterval(() => {
        loadReservations(user);
      }, 30000);

      return () => clearInterval(timer);
    }
  }, [branch, user]);

    const filtered = rows 
    .filter((r) => {
      const date = r.reservation_date?.slice(0, 10);

      const dateOk =
        (!startDate || date >= startDate) &&
        (!endDate || date <= endDate);

      const searchOk =
        !search ||
        r.customer_name?.includes(search) ||
        r.phone?.includes(search) ||
        r.branch_name?.includes(search) ||
        r.reservation_product?.includes(search) ||
        r.status?.includes(search);

      return dateOk && searchOk;
    })
    .sort((a, b) => {
      const aDate = `${a.reservation_date || "9999-99-99"} ${
        a.reservation_time || "99:99"
      }`;
      const bDate = `${b.reservation_date || "9999-99-99"} ${
        b.reservation_time || "99:99"
      }`;
      return aDate.localeCompare(bDate);
    });

  const countByStatus = (status: string) =>
    filtered.filter((r) => r.status === status).length;

  const statCards: [string, number, string][] = [
    ["전체", filtered.length, "#3b82f6"],
    ["예약접수", countByStatus("예약접수"), "#3b82f6"],
    ["예약확정", countByStatus("예약확정"), "#22c55e"],
    ["확인완료", countByStatus("확인완료"), "#8b5cf6"],
    ["상담완료", countByStatus("상담완료"), "#f59e0b"],
    ["노쇼", countByStatus("노쇼"), "#ef4444"],
    ["취소", countByStatus("취소"), "#9ca3af"],
  ];

  return (
    <AppShell title="네이버 예약 관리">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 34, fontWeight: 900 }}>
            네이버 예약 관리
          </h1>
          <p style={{ color: "#aaa", marginTop: 8 }}>
            예약일/예약시간은 고객이 실제 방문하기로 한 이용일시 기준입니다.
          </p>
        </div>

        <div className="row">
          <button className="btn" onClick={syncGmail}>
            메일 수동 동기화
          </button>

          <button className="btn secondary" onClick={() => loadReservations(user)}>
            새로고침
          </button>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 14,
          margin: "24px 0",
        }}
      >
        {statCards.map(([title, value, color]) => (
          <div className="card" key={title}>
            <div style={{ color: "#ddd", fontWeight: 800 }}>{title}</div>
            <div style={{ color, fontSize: 34, fontWeight: 900, marginTop: 8 }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.2fr 1fr 1fr 2fr auto auto",
            gap: 12,
          }}
        >
          {isAdminOrOwner ? (
            <select
              className="input"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
            >
              <option>전체</option>
              {branches.map((b) => (
                <option key={b.option_id}>{b.option_name}</option>
              ))}
            </select>
          ) : (
            <div className="input" style={{ color: "#aaa" }}>
              {user?.branch_name}
            </div>
          )}

          <input
            className="input"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />

          <input
            className="input"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />

          <input
            className="input"
            placeholder="예약자명, 전화번호, 상태, 상품 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <button className="btn" onClick={() => loadReservations(user)}>
            검색
          </button>

          <button
            className="btn secondary"
            onClick={() => {
              setBranch("전체");
              setStartDate("");
              setEndDate("");
              setSearch("");
            }}
          >
            초기화
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>출처</th>
                <th>방문일</th>
                <th>방문시간</th>
                <th>예약자명</th>
                <th>연락처</th>
                <th>지점</th>
                <th>상품</th>
                <th>상태</th>
                <th>메일수신일</th>
                <th>보기</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((r) => (
                <tr
                  key={r.reservation_id}
                  onClick={() => openModal(r)}
                  style={{
                    cursor: "pointer",
                    background:
                      selected?.reservation_id === r.reservation_id
                        ? "rgba(59,130,246,0.12)"
                        : undefined,
                  }}
                >
                  <td>
                    {(() => {
                      const source = getSourceInfo(r);

                      return (
                        <span
                          style={{
                            padding: "6px 10px",
                            borderRadius: 8,
                            background: source.bg,
                            color: source.color,
                            fontWeight: 900,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {source.label}
                        </span>
                      );
                    })()}
                  </td>

                  <td style={{ color: "#3b82f6", fontWeight: 900 }}>
                    {r.reservation_date?.slice(0, 10) || "-"}
                  </td>

                  <td style={{ fontWeight: 900 }}>
                    {r.reservation_time || "-"}
                  </td>

                  <td style={{ fontWeight: 900 }}>
                    {r.customer_name || "-"}
                  </td>

                  <td>{r.phone || "-"}</td>

                  <td>
                    <span
                      style={{
                        padding: "6px 10px",
                        borderRadius: 8,
                        background: "rgba(34,197,94,0.15)",
                        color: "#22c55e",
                        fontWeight: 900,
                      }}
                    >
                      {r.branch_name || "-"}
                    </span>
                  </td>

                  <td
                    style={{
                      maxWidth: 360,
                      whiteSpace: "normal",
                      lineHeight: 1.5,
                    }}
                  >
                    {r.reservation_product || "-"}
                  </td>

                  <td>
                    <span
                      style={{
                        padding: "6px 10px",
                        borderRadius: 8,
                        background: `${getStatusColor(r.status)}22`,
                        color: getStatusColor(r.status),
                        fontWeight: 900,
                        whiteSpace: "nowrap",
                      }}
                    >
                      ● {r.status}
                    </span>
                  </td>

                  <td>{r.created_at?.slice(0, 16).replace("T", " ")}</td>
                  <td style={{ fontSize: 24 }}>›</td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} style={{ textAlign: "center", color: "#aaa" }}>
                    조회된 예약이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div
          onClick={() => setSelected(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.72)",
            display: "grid",
            placeItems: "center",
            zIndex: 9999,
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 760,
              maxHeight: "90vh",
              overflow: "auto",
              background: "#111827",
              border: "1px solid #273244",
              borderRadius: 24,
              padding: 28,
              boxShadow: "0 30px 80px rgba(0,0,0,0.45)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: 24,
                gap: 16,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 32,
                    fontWeight: 900,
                  }}
                >
                  {selected.customer_name || "-"}
                </div>

                <div
                  style={{
                    color: "#94a3b8",
                    marginTop: 8,
                    fontSize: 16,
                  }}
                >
                  {selected.branch_name || "-"} / {selected.reservation_product || "-"}
                </div>
              </div>

              <button
                className="btn secondary"
                onClick={() => setSelected(null)}
              >
                닫기
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 14,
                marginBottom: 24,
              }}
            >
              <div className="card">
                <div style={{ color: "#94a3b8" }}>방문일</div>
                <div style={{ marginTop: 8, fontSize: 22, fontWeight: 900 }}>
                  {selected.reservation_date?.slice(0, 10) || "-"}
                </div>
              </div>

              <div className="card">
                <div style={{ color: "#94a3b8" }}>방문시간</div>
                <div style={{ marginTop: 8, fontSize: 22, fontWeight: 900 }}>
                  {selected.reservation_time || "-"}
                </div>
              </div>

              <div className="card">
                <div style={{ color: "#94a3b8" }}>연락처</div>
                <div style={{ marginTop: 8, fontSize: 20, fontWeight: 800 }}>
                  {selected.phone || "-"}
                </div>
              </div>

              <div className="card">
                <div style={{ color: "#94a3b8" }}>메일수신일</div>
                <div style={{ marginTop: 8, fontSize: 18, fontWeight: 800 }}>
                  {selected.created_at?.slice(0, 16).replace("T", " ") || "-"}
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 12, color: "#94a3b8", fontWeight: 800 }}>
              예약 상태
            </div>

            <div
              style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                marginBottom: 24,
              }}
            >
              {statuses.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    if (s === "예약확정") {
                      const target = selected;

                      setSmsReservation(target);

                      setSmsMessage(
                    `[스트롱복싱 ${target.branch_name}]

                    ${target.customer_name}님 예약이 확정되었습니다.

                    방문일시 : ${target.reservation_date?.slice(0, 10)} ${target.reservation_time}
                    예약내용 : ${target.reservation_product || "방문 상담"}

                    편한 복장과 실내 운동화를 지참 후 방문 부탁드립니다.
                    처음 방문이신 경우 예약시간 5~10분 전 도착 부탁드립니다.

                    감사합니다.
                    스트롱복싱 ${target.branch_name}`
                      );

                      setSelected(null);
                      setSmsModalOpen(true);

                      return;
                    }

                    updateReservation(selected, s, modalMemo);
                  }}
                  style={{
                    border: "none",
                    padding: "12px 18px",
                    borderRadius: 14,
                    fontWeight: 900,
                    cursor: "pointer",
                    background:
                      selected.status === s ? getStatusColor(s) : "#1f2937",
                    color: "white",
                  }}
                >
                  {s}
                </button>
              ))}
            </div>

            <div style={{ color: "#94a3b8", marginBottom: 10, fontWeight: 800 }}>
              메모 / 상담내용
            </div>

            <textarea
              className="input"
              value={modalMemo}
              onChange={(e) => setModalMemo(e.target.value)}
              placeholder="상담 메모 입력..."
              style={{
                width: "100%",
                minHeight: 130,
                resize: "none",
                marginBottom: 14,
              }}
            />

            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <button
                className="btn secondary"
                onClick={() => setModalMemo(selected.memo || "")}
              >
                메모 되돌리기
              </button>

              <button
                className="btn"
                onClick={() =>
                  updateReservation(selected, selected.status, modalMemo)
                }
              >
                메모 저장
              </button>
            </div>

            <details style={{ marginTop: 20 }}>
              <summary
                style={{
                  color: "#94a3b8",
                  cursor: "pointer",
                  fontWeight: 900,
                }}
              >
                메일 원문 보기
              </summary>

              <div
                style={{
                  background: "#0b1220",
                  border: "1px solid #273244",
                  borderRadius: 12,
                  padding: 12,
                  maxHeight: 220,
                  overflow: "auto",
                  whiteSpace: "pre-wrap",
                  fontSize: 13,
                  color: "#ddd",
                  marginTop: 10,
                }}
              >
                {selected.memo || "상세 내용 없음"}
              </div>
            </details>
          </div>
        </div>
      )}
            {smsModalOpen && smsReservation && (
        <div
          onClick={() => setSmsModalOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            display: "grid",
            placeItems: "center",
            zIndex: 10000,
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 620,
              background: "#111827",
              border: "1px solid #273244",
              borderRadius: 24,
              padding: 26,
            }}
          >
            <h2 style={{ marginTop: 0 }}>문자 발송 확인</h2>

            <div style={{ color: "#94a3b8", marginBottom: 14 }}>
              {smsReservation.customer_name} / {smsReservation.phone}
              <br />
              {smsReservation.reservation_date?.slice(0, 10)}{" "}
              {smsReservation.reservation_time}
            </div>

            <textarea
              className="input"
              value={smsMessage}
              onChange={(e) => setSmsMessage(e.target.value)}
              style={{
                width: "100%",
                minHeight: 220,
                resize: "vertical",
                marginBottom: 16,
              }}
            />

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                className="btn secondary"
                onClick={() => setSmsModalOpen(false)}
              >
                취소
              </button>

              <button
                className="btn"
                onClick={async () => {
                  await updateReservation(
                    smsReservation,
                    "예약확정",
                    modalMemo,
                    smsMessage
                  );

                  setSmsModalOpen(false);
                }}
              >
                예약확정 + 문자발송
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}