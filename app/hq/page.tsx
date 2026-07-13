"use client";

import { useEffect, useState, useCallback } from "react";
import StatsCard from "@/app/components/hq/StatsCard";
import QuickMenu from "@/app/components/hq/QuickMenu";
import { CheckCircle2, Circle } from "lucide-react";

const BC: Record<string, string> = {
  목동점: "#8B5CF6", 신정점: "#10B981", 개봉점: "#3B82F6", 철산점: "#EF3B2D", 영등포점: "#F59E0B",
};

const card = {
  background: "#FFFFFF",
  border: "1px solid #E5E7EB",
  borderRadius: 16,
  boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
};

interface Task {
  id: number; title: string; is_done: number;
  branch_name: string | null; assignee: string | null; due_date: string | null;
}
interface CalEvent {
  id: number; title: string; start_date: string;
  branch_name: string | null; event_type: string;
}
interface Content {
  id: number; title: string; status: string; branch_name: string | null;
}

export default function HQDashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [contents, setContents] = useState<Content[]>([]);
  const [branches, setBranches] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [tr, er, cr, br] = await Promise.all([
        fetch("/api/hq/staff-tasks").then(r => r.json()),
        fetch("/api/hq/calendar-events").then(r => r.json()),
        fetch("/api/hq/content-projects").then(r => r.json()),
        fetch("/api/hq/branches").then(r => r.json()),
      ]);
      setTasks(tr.data ?? []);
      setEvents(er.data ?? []);
      setContents(cr.data ?? []);
      setBranches(br.data ?? []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const today = new Date().toISOString().slice(0, 10);
  const todoTasks = tasks.filter(t => !t.is_done);
  const todayEvents = events.filter(e => e.start_date?.slice(0, 10) === today);
  const pendingContents = contents.filter(c => c.status !== "업로드완료");
  const uploadDoneToday = contents.filter(c => c.status === "업로드완료").length;

  const stats = [
    { label: "지점 수",     value: String(branches.length), unit: "개", sub: "운영 중인 지점", accent: "#EF3B2D" },
    { label: "미완료 업무", value: String(todoTasks.length), unit: "개", sub: "직원 할 일", accent: "#3B82F6" },
    { label: "오늘 일정",   value: String(todayEvents.length), unit: "개", sub: "오늘 예정 이벤트", accent: "#8B5CF6" },
    { label: "콘텐츠 대기", value: String(pendingContents.length), unit: "개", sub: `완료 ${uploadDoneToday}개`, accent: "#10B981" },
  ];

  // 오늘 + 이후 일정 최대 5개
  const upcomingEvents = [...events]
    .filter(e => e.start_date?.slice(0, 10) >= today)
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
    .slice(0, 5);

  // 미완료 업무 최대 5개 (기한 임박 우선)
  const urgentTasks = [...todoTasks]
    .sort((a, b) => {
      if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
      if (a.due_date) return -1;
      if (b.due_date) return 1;
      return 0;
    })
    .slice(0, 5);

  // 업로드 대기 콘텐츠 최대 5개
  const pendingTop = pendingContents.slice(0, 5);

  return (
    <div className="max-w-[1360px] mx-auto space-y-5">
      <div>
        <h1 className="text-[20px] font-black tracking-tight" style={{ color: "#111827" }}>
          안녕하세요, 대표님 👋
        </h1>
        <p className="mt-0.5 text-[13px]" style={{ color: "#6B7280" }}>
          오늘도 스트롱복싱을 성장시켜봅시다.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {stats.map((s) => <StatsCard key={s.label} {...s} />)}
      </div>

      <section>
        <p className="mb-2.5 text-[12px] font-medium tracking-[0.06em]" style={{ color: "#9CA3AF" }}>
          빠른 메뉴
        </p>
        <QuickMenu />
      </section>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-[13px]" style={{ color: "#9CA3AF" }}>불러오는 중…</p>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">

          {/* 미완료 업무 */}
          <div className="rounded-2xl p-5" style={card}>
            <div className="flex items-center justify-between mb-4">
              <p className="text-[13px] font-bold" style={{ color: "#111827" }}>미완료 업무</p>
              <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                style={{ background: "#FEF2F2", color: "#EF3B2D" }}>
                {todoTasks.length}건
              </span>
            </div>
            {urgentTasks.length === 0 ? (
              <p className="text-[13px] text-center py-6" style={{ color: "#9CA3AF" }}>모든 업무 완료! 🎉</p>
            ) : (
              <ul className="space-y-3">
                {urgentTasks.map(t => {
                  const isOverdue = t.due_date && t.due_date.slice(0, 10) < today;
                  return (
                    <li key={t.id} className="flex items-start gap-2.5">
                      <Circle size={16} color="#D1D5DB" strokeWidth={2} className="shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] truncate" style={{ color: "#374151" }}>{t.title}</p>
                        <div className="flex gap-2 mt-0.5 flex-wrap">
                          {t.branch_name && (
                            <span className="text-[10px] font-semibold" style={{ color: BC[t.branch_name] ?? "#9CA3AF" }}>
                              {t.branch_name}
                            </span>
                          )}
                          {t.due_date && (
                            <span className="text-[10px]" style={{ color: isOverdue ? "#EF3B2D" : "#9CA3AF" }}>
                              {isOverdue ? "⚠️ " : ""}{t.due_date.slice(0, 10)}
                            </span>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
                {todoTasks.length > 5 && (
                  <li className="text-[11px] text-center pt-1" style={{ color: "#9CA3AF" }}>
                    외 {todoTasks.length - 5}개 더 있음
                  </li>
                )}
              </ul>
            )}
          </div>

          {/* 다가오는 일정 */}
          <div className="rounded-2xl p-5" style={card}>
            <div className="flex items-center justify-between mb-4">
              <p className="text-[13px] font-bold" style={{ color: "#111827" }}>다가오는 일정</p>
              <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                style={{ background: "#EFF6FF", color: "#3B82F6" }}>
                {upcomingEvents.length}건
              </span>
            </div>
            {upcomingEvents.length === 0 ? (
              <p className="text-[13px] text-center py-6" style={{ color: "#9CA3AF" }}>예정된 일정이 없습니다.</p>
            ) : (
              <ul className="space-y-3">
                {upcomingEvents.map((e, i) => {
                  const bc = e.branch_name ? (BC[e.branch_name] ?? "#9CA3AF") : "#9CA3AF";
                  const isToday = e.start_date?.slice(0, 10) === today;
                  return (
                    <li key={e.id} className="flex items-start gap-3"
                      style={{ borderBottom: i < upcomingEvents.length - 1 ? "1px solid #F3F4F6" : "none", paddingBottom: i < upcomingEvents.length - 1 ? 12 : 0 }}>
                      <div className="shrink-0 text-center w-10">
                        <p className="text-[10px] font-bold" style={{ color: "#EF3B2D" }}>{e.start_date?.slice(5, 7)}월</p>
                        <p className="text-[18px] font-black leading-tight" style={{ color: "#111827" }}>{e.start_date?.slice(8, 10)}</p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] truncate" style={{ color: "#374151" }}>{e.title}</p>
                        <div className="flex gap-1.5 mt-0.5 flex-wrap">
                          {isToday && <span className="text-[10px] font-bold" style={{ color: "#EF3B2D" }}>오늘</span>}
                          {e.branch_name
                            ? <span className="text-[10px] font-semibold" style={{ color: bc }}>{e.branch_name}</span>
                            : <span className="text-[10px]" style={{ color: "#9CA3AF" }}>전체</span>}
                          <span className="text-[10px]" style={{ color: "#9CA3AF" }}>{e.event_type}</span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* 콘텐츠 현황 */}
          <div className="rounded-2xl p-5" style={card}>
            <div className="flex items-center justify-between mb-4">
              <p className="text-[13px] font-bold" style={{ color: "#111827" }}>콘텐츠 현황</p>
              <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                style={{ background: "#F0FDF4", color: "#059669" }}>
                완료 {uploadDoneToday}개
              </span>
            </div>
            {pendingTop.length === 0 ? (
              <p className="text-[13px] text-center py-6" style={{ color: "#9CA3AF" }}>대기 중인 콘텐츠 없음 🎉</p>
            ) : (
              <ul className="space-y-3">
                {pendingTop.map((c, i) => {
                  const bc = c.branch_name ? (BC[c.branch_name] ?? "#9CA3AF") : "#9CA3AF";
                  const statusColor: Record<string, string> = {
                    아이디어: "#9CA3AF", 촬영완료: "#3B82F6", 편집중: "#D97706", 업로드대기: "#EF3B2D",
                  };
                  return (
                    <li key={c.id} className="flex items-center gap-2.5"
                      style={{ borderBottom: i < pendingTop.length - 1 ? "1px solid #F3F4F6" : "none", paddingBottom: i < pendingTop.length - 1 ? 12 : 0 }}>
                      <span className="shrink-0 h-2 w-2 rounded-full" style={{ background: statusColor[c.status] ?? "#9CA3AF" }} />
                      <p className="flex-1 min-w-0 text-[13px] truncate" style={{ color: "#374151" }}>{c.title}</p>
                      {c.branch_name && (
                        <span className="shrink-0 text-[10px] font-semibold" style={{ color: bc }}>{c.branch_name}</span>
                      )}
                    </li>
                  );
                })}
                {pendingContents.length > 5 && (
                  <li className="text-[11px] text-center pt-1" style={{ color: "#9CA3AF" }}>
                    외 {pendingContents.length - 5}개 더 있음
                  </li>
                )}
              </ul>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
