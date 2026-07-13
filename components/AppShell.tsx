"use client";

import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import AlertsFloating from "@/components/AlertsFloating";

const menuGroups = [
  {
    title: "📊 홈",
    items: [
      ["대시보드", "/dashboard"],
      ["관장 대시보드", "/director-dashboard"],
      ["대표 모바일", "/mobile-owner"],
      ["관장 모바일", "/mobile-branch"],
    ],
  },
  {
    title: "👥 회원",
    items: [
      ["회원관리", "/members"],
      ["회원 알림", "/member-alerts"],
      ["회원권 만료", "/member-expiring"],
      ["재등록 관리", "/renewal"],
      ["락커 관리", "/lockers"],
      ["기간 일괄 연장", "/bulk-extend"],
    ],
  },
  {
    title: "📅 예약/상담",
    items: [
      ["예약 등록", "/calendar"],
      ["네이버 예약", "/naver-reservations"],
      ["홈페이지 예약 관리", "/homepage-reservations"],
      ["예약 캘린더", "/naver-calendar"],
      ["상담 CRM", "/crm"],
      ["재연락 상담", "/crm-alerts"],
    ],
  },
  {
    title: "💰 결제/재무",
    items: [
      ["결제관리", "/payments"],
      ["재무", "/finance"],
      ["재무 요약", "/finance-summary"],
      ["일일 마감", "/daily-closing"],
    ],
  },
  {
    title: "🔔 문자/공지",
    items: [
      ["문자관리", "/sms"],
      ["공지사항", "/notice"],
      ["알림센터", "/alerts-center"],
    ],
  },
  {
    title: "🌐 홈페이지 관리",
    items: [
      ["대시보드", "/hq"],
      ["상담 템플릿", "/hq/consultation"],
      ["일정 관리", "/hq/calendar"],
      ["지점 관리", "/hq/branches"],
      ["직원 관리", "/hq/staff"],
      ["자산 관리", "/hq/assets"],
      ["콘텐츠 관리", "/hq/contents"],
      ["AI 콘텐츠", "/hq/ai-content"],
      ["설정", "/hq/settings"],
    ],
  },
  {
    title: "📈 마케팅",
    items: [
      ["광고성과 분석", "/hq/marketing-report"],
      ["마케팅 통계", "/hq/marketing"],
      ["애널리틱스", "/hq/analytics"],
      ["재무", "/hq/finance"],
    ],
  },
  {
    title: "⚙ 설정",
    items: [
      ["계정관리", "/users"],
      ["권한관리", "/permissions"],
      ["설정관리", "/settings"],
    ],
  },
];

