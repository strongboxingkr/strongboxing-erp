export interface NavItem {
  label: string;
  href: string;
  icon: string;
  description: string;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard",  href: "/hq",              icon: "▦",  description: "전체 현황" },
  { label: "지점관리",   href: "/hq/branches",     icon: "🏢", description: "5개 지점" },
  { label: "상담센터",   href: "/hq/consultation", icon: "💬", description: "예약 관리" },
  { label: "마케팅",     href: "/hq/marketing",    icon: "📣", description: "광고·SNS" },
  { label: "콘텐츠",     href: "/hq/contents",     icon: "✍️", description: "블로그·릴스" },
  { label: "직원센터",   href: "/hq/staff",        icon: "👥", description: "코치·직원" },
  { label: "매출관리",   href: "/hq/finance",      icon: "💰", description: "재무 현황" },
  { label: "일정관리",   href: "/hq/calendar",     icon: "📅", description: "캘린더" },
  { label: "자료실",     href: "/hq/assets",       icon: "📦", description: "파일·이미지" },
  { label: "분석",       href: "/hq/analytics",    icon: "📈", description: "데이터" },
  { label: "설정",       href: "/hq/settings",     icon: "⚙️", description: "시스템" },
];

export const QUICK_MENUS = NAV_ITEMS.filter((n) =>
  ["/hq/branches", "/hq/consultation", "/hq/marketing", "/hq/contents", "/hq/staff", "/hq/assets"].includes(n.href)
);
