"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

export default function TodoCard() {
  const [todos, setTodos] = useState<{ text: string; done: boolean }[]>([]);
  const [input, setInput] = useState("");

  function add() {
    if (!input.trim()) return;
    setTodos((p) => [...p, { text: input.trim(), done: false }]);
    setInput("");
  }

  function toggle(i: number) {
    setTodos((p) => p.map((x, j) => j === i ? { ...x, done: !x.done } : x));
  }

  return (
    <div>
      <div className="mb-4 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="할 일 추가..."
          className="flex-1 rounded-xl border px-3 py-2 text-sm outline-none placeholder:text-[#94A3B8]"
          style={{ background: "#0F1115", borderColor: "#2A313C", color: "#F8FAFC" }}
        />
        <button
          onClick={add}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-white transition-all hover:opacity-90 active:scale-95"
          style={{ background: "linear-gradient(135deg,#E53935,#FF6B35)" }}
        >
          <Plus size={14} />
        </button>
      </div>
      <ul className="space-y-2.5">
        {todos.map((t, i) => (
          <li key={i} className="flex items-center gap-3 cursor-pointer" onClick={() => toggle(i)}>
            <span
              className="flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] transition-colors"
              style={{
                borderColor: t.done ? "#10B981" : "#2A313C",
                background: t.done ? "rgba(16,185,129,0.2)" : "transparent",
                color: "#10B981",
              }}
            >
              {t.done && "✓"}
            </span>
            <span
              className="text-[13px]"
              style={{
                color: t.done ? "#94A3B8" : "#F8FAFC",
                textDecoration: t.done ? "line-through" : "none",
              }}
            >
              {t.text}
            </span>
          </li>
        ))}
        {todos.length === 0 && (
          <p className="text-[12px]" style={{ color: "#94A3B8" }}>할 일을 추가해보세요.</p>
        )}
      </ul>
    </div>
  );
}
