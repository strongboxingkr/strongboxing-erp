"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

export default function MobileAttendancePage() {
  const [code, setCode] = useState("");
  const [recent, setRecent] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const getUser = () => {
    try {
      const saved = localStorage.getItem("user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  };

  const loadRecent = async () => {
    const user = getUser();

    let url = "/api/checkins/recent";

    if (
      user?.role !== "OWNER" &&
      user?.role !== "ADMIN"
    ) {
      url += `?branch_name=${encodeURIComponent(
        user?.branch_name || ""
      )}`;
    }

    const res = await apiFetch(url);
    const json = await res.json();

    setRecent(json.rows || []);
  };

  const checkin = async () => {
    if (!code.trim()) {
      alert("출석번호 입력");
      return;
    }

    setLoading(true);

    try {
      const res = await apiFetch("/api/checkins/add", {
        method: "POST",
        body: JSON.stringify({
          checkin_code: code,
        }),
      });

      const json = await res.json();

      if (json.success) {
        alert("출석 완료!");
        setCode("");
        loadRecent();
      } else {
        alert(json.message || "출석 실패");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecent();
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        color: "var(--text)",
        padding: "18px 18px 90px",
      }}
    >
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 32, fontWeight: 900 }}>
          STRONG{" "}
          <span style={{ color: "#2ee59d" }}>
            CHECK-IN
          </span>
        </div>

        <div
          style={{
            marginTop: 6,
            color: "#888",
          }}
        >
          모바일 출석관리
        </div>
      </div>

      <div
        className="card"
        style={{
          borderRadius: 28,
          marginBottom: 18,
        }}
      >
        <div
          style={{
            fontSize: 22,
            fontWeight: 900,
            marginBottom: 12,
          }}
        >
          출석번호 입력
        </div>

        <input
          className="input"
          placeholder="4자리 출석번호"
          value={code}
          maxLength={4}
          onChange={(e) =>
            setCode(
              e.target.value
                .replace(/[^0-9]/g, "")
                .slice(0, 4)
            )
          }
          style={{
            textAlign: "center",
            fontSize: 28,
            fontWeight: 900,
            letterSpacing: 8,
            marginBottom: 14,
          }}
        />

        <button
          className="btn"
          onClick={checkin}
          style={{
            width: "100%",
            height: 58,
            fontSize: 20,
            fontWeight: 900,
          }}
        >
          {loading ? "처리중..." : "출석하기"}
        </button>
      </div>

      <div
        className="card"
        style={{
          borderRadius: 28,
        }}
      >
        <div
          style={{
            fontSize: 22,
            fontWeight: 900,
            marginBottom: 14,
          }}
        >
          최근 출석
        </div>

        <div
          style={{
            display: "grid",
            gap: 10,
          }}
        >
          {recent.map((r) => (
            <div
              key={r.attendance_id}
              style={{
                background: "var(--panel2)",
                borderRadius: 18,
                padding: 16,
              }}
            >
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 900,
                }}
              >
                <button
                onClick={() => {
                    window.location.href =
                    `/mobile-member-detail?id=${r.member_id}`;
                }}
                style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    color: "var(--text)",
                    fontSize: 22,
                    fontWeight: 900,
                }}
                >
                {r.name}
                </button>
              </div>

              <div
                style={{
                  marginTop: 6,
                  color: "#888",
                }}
              >
                {r.branch_name}
              </div>

              <div
                style={{
                  marginTop: 8,
                  color: "#2ee59d",
                  fontWeight: 900,
                }}
              >
                {new Date(
                  r.checkin_time
                ).toLocaleString()}
              </div>
            </div>
          ))}

          {recent.length === 0 && (
            <div style={{ color: "#888" }}>
              출석 기록이 없습니다.
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "var(--panel2)",
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

        <Link href="/mobile-members" style={tabStyle}>
        회원
        </Link>

        <Link
        href="/mobile-attendance"
        style={{
            ...tabStyle,
            color: "#2ee59d",
            fontWeight: 900,
        }}
        >
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

const tabStyle = {
  textAlign: "center" as const,
  color: "white",
  textDecoration: "none",
  fontSize: 12,
};