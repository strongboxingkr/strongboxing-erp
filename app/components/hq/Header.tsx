"use client";

import { Search, Bell, Plus } from "lucide-react";

export default function HQHeader() {
  const today = new Date().toLocaleDateString("ko-KR", {
    month: "long", day: "numeric", weekday: "short",
  });

  return (
    <header
      className="flex h-[56px] shrink-0 items-center gap-3 px-6"
      style={{ background: "#FFFFFF", borderBottom: "1px solid #E5E7EB" }}
    >
      {/* Search */}
      <div
        className="flex items-center gap-2 h-8 rounded-lg border px-3 flex-1 max-w-xs"
        style={{ background: "#F9FAFB", borderColor: "#E5E7EB" }}
      >
        <Search size={13} color="#9CA3AF" />
        <input
          placeholder="검색..."
          className="bg-transparent text-[13px] outline-none flex-1 placeholder:text-[#9CA3AF]"
          style={{ color: "#111827" }}
        />
      </div>

      <div className="flex-1" />

      <span className="hidden lg:block text-[12px]" style={{ color: "#9CA3AF" }}>{today}</span>

      <button
        className="relative flex h-8 w-8 items-center justify-center rounded-lg border transition-colors hover:bg-gray-50"
        style={{ borderColor: "#E5E7EB" }}
      >
        <Bell size={14} color="#6B7280" />
        <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full" style={{ background: "#EF3B2D" }} />
      </button>

      <button
        className="flex items-center gap-1.5 h-8 rounded-lg px-3 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
        style={{ background: "#EF3B2D" }}
      >
        <Plus size={14} strokeWidth={2.5} />
        <span className="hidden sm:inline">콘텐츠 등록</span>
      </button>
    </header>
  );
}
