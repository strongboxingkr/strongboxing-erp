"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { apiFetch } from "@/lib/api";

const today = new Date().toISOString().slice(0, 10);

const makeDefaultForm = () => ({
  lead_id: null as any,
  branch_name: "철산점",
  customer_name: "",
  phone: "",
  inquiry_type: "신규상담",
  inquiry_channel: "네이버예약",
  status: "신규문의",
  memo: "",
  next_contact_date: today,
  auto_create_member: false,
  go_payment_after_save: false,
});

const statusColor = (status: string) => {
  if (status === "등록완료") return "#22c55e";
  if (status === "재연락필요") return "#ff4d6d";
  if (status === "방문예약") return "#3b82f6";
  if (status === "상담중") return "#f59e0b";
  return "#999";
};

export default function CrmPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(makeDefaultForm());
  const [isEdit, setIsEdit] = useState(false);
  const [user, setUser] = useState<any>(null);

  const getUser = () => {
    if (typeof window === "undefined") return null;

    const savedUser = localStorage.getItem("user");
    return savedUser ? JSON.parse(savedUser) : null;
  };

  const isAdminOrOwner =
    user?.role === "ADMIN" || user?.role === "OWNER";

  const loadBranches = async () => {
    const res = await apiFetch(
      "/api/settings?option_type=BRANCH"
    );

    const data = await res.json();
    setBranches(data.rows || []);
  };

  const loadChannels = async () => {
    const res = await apiFetch(
      "/api/settings?option_type=CRM_CHANNEL"
    );

    const data = await res.json();
    setChannels(data.rows || []);
  };

  const loadCrm = async (currentUser = user) => {
    let url = "/api/crm";

    if (
      currentUser &&
      currentUser.role !== "ADMIN" &&
      currentUser.role !== "OWNER"
    ) {
      url += `?branch_name=${encodeURIComponent(
        currentUser.branch_name
      )}`;
    }

    const res = await apiFetch(url);
    const data = await res.json();

    setRows(data.rows || []);
  };

  useEffect(() => {
    const savedUser = getUser();

    setUser(savedUser);

    loadBranches();
    loadChannels();
    loadCrm(savedUser);
  }, []);

  const saveCrm = async () => {
    const url = isEdit
      ? "/api/crm/update"
      : "/api/crm/add";

    const targetForm = {
      ...form,
      branch_name: isAdminOrOwner
        ? form.branch_name
        : user?.branch_name,
    };

    const res = await apiFetch(url, {
      method: "POST",
      body: JSON.stringify(targetForm),
    });

    const data = await res.json();

    if (data.success) {
      alert(
        isEdit
          ? "상담 수정 완료!"
          : "상담 등록 완료!"
      );

      const shouldGoPayment =
        form.go_payment_after_save;

      setForm({
        ...makeDefaultForm(),
        branch_name:
          branches[0]?.option_name ||
          "철산점",
      });

      setIsEdit(false);

      loadCrm(user);

      if (shouldGoPayment) {
        location.href = "/payments";
      }
    } else {
      alert(data.message || "저장 실패");
    }
  };

  const editCrm = (r: any) => {
    setIsEdit(true);

    setForm({
      lead_id: r.lead_id,
      branch_name:
        r.branch_name || "철산점",
      customer_name:
        r.customer_name || "",
      phone: r.phone || "",
      inquiry_type:
        r.inquiry_type || "신규상담",
      inquiry_channel:
        r.inquiry_channel ||
        "네이버예약",
      status:
        r.status || "신규문의",
      memo: r.memo || "",
      next_contact_date:
        r.next_contact_date?.slice(
          0,
          10
        ) || today,
      auto_create_member: false,
      go_payment_after_save: false,
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const cancelEdit = () => {
    setIsEdit(false);

    setForm({
      ...makeDefaultForm(),
      branch_name:
        branches[0]?.option_name ||
        "철산점",
    });
  };

  const filtered = rows.filter((r) => {
    if (!search) return true;

    return (
      r.customer_name?.includes(search) ||
      r.phone?.includes(search) ||
      r.memo?.includes(search) ||
      r.status?.includes(search) ||
      r.inquiry_channel?.includes(search)
    );
  });

  return (
    <AppShell title="상담 CRM">
      <div
        className="card"
        style={{
          marginBottom: 18,
          borderRadius: 24,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            gap: 20,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 34,
                fontWeight: 900,
              }}
            >
              상담 CRM
            </h1>

            <p
              style={{
                color: "#888",
                marginTop: 8,
              }}
            >
              예약 / 상담 / 등록 흐름을 관리합니다.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <input
              className="input"
              placeholder="이름 / 전화번호 / 상태 검색"
              style={{ width: 280 }}
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
            />

            <button
              className="btn secondary"
              onClick={() =>
                loadCrm(user)
              }
            >
              새로고침
            </button>
          </div>
        </div>
      </div>

      <div
        className="card"
        style={{
          marginBottom: 18,
          borderRadius: 24,
        }}
      >
        <h2>
          {isEdit
            ? "상담 수정"
            : "상담 등록"}
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(4, 1fr)",
            gap: 12,
          }}
        >
          {isAdminOrOwner ? (
            <select
              className="input"
              value={form.branch_name}
              onChange={(e) =>
                setForm({
                  ...form,
                  branch_name:
                    e.target.value,
                })
              }
            >
              {branches.map((b) => (
                <option
                  key={b.option_id}
                  value={
                    b.option_name
                  }
                >
                  {b.option_name}
                </option>
              ))}
            </select>
          ) : (
            <div
              className="input"
              style={{
                color: "#aaa",
              }}
            >
              {user?.branch_name}
            </div>
          )}

          <input
            className="input"
            placeholder="이름"
            value={form.customer_name}
            onChange={(e) =>
              setForm({
                ...form,
                customer_name:
                  e.target.value,
              })
            }
          />

          <input
            className="input"
            placeholder="전화번호"
            value={form.phone}
            onChange={(e) =>
              setForm({
                ...form,
                phone:
                  e.target.value,
              })
            }
          />

          <select
            className="input"
            value={
              form.inquiry_channel
            }
            onChange={(e) =>
              setForm({
                ...form,
                inquiry_channel:
                  e.target.value,
              })
            }
          >
            <option>
              네이버예약
            </option>

            {channels.map((c) => (
              <option
                key={c.option_id}
                value={
                  c.option_name
                }
              >
                {c.option_name}
              </option>
            ))}
          </select>

          <select
            className="input"
            value={
              form.inquiry_type
            }
            onChange={(e) =>
              setForm({
                ...form,
                inquiry_type:
                  e.target.value,
              })
            }
          >
            <option>
              신규상담
            </option>
            <option>
              재등록문의
            </option>
            <option>
              가격문의
            </option>
            <option>
              체험문의
            </option>
            <option>기타</option>
          </select>

          <select
            className="input"
            value={form.status}
            onChange={(e) =>
              setForm({
                ...form,
                status:
                  e.target.value,
              })
            }
          >
            <option>
              신규문의
            </option>
            <option>상담중</option>
            <option>
              방문예약
            </option>
            <option>
              등록완료
            </option>
            <option>
              재연락필요
            </option>
            <option>보류</option>
            <option>노쇼</option>
          </select>

          <input
            className="input"
            type="date"
            value={
              form.next_contact_date
            }
            onChange={(e) =>
              setForm({
                ...form,
                next_contact_date:
                  e.target.value,
              })
            }
          />

          <button
            className="btn"
            onClick={saveCrm}
          >
            {isEdit
              ? "수정 저장"
              : "상담 등록"}
          </button>

          <textarea
            className="input"
            placeholder="상담 메모"
            value={form.memo}
            onChange={(e) =>
              setForm({
                ...form,
                memo:
                  e.target.value,
              })
            }
            style={{
              gridColumn:
                "1 / 5",
              minHeight: 100,
            }}
          />

          <label
            style={{
              color: "var(--text)",
            }}
          >
            <input
              type="checkbox"
              checked={
                form.auto_create_member
              }
              onChange={(e) =>
                setForm({
                  ...form,
                  auto_create_member:
                    e.target.checked,
                })
              }
            />{" "}
            등록완료 시 회원 자동 생성
          </label>

          <label
            style={{
              color: "var(--text)",
            }}
          >
            <input
              type="checkbox"
              checked={
                form.go_payment_after_save
              }
              onChange={(e) =>
                setForm({
                  ...form,
                  go_payment_after_save:
                    e.target.checked,
                })
              }
            />{" "}
            저장 후 결제관리 이동
          </label>
        </div>

        {isEdit && (
          <div
            style={{
              marginTop: 14,
            }}
          >
            <button
              className="btn secondary"
              onClick={cancelEdit}
            >
              수정 취소
            </button>
          </div>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gap: 14,
        }}
      >
        {filtered.map((r) => (
          <div
            key={r.lead_id}
            className="card"
            style={{
              borderRadius: 24,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                gap: 20,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <div>
                <div
                  style={{
                    display:
                      "flex",
                    gap: 10,
                    alignItems:
                      "center",
                    flexWrap:
                      "wrap",
                  }}
                >
                  <div
                    style={{
                      fontSize: 28,
                      fontWeight: 900,
                    }}
                  >
                    {
                      r.customer_name
                    }
                  </div>

                  <div
                    style={{
                      background: `${statusColor(
                        r.status
                      )}22`,
                      color:
                        statusColor(
                          r.status
                        ),
                      padding:
                        "6px 12px",
                      borderRadius: 999,
                      fontWeight: 900,
                      fontSize: 13,
                    }}
                  >
                    {r.status}
                  </div>
                </div>

                <div
                  style={{
                    marginTop: 10,
                    color: "#888",
                  }}
                >
                  {r.phone}
                </div>

                <div
                  style={{
                    marginTop: 8,
                    display:
                      "flex",
                    gap: 8,
                    flexWrap:
                      "wrap",
                  }}
                >
                  <div
                    style={{
                      background:
                        "var(--panel2)",
                      padding:
                        "6px 10px",
                      borderRadius: 999,
                      color:
                        "#aaa",
                      fontSize: 13,
                    }}
                  >
                    {
                      r.inquiry_channel
                    }
                  </div>

                  <div
                    style={{
                      background:
                        "var(--panel2)",
                      padding:
                        "6px 10px",
                      borderRadius: 999,
                      color:
                        "#aaa",
                      fontSize: 13,
                    }}
                  >
                    {
                      r.inquiry_type
                    }
                  </div>

                  {isAdminOrOwner && (
                    <div
                      style={{
                        background:
                          "var(--panel2)",
                        padding:
                          "6px 10px",
                        borderRadius: 999,
                        color:
                          "#aaa",
                        fontSize: 13,
                      }}
                    >
                      {
                        r.branch_name
                      }
                    </div>
                  )}
                </div>
              </div>

              <div
                style={{
                  minWidth: 220,
                }}
              >
                <div
                  style={{
                    color: "#888",
                    fontSize: 13,
                  }}
                >
                  다음 연락 예정
                </div>

                <div
                  style={{
                    marginTop: 8,
                    fontSize: 22,
                    fontWeight: 900,
                  }}
                >
                  {r.next_contact_date?.slice(
                    0,
                    10
                  )}
                </div>

                <button
                  className="btn secondary"
                  style={{
                    marginTop: 14,
                    width: "100%",
                  }}
                  onClick={() =>
                    editCrm(r)
                  }
                >
                  상담 수정
                </button>
              </div>
            </div>

            {r.memo && (
              <div
                style={{
                  marginTop: 18,
                  background:
                    "var(--panel2)",
                  borderRadius: 18,
                  padding: 16,
                  color: "#bbb",
                  whiteSpace:
                    "pre-wrap",
                }}
              >
                {r.memo}
              </div>
            )}
          </div>
        ))}
      </div>
    </AppShell>
  );
}