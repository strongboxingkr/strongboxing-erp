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
                  gap: 10,
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

                {data.member.status ===
                  "REST" && (
                  <div
                    style={{
                      background:
                        "rgba(245,158,11,.15)",
                      color: "#f59e0b",
                      padding:
                        "6px 12px",
                      borderRadius: 999,
                      fontSize: 13,
                      fontWeight: 900,
                    }}
                  >
                    휴회중
                  </div>
                    )}

                    {data.member.status ===
                      "EXPIRED" && (
                      <div
                        style={{
                          background:
                            "rgba(239,68,68,.15)",
                          color: "#ef4444",
                          padding:
                            "6px 12px",
                          borderRadius: 999,
                          fontSize: 13,
                          fontWeight: 900,
                        }}
                      >
                        만료
                      </div>
                  )}

                  {Number(
                    data.member.remaining_count || 0
                  ) > 0 &&
                    Number(
                      data.member.remaining_count
                    ) <= 3 && (
                      <div
                        style={{
                          background:
                            "rgba(255,77,109,.15)",
                          color: "#ff4d6d",
                          padding:
                            "6px 12px",
                          borderRadius:
                            999,
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
                  {
                    data.member.branch_name
                  }{" "}
                  /{" "}
                  {
                    data.member.phone
                  }
                </div>
              </div>

              <div
                style={{
                  background:
                    "#111827",
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
                      "#111827",
                    borderRadius: 18,
                    padding: 14,
                    textDecoration:
                      "none",
                    color: "white",
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
                    background: "#111827",
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
                    출석 완료
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
        </>
      )}
    </AppShell>
  );
}