export default function AppShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<any>(null);
  const [allowedPaths, setAllowedPaths] = useState<string[]>([]);
  const [checked, setChecked] = useState(false);
  const [openGroups, setOpenGroups] = useState<string[]>([]);
  const lastCheckinId = useRef<number>(0);
  const monitorWin = useRef<Window | null>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem("user");

    if (!savedUser) {
      location.href = "/login";
      return;
    }

    try {
      const parsedUser = JSON.parse(savedUser);
      setUser(parsedUser);
      loadPermissions(parsedUser.role);
    } catch (e) {
      localStorage.removeItem("user");
      location.href = "/login";
    }
  }, []);

  const loadPermissions = async (role: string) => {
    const res = await fetch("/api/permissions");
    const data = await res.json();

    const paths =
      data.rows
        ?.filter((r: any) => r.role === role && r.can_view === "Y")
        .map((r: any) => r.path) || [];

    setAllowedPaths(paths);

    const currentPath = window.location.pathname;

    const currentGroup = menuGroups.find((group) =>
      group.items.some((item) => item[1] === currentPath)
    );

    setOpenGroups(currentGroup ? [currentGroup.title] : ["📊 홈"]);

    if (!paths.includes(currentPath)) {
      alert("접근 권한이 없습니다.");
      location.href = paths.includes("/dashboard")
        ? "/dashboard"
        : paths.includes("/mobile-branch")
        ? "/mobile-branch"
        : "/login";
      return;
    }

    setChecked(true);
    startCheckinPolling();
  };

  const startCheckinPolling = () => {
    const poll = async () => {
      try {
        const res = await fetch("/api/recent-checkins");
        const data = await res.json();
        const newest = data.rows?.[0];
        if (newest && newest.attendance_id !== lastCheckinId.current) {
          if (lastCheckinId.current !== 0) {
            if (!monitorWin.current || monitorWin.current.closed) {
              monitorWin.current = window.open(
                "/attendance-monitor",
                "strong-monitor",
                "width=1400,height=900,menubar=no,toolbar=no,location=no,status=no"
              );
            }
          }
          lastCheckinId.current = newest.attendance_id;
        }
      } catch {}
    };
    poll();
    setInterval(poll, 8000);
  };

  const logout = () => {
    localStorage.removeItem("user");
    location.href = "/login";
  };

  const toggleGroup = (title: string) => {
    setOpenGroups((prev) =>
      prev.includes(title)
        ? prev.filter((g) => g !== title)
        : [...prev, title]
    );
  };

  if (!user || !checked) return null;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="logo">
          STRONG<span> ERP</span>
        </div>

        <div style={{ marginBottom: 20, color: "#aaa", fontSize: 13 }}>
          <div style={{ color: "white", fontWeight: 900 }}>{user.name}</div>
          <div>{user.role === "OWNER" ? "대표" : "관장"}</div>
          <div>{user.branch_name || "전체지점"}</div>
        </div>

        <nav className="nav">
          {menuGroups.map((group) => {
            const visibleItems = group.items.filter((m) =>
              allowedPaths.includes(m[1])
            );

            if (visibleItems.length === 0) return null;

            const opened = openGroups.includes(group.title);

            return (
              <div key={group.title}>
                <button
                  className="menu-group-btn"
                  onClick={() => toggleGroup(group.title)}
                >
                  <span>{group.title}</span>
                  <span>{opened ? "−" : "+"}</span>
                </button>

                {opened && (
                  <div className="submenu">
                    {visibleItems.map(([name, path]) => (
                      <Link href={path} key={path}>
                        {name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <button
          className="btn secondary"
          style={{ marginTop: 20, width: "100%" }}
          onClick={logout}
        >
          로그아웃
        </button>
      </aside>

      <main className="main">
        <div className="topbar">
          <div className="title">{title}</div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              className="btn secondary"
              onClick={() => {
                window.open(
                  "/attendance-monitor",
                  "strong-monitor",
                  "width=1400,height=900,menubar=no,toolbar=no,location=no,status=no"
                );
              }}
            >
              출석 모니터
            </button>

            <button
              className="btn"
              onClick={() => {
                window.open(
                  "/check-in",
                  "strong-kiosk",
                  "width=1280,height=900,menubar=no,toolbar=no,location=no,status=no"
                );
              }}
            >
              키오스크
            </button>

            <div className="badge">
              {user.role === "OWNER" ? "대표" : "관장"} /{" "}
              {user.branch_name || "전체지점"}
            </div>
          </div>
        </div>

        {children}
      </main>

      <AlertsFloating />

      <a
        href="https://strongboxing.kr/hq"
        target="_blank"
        rel="noopener noreferrer"
        title="홈페이지 관리"
        style={{
          position: "fixed",
          bottom: 28,
          right: 28,
          zIndex: 9000,
          width: 52,
          height: 52,
          borderRadius: "50%",
          background: "#D01E2E",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 16px rgba(208,30,46,0.35)",
          textDecoration: "none",
          fontSize: 22,
          transition: "transform .15s, box-shadow .15s",
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.transform = "scale(1.1)";
          (e.currentTarget as HTMLElement).style.boxShadow = "0 6px 20px rgba(208,30,46,0.5)";
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.transform = "scale(1)";
          (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 16px rgba(208,30,46,0.35)";
        }}
      >
        🏠
      </a>
    </div>
  );
}