import Link from "next/link";
import { Building2, MessageSquare, Megaphone, Clapperboard, Users, Archive } from "lucide-react";

const ITEMS = [
  { label: "지점 관리", href: "/hq/branches",      icon: Building2,    color: "#3B82F6" },
  { label: "상담 센터", href: "/hq/consultations", icon: MessageSquare, color: "#10B981" },
  { label: "마케팅",    href: "/hq/marketing",     icon: Megaphone,    color: "#F59E0B" },
  { label: "콘텐츠",   href: "/hq/contents",      icon: Clapperboard, color: "#8B5CF6" },
  { label: "직원",     href: "/hq/staff",         icon: Users,        color: "#EC4899" },
  { label: "자료실",   href: "/hq/assets",        icon: Archive,      color: "#EF3B2D" },
];

export default function QuickMenu() {
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
      {ITEMS.map(({ label, href, icon: Icon, color }) => (
        <Link
          key={href}
          href={href}
          className="flex flex-col items-center justify-center gap-2 rounded-xl border text-center transition-all hover:shadow-sm hover:-translate-y-0.5"
          style={{
            background: "#FFFFFF",
            borderColor: "#E5E7EB",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            height: 96,
          }}
        >
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ background: `${color}12` }}
          >
            <Icon size={17} color={color} strokeWidth={1.8} />
          </div>
          <span className="text-[12px] font-semibold" style={{ color: "#374151" }}>{label}</span>
        </Link>
      ))}
    </div>
  );
}
