"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, LayoutDashboard, Building2, MessageSquare, Megaphone, Clapperboard, Users, Archive, Settings, Sparkles, CalendarDays, BarChart2, TrendingUp } from "lucide-react";

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

export default function HQMobileSidebar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/hq" ? pathname === "/hq" : pathname.startsWith(href);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="md:hidden flex h-8 w-8 items-center justify-center rounded-lg border"
        style={{ borderColor: "#E5E7EB" }}
      >
        <Menu size={16} color="#6B7280" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="w-[240px] flex flex-col h-full" style={{ background: "#FFFFFF", borderRight: "1px solid #E5E7EB" }}>
            <div className="flex items-center justify-between px-5 py-5" style={{ borderBottom: "1px solid #E5E7EB" }}>
              <div className="flex items-center gap-2">
                <span className="text-[17px]">🥊</span>
                <span className="text-[13px] font-black" style={{ color: "#111827" }}>STRONGBOXING HQ</span>
              </div>
              <button onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-gray-100">
                <X size={15} color="#6B7280" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
              {NAV.map(({ label, href, icon: Icon }) => {
                const active = isActive(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors"
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
          </div>
          <div className="flex-1 bg-black/30" onClick={() => setOpen(false)} />
        </div>
      )}
    </>
  );
}
