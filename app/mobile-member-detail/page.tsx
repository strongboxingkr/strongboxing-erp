"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

const today = new Date().toISOString().slice(0, 10);

function addMonths(dateString: string, months: number) {
  const date = new Date(dateString || today);
  date.setMonth(date.getMonth() + months);
  return date.toISOString().slice(0, 10);
}

export default function MobileMemberDetailPage() {
  const [memberId, setMemberId] = useState("");
  const [data, setData] = useState<any>(null);
  const [memo, setMemo] = useState("");
  const [notes, setNotes] = useState<any[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [checkins, setCheckins] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);

  const [noteForm, setNoteForm] = useState({
    note_type: "상담",
    content: "",
  });

  const [fileForm, setFileForm] = useState({
    file_type: "입관서",
    memo: "",
  });

  const loadNotes = async (id: string) => {
    const res = await apiFetch(`/api/member-notes?member_id=${id}`);
    const json = await res.json();
    setNotes(json.rows || []);
  };

  const loadFiles = async (id: string) => {
    const res = await apiFetch(`/api/member-files?member_id=${id}`);
    const json = await res.json();
    setFiles(json.rows || []);
  };

  const loadCheckins = async (id: string) => {
    const res = await apiFetch(`/api/checkins/member?member_id=${id}`);
    const json = await res.json();
    setCheckins(json.rows || []);
  };

  const load = async (id = memberId) => {
    if (!id) return;

    const res = await apiFetch(`/api/members/detail?member_id=${id}`);
    const json = await res.json();

    if (json.success) {
      setData(json);
      setMemo(json.member.memo || "");
      loadNotes(id);
      loadFiles(id);
      loadCheckins(id);
    } else {
      alert(json.message || "조회 실패");
    }
  };

  const saveMemo = async () => {
    if (!data?.member?.member_id) return;

    const res = await apiFetch("/api/members/update-memo", {
      method: "POST",
      body: JSON.stringify({
        member_id: data.member.member_id,
        memo,
      }),
    });

    const json = await res.json();

    if (json.success) {
      alert("메모 저장 완료!");
      load();
    } else {
      alert(json.message || "메모 저장 실패");
    }
  };

  const addNote = async () => {
    if (!data?.member?.member_id) return;

    if (!noteForm.content.trim()) {
      alert("상담 내용을 입력해주세요.");
      return;
    }

    const res = await apiFetch("/api/member-notes/add", {
      method: "POST",
      body: JSON.stringify({
        member_id: data.member.member_id,
        note_type: noteForm.note_type,
        content: noteForm.content,
      }),
    });

    const json = await res.json();

    if (json.success) {
      setNoteForm({
        note_type: "상담",
        content: "",
      });

      loadNotes(String(data.member.member_id));
    } else {
      alert(json.message || "상담 기록 추가 실패");
    }
  };

  const uploadFile = async (e: any) => {
    const file = e.target.files?.[0];

    if (!file || !data?.member?.member_id) return;

    setUploading(true);

    try {
      const formData = new FormData();

      formData.append("file", file);
      formData.append("member_id", data.member.member_id);
      formData.append("file_type", fileForm.file_type);
      formData.append("memo", fileForm.memo);

      const res = await fetch("/api/member-files/upload", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();

      if (json.success) {
        alert("파일 업로드 완료!");

        setFileForm({
          file_type: "입관서",
          memo: "",
        });

        loadFiles(String(data.member.member_id));
      } else {
        alert(json.message || "업로드 실패");
      }
    } finally {
      setUploading(false);
    }
  };

  const extendOneMonth = async () => {
    if (!data?.member) return;

    const m = data.member;

    const nextEndDate =
      m.pass_type === "PERIOD"
        ? addMonths(m.end_date?.slice(0, 10) || today, 1)
        : m.end_date?.slice(0, 10);

    const nextCount =
      m.pass_type === "COUNT"
        ? Number(m.remaining_count || 0) + 1
        : m.remaining_count;

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
      load();
    } else {
      alert(json.message || "연장 실패");
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("member_id");

    if (id) {
      setMemberId(id);
      load(id);
    }
  }, []);

  if (!data) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#08090d",
          color: "white",
          padding: 20,
        }}
      >
        로딩중...
      </div>
    );
  }

  const member = data.member;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#08090d",
        color: "white",
        padding: "18px 18px 90px",
      }}
    >
      <div style={{ marginBottom: 18 }}>
        <Link
          href="/mobile-members"
          style={{
            color: "#2ee59d",
            textDecoration: "none",
            fontWeight: 900,
          }}
        >
          ← 회원목록
        </Link>
      </div>

      <div
        className="card"
        style={{
          borderRadius: 28,
          marginBottom: 16,
          background:
            "linear-gradient(135deg, rgba(46,229,157,0.18), rgba(17,24,39,1))",
        }}
      >
        <div style={{ fontSize: 34, fontWeight: 900 }}>
          {member.name}
        </div>

        <div style={{ color: "#aaa", marginTop: 8 }}>
          {member.branch_name} / {member.phone}
        </div>

        <div
          style={{
            marginTop: 16,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
          }}
        >
          <Info label="회원권" value={member.product_name || "-"} />
          <Info
            label="만료/횟수"
            value={
              member.pass_type === "COUNT"
                ? `${member.remaining_count || 0}회`
                : member.end_date?.slice(0, 10)
            }
          />
          <Info label="출석번호" value={`#${member.checkin_code || "-"}`} />
          <Info label="상태" value={member.status || "ACTIVE"} />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
            marginTop: 16,
          }}
        >
          <button className="btn" onClick={extendOneMonth}>
            +1 연장
          </button>

          <button
            className="btn secondary"
            onClick={() => {
              window.location.href = `/mobile-payments?member_id=${member.member_id}`;
            }}
          >
            결제등록
          </button>
        </div>
      </div>

      <div className="card" style={{ borderRadius: 24, marginBottom: 16 }}>
        <h2 style={{ marginTop: 0 }}>메모</h2>

        <textarea
          className="input"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          style={{ minHeight: 100, marginBottom: 10 }}
        />

        <button className="btn" onClick={saveMemo} style={{ width: "100%" }}>
          메모 저장
        </button>
      </div>

      <div className="card" style={{ borderRadius: 24, marginBottom: 16 }}>
        <h2 style={{ marginTop: 0 }}>상담 기록</h2>

        <select
          className="input"
          value={noteForm.note_type}
          onChange={(e) =>
            setNoteForm({ ...noteForm, note_type: e.target.value })
          }
          style={{ marginBottom: 10 }}
        >
          <option>상담</option>
          <option>재등록</option>
          <option>불만</option>
          <option>기타</option>
        </select>

        <textarea
          className="input"
          placeholder="상담 내용"
          value={noteForm.content}
          onChange={(e) =>
            setNoteForm({ ...noteForm, content: e.target.value })
          }
          style={{ minHeight: 90, marginBottom: 10 }}
        />

        <button className="btn" onClick={addNote} style={{ width: "100%" }}>
          상담 기록 추가
        </button>

        <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
          {notes.map((n) => (
            <div
              key={n.note_id}
              style={{
                background: "#111827",
                borderRadius: 16,
                padding: 14,
              }}
            >
              <div style={{ fontWeight: 900 }}>{n.note_type}</div>
              <div
                style={{
                  marginTop: 8,
                  color: "#aaa",
                  whiteSpace: "pre-wrap",
                }}
              >
                {n.content}
              </div>
            </div>
          ))}

          {notes.length === 0 && (
            <div style={{ color: "#888" }}>상담 기록이 없습니다.</div>
          )}
        </div>
      </div>

      <div className="card" style={{ borderRadius: 24, marginBottom: 16 }}>
        <h2 style={{ marginTop: 0 }}>입관서 / 파일</h2>

        <select
          className="input"
          value={fileForm.file_type}
          onChange={(e) =>
            setFileForm({ ...fileForm, file_type: e.target.value })
          }
          style={{ marginBottom: 10 }}
        >
          <option>입관서</option>
          <option>개인정보동의서</option>
          <option>인바디</option>
          <option>회원사진</option>
          <option>기타</option>
        </select>

        <input
          className="input"
          placeholder="파일 메모"
          value={fileForm.memo}
          onChange={(e) => setFileForm({ ...fileForm, memo: e.target.value })}
          style={{ marginBottom: 10 }}
        />

        <label
          className="btn"
          style={{
            display: "block",
            textAlign: "center",
            cursor: "pointer",
            marginBottom: 14,
          }}
        >
          {uploading ? "업로드중..." : "사진/파일 업로드"}
          <input
            type="file"
            accept="image/*,.pdf"
            hidden
            onChange={uploadFile}
          />
        </label>

        <div style={{ display: "grid", gap: 10 }}>
          {files.map((f) => (
            <a
              key={f.file_id}
              href={f.file_url}
              target="_blank"
              style={{
                background: "#111827",
                borderRadius: 16,
                padding: 14,
                color: "white",
                textDecoration: "none",
              }}
            >
              <div style={{ fontWeight: 900 }}>{f.file_type}</div>
              <div style={{ color: "#888", marginTop: 6, fontSize: 13 }}>
                {f.file_name}
              </div>
              {f.memo && (
                <div style={{ color: "#aaa", marginTop: 8, fontSize: 13 }}>
                  {f.memo}
                </div>
              )}
            </a>
          ))}

          {files.length === 0 && (
            <div style={{ color: "#888" }}>업로드된 파일이 없습니다.</div>
          )}
        </div>
      </div>

      <div className="card" style={{ borderRadius: 24 }}>
        <h2 style={{ marginTop: 0 }}>최근 출석</h2>

        <div style={{ display: "grid", gap: 10 }}>
          {checkins.map((c) => (
            <div
              key={c.attendance_id}
              style={{
                background: "#111827",
                borderRadius: 16,
                padding: 14,
              }}
            >
              <div style={{ fontWeight: 900 }}>
                {new Date(c.checkin_time).toLocaleString()}
              </div>
              <div style={{ color: "#888", marginTop: 6, fontSize: 13 }}>
                출석 완료
              </div>
            </div>
          ))}

          {checkins.length === 0 && (
            <div style={{ color: "#888" }}>출석 기록이 없습니다.</div>
          )}
        </div>
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
        <Link
          href="/mobile-members"
          style={{ ...tabStyle, color: "#2ee59d", fontWeight: 900 }}
        >
          회원
        </Link>
        <Link href="/mobile-attendance" style={tabStyle}>
          출석
        </Link>
        <Link href="/mobile-payments" style={tabStyle}>
          결제
        </Link>
        <Link href="/mobile-crm" style={tabStyle}>
          상담
        </Link>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: any }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.06)",
        borderRadius: 16,
        padding: 14,
      }}
    >
      <div style={{ color: "#aaa", fontSize: 12 }}>{label}</div>
      <div style={{ marginTop: 6, fontWeight: 900 }}>{value}</div>
    </div>
  );
}

const tabStyle = {
  textAlign: "center" as const,
  color: "white",
  textDecoration: "none",
  fontSize: 12,
};