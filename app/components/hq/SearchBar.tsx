"use client";

import { Search } from "lucide-react";

export default function SearchBar({ placeholder = "검색..." }: { placeholder?: string }) {
  return (
    <div
      className="flex items-center gap-2 rounded-xl border px-3 py-2.5"
      style={{ background: "#181C22", borderColor: "#2A313C" }}
    >
      <Search size={14} color="#94A3B8" />
      <input
        type="search"
        placeholder={placeholder}
        className="flex-1 bg-transparent text-sm outline-none placeholder:text-[#94A3B8]"
        style={{ color: "#F8FAFC" }}
      />
    </div>
  );
}
