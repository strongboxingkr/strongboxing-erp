"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Building2, MessageSquare,
  Megaphone, Clapperboard, Users, Archive, Settings, Sparkles,
  CalendarDays, BarChart2, TrendingUp,
} from "lucide-react";

const NAV = [
  { label: "대시보드",   href: "/hq",                      icon: LayoutDashboard },
  { label: "지점 관리",  href: "/hq/branches",              icon: Building2 },
  { label: "상담 센터",  href: "/hq/consultation",          icon: MessageSquare },
  { label: "콘텐츠",     href: "/hq/contents",              icon: Clapperboard },
  { label: "마케팅",     href: "/hq/marketing",             icon: Megaphone },
  { label: "광고성과",   href: "/hq/marketing-report",      icon: TrendingUp },
  { label: "AI 콘텐츠", href: "/hq/ai-content",            icon: Sparkles },
  { label: "일정관리",   href: "/hq/calendar",              icon: CalendarDays },
  { label: "분석",       href: "/hq/analytics",             icon: BarChart2 },
  { label: "직원센터",   href: "/hq/staff",                 icon: Users },
  { label: "자료실",     href: "/hq/assets",                icon: Archive },
  { label: "설정",       href: "/hq/settings",              icon: Settings },
];

export default function HQSidebar() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/hq" ? pathname === "/hq" : pathname.startsWith(href);

  return (
    <aside
      className="hidden md:flex flex-col h-screen w-[240px] shrink-0"
      style={{ background: "#FFFFFF", borderRight: "1px solid #E5E7EB" }}
    >
      {/* Logo */}
      <div className="px-6 py-6" style={{ borderBottom: "1px solid #E5E7EB" }}>
        <div className="flex items-center gap-2">
          <span className="text-[16px]">🥊</span>
          <span className="text-[14px] font-black tracking-tight" style={{ color: "#111827" }}>
            STRONG <span style={{ color: "#EF3B2D" }}>HQ</span>
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {NAV.map(({ label, href, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-150"
              style={{
                background: active ? "#FEF2F2" : "transparent",
                color: active ? "#EF3B2D" : "#6B7280",
              }}
            >
              <Icon size={16} strokeWidth={active ? 2.2 : 1.8} />
              <span className="text-[13px] font-semibold">{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4" style={{ borderTop: "1px solid #E5E7EB" }}>
        <p className="text-[11px]" style={{ color: "#6B7280" }}>5개 지점 운영 중</p>
        <p className="text-[10px] mt-0.5" style={{ color: "#9CA3AF" }}>개봉 · 신정 · 목동 · 철산 · 영등포</p>
      </div>
    </aside>
  );
}
