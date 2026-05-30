"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AlertsFloating from "@/components/AlertsFloating";

const menuGroups = [
  {
    title: "📊 홈",
    items: [
      ["대시보드", "/dashboard"],
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
    ],
  },
  {
    title: "📅 예약/상담",
    items: [
      ["통합 예약", "/calendar"],
      ["네이버 예약", "/naver-reservations"],
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
    </div>
  );
}