"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { apiFetch } from "@/lib/api";

const money = (v: any) =>
  `${Number(v || 0).toLocaleString()}원`;

export default function MemberDetailPage() {
  const [memberId, setMemberId] = useState("");
  const [data, setData] = useState<any>(null);
  const [memo, setMemo] = useState("");

  const [notes, setNotes] = useState<any[]>([]);
  const [files, setFiles] = useState<any[]>([]);

  const [checkins, setCheckins] = useState<any[]>([]);
  const [tab, setTab] = useState("INFO");
  const [histories, setHistories] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);

  const [uploading, setUploading] =
    useState(false);

  const [fileForm, setFileForm] =
    useState({
      file_type: "입관서",
      memo: "",
    });

  const [noteForm, setNoteForm] =
    useState({
      note_type: "상담",
      content: "",
    });

  const loadNotes = async (
    id: string
  ) => {
    const res = await apiFetch(
      `/api/member-notes?member_id=${id}`
    );

    const json =
      await res.json();

    setNotes(json.rows || []);
  };

  const loadCheckins =
    async (id: string) => {
      const res = await apiFetch(
        `/api/checkins/member?member_id=${id}`
      );

      const json =
        await res.json();

      setCheckins(
        json.rows || []
      );
    };

    const loadFiles = async (
      id: string
    ) => {
      const res = await apiFetch(
        `/api/member-files?member_id=${id}`
      );

      const json =
        await res.json();

      setFiles(json.rows || []);
    };

    const loadHistories = async (id: string) => {
    const res = await apiFetch(`/api/member-histories?member_id=${id}`);
    const json = await res.json();
    setHistories(json.rows || []);
  };

  const loadPayments = async (id: string) => {
    const res = await apiFetch(`/api/payments?member_id=${id}`);
    const json = await res.json();
    setPayments(json.rows || []);
  };

  const uploadFile = async (
    e: any
  ) => {
    const file =
      e.target.files?.[0];

    if (!file) return;

    if (!data?.member?.member_id)
      return;

    setUploading(true);

    try {
      const formData =
        new FormData();

      formData.append(
        "file",
        file
      );

      formData.append(
        "member_id",
        data.member.member_id
      );

      formData.append(
        "file_type",
        fileForm.file_type
      );

      formData.append(
        "memo",
        fileForm.memo
      );

      const res = await fetch(
        "/api/member-files/upload",
        {
          method: "POST",
          body: formData,
        }
      );

      const json =
        await res.json();

      if (json.success) {
        alert(
          "파일 업로드 완료!"
        );

        setFileForm({
          file_type: "입관서",
          memo: "",
        });

        loadFiles(
          String(
            data.member.member_id
          )
        );
      } else {
        alert(
          json.message ||
            "업로드 실패"
        );
      }
    } finally {
      setUploading(false);
    }
  };

  const load = async () => {
    if (!memberId) return;

    const res = await apiFetch(
      `/api/members/detail?member_id=${memberId}`
    );

    const json =
      await res.json();

    if (json.success) {
      setData(json);

      setMemo(
        json.member.memo || ""
      );

      loadNotes(memberId);
      loadFiles(memberId);
      loadCheckins(memberId);
      loadHistories(memberId);
      loadPayments(memberId);

    } else {
      alert(
        json.message ||
          "조회 실패"
      );
    }
  };

  const saveMemo = async () => {
    if (!data?.member?.member_id)
      return;

    const res = await apiFetch(
      "/api/members/update-memo",
      {
        method: "POST",
        body: JSON.stringify({
          member_id:
            data.member.member_id,
          memo,
        }),
      }
    );

    const json =
      await res.json();

    if (json.success) {
      alert(
        "메모 저장 완료!"
      );

      load();
    } else {
      alert(
        json.message ||
          "저장 실패"
      );
    }
  };

  const addNote = async () => {
    if (!data?.member?.member_id)
      return;

    if (
      !noteForm.content.trim()
    ) {
      alert(
        "상담 내용을 입력해주세요."
      );

      return;
    }

    const res = await apiFetch(
      "/api/member-notes/add",
      {
        method: "POST",
        body: JSON.stringify({
          member_id:
            data.member.member_id,
          note_type:
            noteForm.note_type,
          content:
            noteForm.content,
        }),
      }
    );

    const json =
      await res.json();

    if (json.success) {
      setNoteForm({
        note_type: "상담",
        content: "",
      });

      loadNotes(
        String(
          data.member.member_id
        )
      );
    } else {
      alert(
        json.message ||
          "추가 실패"
      );
    }
  };

  useEffect(() => {
    const params =
      new URLSearchParams(
        window.location.search
      );

    const id =
      params.get("member_id");

    if (id) {
      setMemberId(id);
    }
  }, []);

  useEffect(() => {
    if (memberId) {
      load();
    }
  }, [memberId]);

  return (
    <AppShell title="회원 상세">
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
            gap: 12,
            alignItems: "center",
          }}
        >
          <input
            className="input"
            placeholder="회원 ID 입력"
            value={memberId}
            onChange={(e) =>
              setMemberId(
                e.target.value
              )
            }
            style={{
              width: 260,
            }}
          />

          <button
            className="btn"
            onClick={load}
          >
            회원 조회
          </button>
        </div>
      </div>

      {data && (
        <>
          <div
            className="card"
            style={{
              borderRadius: 28,
              marginBottom: 18,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                gap: 20,
                flexWrap: "wrap",
              }}
            >
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div
                    style={{
                      fontSize: 40,
                      fontWeight: 900,
                    }}
                  >
                    {data.member.name}
                  </div>

                  <button
                    className="btn secondary"
                    onClick={() => {
                      location.href = `/members?member_id=${data.member.member_id}`;
                    }}
                  >
                    수정
                  </button>

                  {data.member.status === "REST" && (
                    <div
                      style={{
                        background: "rgba(245,158,11,.15)",
                        color: "#f59e0b",
                        padding: "6px 12px",
                        borderRadius: 999,
                        fontSize: 13,
                        fontWeight: 900,
                      }}
                    >
                      휴회중
                    </div>
                  )}

                  {data.member.status === "EXPIRED" && (
                    <div
                      style={{
                        background: "rgba(239,68,68,.15)",
                        color: "#ef4444",
                        padding: "6px 12px",
                        borderRadius: 999,
                        fontSize: 13,
                        fontWeight: 900,
                      }}
                    >
                      만료
                    </div>
                  )}

                  {Number(data.member.remaining_count || 0) > 0 &&
                    Number(data.member.remaining_count) <= 3 && (
                      <div
                        style={{
                          background: "rgba(255,77,109,.15)",
                          color: "#ff4d6d",
                          padding: "6px 12px",
                          borderRadius: 999,
                          fontSize: 13,
                          fontWeight: 900,
                        }}
                      >
                        횟수부족
                      </div>
                    )}
                </div>

                <div
                  style={{
                    marginTop: 8,
                    color: "#aaa",
                  }}
                >
                  {data.member.branch_name} / {data.member.phone}
                </div>

                <div
                  style={{
                    marginTop: 20,
                    display: "grid",
                    gridTemplateColumns: "repeat(4,1fr)",
                    gap: 12,
                  }}
                >
                  <Info label="회원번호" value={data.member.member_no || "-"} />
                  <Info label="출석번호" value={data.member.checkin_code || "-"} />
                  <Info label="락카번호" value={data.member.locker_no || "-"} />
                  <Info label="담당자" value={data.member.staff_name || "-"} />
                  <Info label="성별" value={data.member.gender || "-"} />
                  <Info label="생년월일" value={data.member.birth_date?.slice(0, 10) || "-"} />
                  <Info label="비상연락처" value={data.member.emergency_contact || "-"} />
                  <Info label="가입일" value={data.member.join_date?.slice(0, 10) || "-"} />
                </div>
              </div>

              <div
                style={{
                  background:
                    "var(--panel2)",
                  borderRadius: 18,
                  padding:
                    "14px 20px",
                }}
              >
                <div
                  style={{
                    color:
                      "#aaa",
                    fontSize: 13,
                  }}
                >
                  회원권
                </div>

                <div
                  style={{
                    marginTop: 6,
                    fontWeight: 900,
                    fontSize: 22,
                  }}
                >
                  {
                    data.member
                      .product_name
                  }
                </div>
              </div>
            </div>
          </div>

          <div
            className="card"
            style={{
              borderRadius: 18,
              marginBottom: 18,
              padding: 12,
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            {[
              ["INFO", "기본정보"],
              ["PAY", "결제내역"],
              ["ATT", "출석기록"],
              ["NOTE", "상담/메모"],
              ["FILE", "입관서/파일"],
              ["HISTORY", "변경이력"],
            ].map(([key, label]) => (
              <button
                key={key}
                className={tab === key ? "btn" : "btn secondary"}
                onClick={() => setTab(key)}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "FILE" && (
            <div
              className="card"
              style={{
                borderRadius: 24,
                marginBottom: 18,
              }}
            >
              <h2
                style={{
                  marginTop: 0,
                }}
              >
                입관서 / 회원자료
              </h2>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "160px 1fr auto",
                  gap: 12,
                  marginBottom: 18,
                }}
              >
                <select
                  className="input"
                  value={
                    fileForm.file_type
                  }
                  onChange={(e) =>
                    setFileForm({
                      ...fileForm,
                      file_type:
                        e.target
                          .value,
                    })
                  }
                >
                  <option>
                    입관서
                  </option>

                  <option>
                    개인정보동의서
                  </option>

                  <option>
                    인바디
                  </option>

                  <option>
                    회원사진
                  </option>

                  <option>
                    기타
                  </option>
                </select>

                <input
                  className="input"
                  placeholder="메모"
                  value={
                    fileForm.memo
                  }
                  onChange={(e) =>
                    setFileForm({
                      ...fileForm,
                      memo:
                        e.target
                          .value,
                    })
                  }
                />

                <label
                  className="btn"
                  style={{
                    cursor:
                      "pointer",
                  }}
                >
                  {uploading
                    ? "업로드중..."
                    : "사진 업로드"}

                  <input
                    type="file"
                    accept="image/*,.pdf"
                    hidden
                    onChange={
                      uploadFile
                    }
                  />
                </label>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fill,minmax(220px,1fr))",
                  gap: 14,
                }}
              >
                {files.map((f) => (
                  <a
                    key={f.file_id}
                    href={f.file_url}
                    target="_blank"
                    style={{
                      background:
                        "var(--panel2)",
                      borderRadius: 18,
                      padding: 14,
                      textDecoration:
                        "none",
                      color: "var(--text)",
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 900,
                        fontSize: 18,
                      }}
                    >
                      {
                        f.file_type
                      }
                    </div>

                    <div
                      style={{
                        marginTop: 8,
                        color:
                          "#888",
                        fontSize: 13,
                      }}
                    >
                      {
                        f.file_name
                      }
                    </div>

                    <div
                      style={{
                        marginTop: 10,
                        color:
                          "#aaa",
                        fontSize: 13,
                        whiteSpace:
                          "pre-wrap",
                      }}
                    >
                      {f.memo}
                    </div>
                  </a>
                ))}

                {files.length ===
                  0 && (
                  <div
                    style={{
                      color:
                        "#888",
                    }}
                  >
                    업로드된 파일이
                    없습니다.
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === "ATT" && (
            <div
              className="card"
              style={{
                borderRadius: 24,
                marginBottom: 18,
              }}
            >
              <h2
                style={{
                  marginTop: 0,
                }}
              >
                최근 출석 기록
              </h2>

              <div
                style={{
                  display: "grid",
                  gap: 10,
                }}
              >
                {checkins.map((c) => (
                  <div
                    key={c.attendance_id}
                    style={{
                      background: "var(--panel2)",
                      borderRadius: 16,
                      padding: 14,
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 900,
                      }}
                    >
                      {new Date(
                        c.checkin_time
                      ).toLocaleString()}
                    </div>

                    <div
                      style={{
                        marginTop: 6,
                        color: "#888",
                        fontSize: 13,
                      }}
                    >
                      {c.result === "CHECK_OUT" ? "운동 종료" : "출석 완료"}
                      
                    </div>
                  </div>
                ))}

                {checkins.length ===
                  0 && (
                  <div
                    style={{
                      color: "#888",
                    }}
                  >
                    출석 기록이
                    없습니다.
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === "PAY" && (
            <div
              className="card"
              style={{
                borderRadius: 24,
                marginBottom: 18,
              }}
            >
              <h2 style={{ marginTop: 0 }}>
                결제내역
              </h2>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "120px 1fr 120px 120px",
                  gap: 12,
                  padding: "10px 12px",
                  color: "#888",
                  fontWeight: 700,
                  borderBottom:
                    "1px solid #374151",
                }}
              >
                <div>결제일</div>
                <div>상품</div>
                <div>금액</div>
                <div>수단</div>
              </div>

              <div
                style={{
                  display: "grid",
                  gap: 8,
                  marginTop: 10,
                }}
              >
                {payments.map((p) => (
                  <div
                    key={p.payment_id}
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "120px 1fr 120px 120px",
                      gap: 12,
                      background: "var(--panel2)",
                      borderRadius: 12,
                      padding: 12,
                      alignItems: "center",
                    }}
                  >
                    <div>
                      {p.payment_date?.slice(
                        0,
                        10
                      )}
                    </div>

                    <div>
                      {p.product_name ||
                        "-"}
                    </div>

                    <div
                      style={{
                        fontWeight: 900,
                      }}
                    >
                      {money(
                        p.final_amount
                      )}
                    </div>

                    <div>
                      {
                        p.payment_method
                      }
                    </div>
                  </div>
                ))}

                {payments.length ===
                  0 && (
                  <div
                    style={{
                      color: "#888",
                    }}
                  >
                    결제내역이
                    없습니다.
                  </div>
                )}
              </div>
            </div>
          )}
          {tab === "NOTE" && (
            <div
              className="card"
              style={{
                borderRadius: 24,
                marginBottom: 18,
              }}
            >
              <h2 style={{ marginTop: 0 }}>
                상담 / 메모
              </h2>

              <textarea
                className="input"
                value={memo}
                onChange={(e) =>
                  setMemo(e.target.value)
                }
                placeholder="회원 메모"
                style={{
                  width: "100%",
                  minHeight: 100,
                }}
              />

              <button
                className="btn"
                onClick={saveMemo}
                style={{
                  marginTop: 10,
                }}
              >
                메모 저장
              </button>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "160px 1fr auto",
                  gap: 12,
                  marginTop: 20,
                }}
              >
                <select
                  className="input"
                  value={
                    noteForm.note_type
                  }
                  onChange={(e) =>
                    setNoteForm({
                      ...noteForm,
                      note_type:
                        e.target.value,
                    })
                  }
                >
                  <option>
                    상담
                  </option>

                  <option>
                    문의
                  </option>

                  <option>
                    주의사항
                  </option>

                  <option>
                    기타
                  </option>
                </select>

                <input
                  className="input"
                  placeholder="상담 내용 입력"
                  value={
                    noteForm.content
                  }
                  onChange={(e) =>
                    setNoteForm({
                      ...noteForm,
                      content:
                        e.target.value,
                    })
                  }
                />

                <button
                  className="btn"
                  onClick={addNote}
                >
                  추가
                </button>
              </div>

              <div
                style={{
                  display: "grid",
                  gap: 8,
                  marginTop: 18,
                }}
              >
                {notes.map((n) => (
                  <div
                    key={n.note_id}
                    style={{
                      background:
                        "var(--panel2)",
                      borderRadius: 12,
                      padding: 12,
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 900,
                      }}
                    >
                      {n.note_type}
                    </div>

                    <div
                      style={{
                        marginTop: 6,
                        whiteSpace:
                          "pre-wrap",
                      }}
                    >
                      {n.content}
                    </div>

                    <div
                      style={{
                        marginTop: 6,
                        color: "#666",
                        fontSize: 12,
                      }}
                    >
                      {n.created_at
                        ? new Date(
                            n.created_at
                          ).toLocaleString()
                        : ""}
                    </div>
                  </div>
                ))}

                {notes.length ===
                  0 && (
                  <div
                    style={{
                      color: "#888",
                    }}
                  >
                    상담기록이
                    없습니다.
                  </div>
                )}
              </div>
            </div>
          )}
          {tab === "INFO" && (
            <div
              className="card"
              style={{
                borderRadius: 24,
                marginBottom: 18,
              }}
            >
              <h2 style={{ marginTop: 0 }}>
                기본정보
              </h2>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(4,1fr)",
                  gap: 12,
                }}
              >
                <Info
                  label="지점"
                  value={
                    data.member
                      .branch_name || "-"
                  }
                />

                <Info
                  label="회원명"
                  value={
                    data.member.name ||
                    "-"
                  }
                />

                <Info
                  label="전화번호"
                  value={
                    data.member.phone ||
                    "-"
                  }
                />

                <Info
                  label="비상연락처"
                  value={
                    data.member
                      .emergency_contact ||
                    "-"
                  }
                />

                <Info
                  label="회원번호"
                  value={
                    data.member
                      .member_no || "-"
                  }
                />

                <Info
                  label="출석번호"
                  value={
                    data.member
                      .checkin_code ||
                    "-"
                  }
                />

                <Info
                  label="락카번호"
                  value={
                    data.member
                      .locker_no || "-"
                  }
                />

                <Info
                  label="담당자"
                  value={
                    data.member
                      .staff_name || "-"
                  }
                />

                <Info
                  label="성별"
                  value={
                    data.member.gender ||
                    "-"
                  }
                />

                <Info
                  label="생년월일"
                  value={
                    data.member.birth_date?.slice(
                      0,
                      10
                    ) || "-"
                  }
                />

                <Info
                  label="가입일"
                  value={
                    data.member.join_date?.slice(
                      0,
                      10
                    ) || "-"
                  }
                />

                <Info
                  label="상태"
                  value={
                    data.member.status ||
                    "-"
                  }
                />
              </div>
            </div>
          )}

          {tab === "HISTORY" && (
            <div
              className="card"
              style={{
                borderRadius: 24,
                marginBottom: 18,
              }}
            >
              <h2 style={{ marginTop: 0 }}>
                변경이력
              </h2>

              <div
                style={{
                  display: "grid",
                  gap: 10,
                }}
              >
                {histories.map((h) => (
                  <div
                    key={h.history_id}
                    style={{
                      background: "var(--panel2)",
                      borderRadius: 14,
                      padding: 14,
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 900,
                        fontSize: 15,
                      }}
                    >
                      {h.history_type ||
                        h.action_type ||
                        "변경"}
                    </div>

                    <div
                      style={{
                        marginTop: 6,
                        color: "#aaa",
                        whiteSpace:
                          "pre-wrap",
                      }}
                    >
                      {h.memo ||
                        h.action_memo ||
                        "-"}
                    </div>

                    <div
                      style={{
                        marginTop: 8,
                        color: "#666",
                        fontSize: 12,
                      }}
                    >
                      {h.created_at
                        ? new Date(
                            h.created_at
                          ).toLocaleString()
                        : ""}
                    </div>
                  </div>
                ))}

                {histories.length ===
                  0 && (
                  <div
                    style={{
                      color: "#888",
                    }}
                  >
                    변경이력이
                    없습니다.
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}
function Info({
  label,
  value,
}: {
  label: string;
  value: any;
}) {
  return (
    <div
      style={{
        background: "var(--panel2)",
        borderRadius: 8,
        padding: "8px 10px",
        minHeight: 42,
      }}
    >
      <div style={{ color: "#888", fontSize: 12 }}>{label}</div>
      <div style={{ marginTop: 3, fontWeight: 800, fontSize: 13 }}>{value}</div>
    </div>
  );
}