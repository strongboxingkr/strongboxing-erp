"use client";

import { TrendingUp } from "lucide-react";

const STATS = [
  { label: "이번달 매출",   value: "3,240",  unit: "만원", accent: "#EF3B2D" },
  { label: "신규 등록",    value: "58",     unit: "명",   accent: "#3B82F6" },
  { label: "광고비",        value: "128",    unit: "만원", accent: "#F59E0B" },
  { label: "예상 순이익",  value: "1,860",  unit: "만원", accent: "#10B981" },
];

const BRANCH_SALES = [
  { name: "신정",   amount: 720,  color: "#10B981" },
  { name: "개봉",   amount: 680,  color: "#3B82F6" },
  { name: "철산",   amount: 630,  color: "#EF3B2D" },
  { name: "영등포", amount: 620,  color: "#F59E0B" },
  { name: "목동",   amount: 590,  color: "#8B5CF6" },
];

const COSTS = [
  { label: "광고비",      amount: "128만원", color: "#EF3B2D" },
  { label: "임대료",      amount: "350만원", color: "#3B82F6" },
  { label: "인건비",      amount: "420만원", color: "#8B5CF6" },
  { label: "비품",        amount: "24만원",  color: "#10B981" },
  { label: "수리/시설",  amount: "18만원",  color: "#F59E0B" },
  { label: "기타",        amount: "12만원",  color: "#9CA3AF" },
];

const PAYMENTS = [
  { name: "김○○", branch: "목동",   product: "자유 3개월",    amount: "57만원", method: "카드",  date: "07.02" },
  { name: "이○○", branch: "철산",   product: "주3회 1개월",   amount: "20만원", method: "계좌",  date: "07.01" },
  { name: "박○○", branch: "개봉",   product: "자유 1개월",    amount: "20만원", method: "카드",  date: "07.01" },
  { name: "최○○", branch: "신정",   product: "자유 6개월",    amount: "미정",   method: "카드",  date: "06.30" },
  { name: "정○○", branch: "영등포", product: "자유 3개월",    amount: "미정",   method: "계좌",  date: "06.30" },
  { name: "강○○", branch: "목동",   product: "주2회 3개월",   amount: "48만원", method: "카드",  date: "06.29" },
  { name: "조○○", branch: "철산",   product: "자유 1개월",    amount: "22만원", method: "현금",  date: "06.29" },
];

const BRANCH_COLOR: Record<string, string> = {
  목동: "#8B5CF6", 신정: "#10B981", 개봉: "#3B82F6", 철산: "#EF3B2D", 영등포: "#F59E0B",
};

const METHOD_STYLE: Record<string, { bg: string; color: string }> = {
  카드: { bg: "#EFF6FF", color: "#3B82F6" },
  계좌: { bg: "#F0FDF4", color: "#059669" },
  현금: { bg: "#FFFBEB", color: "#D97706" },
};

const cardStyle = { background: "#FFFFFF", border: "1px solid #E5E7EB", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" } as const;

const maxSale = Math.max(...BRANCH_SALES.map((b) => b.amount));

export default function FinancePage() {
  return (
    <div className="max-w-[1360px] mx-auto space-y-6">
      <div>
        <h1 className="text-[20px] font-black tracking-tight" style={{ color: "#111827" }}>매출관리</h1>
        <p className="mt-0.5 text-[13px]" style={{ color: "#6B7280" }}>지점별 매출, 광고비, 지출을 확인합니다.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {STATS.map((s) => (
          <div key={s.label} className="rounded-2xl border px-5 py-4 transition-all duration-200 hover:shadow-md" style={cardStyle}>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: "#9CA3AF" }}>{s.label}</p>
            <div className="flex items-end gap-1">
              <span className="text-[28px] font-black leading-none" style={{ color: "#111827" }}>{s.value}</span>
              <span className="text-[13px] font-semibold mb-0.5" style={{ color: "#6B7280" }}>{s.unit}</span>
            </div>
            <div className="mt-3 h-[2px] w-6 rounded-full" style={{ background: s.accent }} />
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* 지점별 매출 */}
        <div className="rounded-2xl p-5 transition-all duration-200 hover:shadow-md" style={cardStyle}>
          <p className="text-[14px] font-bold mb-5" style={{ color: "#111827" }}>지점별 매출</p>
          <div className="space-y-4">
            {BRANCH_SALES.map((b) => (
              <div key={b.name}>
                <div className="flex justify-between mb-1.5">
                  <span className="text-[13px] font-semibold" style={{ color: "#374151" }}>{b.name}점</span>
                  <span className="text-[13px] font-black" style={{ color: "#111827" }}>{b.amount.toLocaleString()}만원</span>
                </div>
                <div className="h-2 rounded-full" style={{ background: "#F3F4F6" }}>
                  <div className="h-2 rounded-full transition-all duration-500"
                    style={{ width: `${(b.amount / maxSale) * 100}%`, background: b.color }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-[11px]" style={{ color: "#9CA3AF" }}>
            <TrendingUp size={12} color="#10B981" />
            <span style={{ color: "#10B981", fontWeight: 600 }}>신정점</span>이 이번달 1위입니다.
          </div>
        </div>

        {/* 비용 내역 */}
        <div className="rounded-2xl p-5 transition-all duration-200 hover:shadow-md" style={cardStyle}>
          <p className="text-[14px] font-bold mb-5" style={{ color: "#111827" }}>비용 내역</p>
          <div className="space-y-3">
            {COSTS.map((c) => (
              <div key={c.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: c.color }} />
                  <span className="text-[13px]" style={{ color: "#374151" }}>{c.label}</span>
                </div>
                <span className="text-[13px] font-bold" style={{ color: "#111827" }}>{c.amount}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3" style={{ borderTop: "1px solid #F3F4F6" }}>
            <div className="flex justify-between">
              <span className="text-[13px] font-semibold" style={{ color: "#6B7280" }}>총 비용</span>
              <span className="text-[14px] font-black" style={{ color: "#EF3B2D" }}>952만원</span>
            </div>
          </div>
        </div>
      </div>

      {/* 최근 결제 */}
      <div className="rounded-2xl p-5 transition-all duration-200 hover:shadow-md" style={cardStyle}>
        <p className="text-[14px] font-bold mb-4" style={{ color: "#111827" }}>최근 결제</p>
        <div className="space-y-2">
          {PAYMENTS.map((p, i) => {
            const ms = METHOD_STYLE[p.method] ?? { bg: "#F9FAFB", color: "#6B7280" };
            return (
              <div key={i} className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                style={{ background: "#F9FAFB", border: "1px solid #F3F4F6" }}>
                <div className="h-7 w-7 rounded-full flex items-center justify-center text-white text-[11px] font-black shrink-0"
                  style={{ background: BRANCH_COLOR[p.branch] ?? "#6B7280" }}>{p.name[0]}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold" style={{ color: "#111827" }}>{p.name}</p>
                  <p className="text-[11px]" style={{ color: "#9CA3AF" }}>{p.product}</p>
                </div>
                <span className="text-[10px] font-semibold rounded-md px-2 py-0.5 shrink-0"
                  style={{ background: `${BRANCH_COLOR[p.branch] ?? "#6B7280"}14`, color: BRANCH_COLOR[p.branch] ?? "#6B7280" }}>
                  {p.branch}
                </span>
                <span className="text-[13px] font-black shrink-0" style={{ color: "#111827" }}>{p.amount}</span>
                <span className="text-[10px] font-semibold rounded-md px-2 py-0.5 shrink-0"
                  style={{ background: ms.bg, color: ms.color }}>{p.method}</span>
                <span className="text-[11px] shrink-0" style={{ color: "#9CA3AF" }}>{p.date}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
