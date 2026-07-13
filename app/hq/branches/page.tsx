"use client";

import { useEffect, useState } from "react";
import {
  Phone, Clock, AtSign, MapPin, ChevronDown, ChevronUp,
  MessageSquare, Clapperboard, ExternalLink, Plus, Pencil, Trash2, X, Save,
} from "lucide-react";

/* ── 타입 ─────────────────────────────────────────── */

interface BusinessHours { weekday: string; saturday: string; sunday: string }

interface Branch {
  id: number;
  name: string;
  slug: string;
  phone: string | null;
  address: string | null;
  instagram: string | null;
  kakao_map_url: string | null;
  naver_reservation_url: string | null;
  business_hours: BusinessHours | string | null;
  memo: string | null;
  is_active: number;
}

const BRANCH_COLORS: Record<string, string> = {
  gaebong:      "#8B5CF6",
  sinjeong:     "#10B981",
  mokdong:      "#3B82F6",
  cheolsan:     "#F59E0B",
  yeongdeungpo: "#EF3B2D",
};
const FALLBACK_COLORS = ["#6B7280", "#EC4899", "#14B8A6", "#F97316"];
function branchColor(slug: string, idx: number) {
  return BRANCH_COLORS[slug] ?? FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
}

const cardStyle = {
  background: "#FFFFFF",
  border: "1px solid #E5E7EB",
  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
} as const;

const EMPTY_FORM = {
  name: "", slug: "", phone: "", address: "", instagram: "",
  kakao_map_url: "", naver_reservation_url: "", memo: "",
  weekday: "", saturday: "", sunday: "",
};

/* ── 회비 더미 (DB 미연결) ─────────────────────────── */

type Fee = { name: string; items: { period: string; price: string }[] };
const FEES: Record<string, Fee[]> = {
  mokdong: [
    { name: "자유",  items: [{ period: "1개월", price: "21만원" }, { period: "3개월", price: "57만원" }] },
    { name: "주3회", items: [{ period: "1개월", price: "19만원" }, { period: "3개월", price: "52만원" }] },
    { name: "주2회", items: [{ period: "1개월", price: "17만원" }, { period: "3개월", price: "48만원" }] },
    { name: "주1회", items: [{ period: "1개월", price: "15만원" }, { period: "3개월", price: "43만원" }] },
  ],
  gaebong: [
    { name: "자유",  items: [{ period: "1개월", price: "20만원" }, { period: "3개월", price: "55만원" }, { period: "6개월", price: "100만원" }, { period: "1년", price: "190만원" }] },
    { name: "주3회", items: [{ period: "1개월", price: "18만원" }, { period: "3개월", price: "50만원" }] },
  ],
  cheolsan: [
    { name: "자유",  items: [{ period: "1개월", price: "22만원" }, { period: "3개월", price: "59만원" }] },
    { name: "주3회", items: [{ period: "1개월", price: "20만원" }, { period: "3개월", price: "55만원" }] },
  ],
};

/* ── 회비 섹션 ─────────────────────────────────────── */

function FeeSection({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  const fees = FEES[slug] ?? [];
  if (fees.length === 0)
    return <p className="text-[12px]" style={{ color: "#9CA3AF" }}>회비 정보를 입력해주세요.</p>;
  const preview = fees[0];
  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {preview.items.slice(0, 2).map((it) => (
            <span key={it.period} className="text-[12px]">
              <span style={{ color: "#9CA3AF" }}>{preview.name} {it.period}</span>
              <span className="ml-1 font-bold" style={{ color: "#111827" }}>{it.price}</span>
            </span>
          ))}
          {!open && <span className="text-[11px]" style={{ color: "#9CA3AF" }}>외 {fees.length - 1}개…</span>}
        </div>
        <button onClick={() => setOpen((p) => !p)}
          className="ml-2 flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold hover:bg-gray-100 shrink-0"
          style={{ color: "#6B7280" }}>
          {open ? <><ChevronUp size={12} />접기</> : <><ChevronDown size={12} />전체</>}
        </button>
      </div>
      {open && (
        <div className="mt-3 space-y-3">
          {fees.map((fee) => (
            <div key={fee.name}>
              <p className="text-[11px] font-semibold mb-1.5" style={{ color: "#9CA3AF" }}>{fee.name}</p>
              <div className="flex flex-wrap gap-2">
                {fee.items.map((it) => (
                  <div key={it.period} className="rounded-xl px-3 py-1.5 text-[12px]"
                    style={{ background: "#F9FAFB", border: "1px solid #F3F4F6" }}>
                    <span style={{ color: "#9CA3AF" }}>{it.period}</span>
                    <span className="ml-1.5 font-bold" style={{ color: "#111827" }}>{it.price}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── 지점 카드 ─────────────────────────────────────── */

function BranchCard({
  branch, color, onEdit, onDelete,
}: { branch: Branch; color: string; onEdit: (b: Branch) => void; onDelete: (b: Branch) => void }) {
  const hours: BusinessHours | null =
    typeof branch.business_hours === "string"
      ? JSON.parse(branch.business_hours)
      : branch.business_hours;

  return (
    <div className="rounded-2xl p-5 flex flex-col gap-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5" style={cardStyle}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl flex items-center justify-center text-white text-[14px] font-black shrink-0"
            style={{ background: color }}>{branch.name[0]}</div>
          <div>
            <p className="text-[16px] font-black tracking-tight" style={{ color: "#111827" }}>{branch.name}</p>
            <span className="inline-block rounded-md px-2 py-0.5 text-[10px] font-bold"
              style={{ background: `${color}14`, color }}>운영중</span>
          </div>
        </div>
        <div className="flex gap-1.5">
          <button onClick={() => onEdit(branch)}
            className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold hover:bg-gray-100 transition-colors"
            style={{ background: "#F3F4F6", color: "#6B7280" }}>
            <Pencil size={11} /> 수정
          </button>
          <button onClick={() => onDelete(branch)}
            className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-colors"
            style={{ background: "#FEF2F2", color: "#EF3B2D" }}>
            <Trash2 size={11} />
          </button>
        </div>
      </div>

      <div className="h-px" style={{ background: "#F3F4F6" }} />

      <div className="space-y-2.5">
        {branch.address && (
          <div className="flex gap-2.5">
            <MapPin size={13} color="#9CA3AF" className="mt-0.5 shrink-0" />
            <p className="text-[12px] leading-relaxed" style={{ color: "#374151" }}>{branch.address}</p>
          </div>
        )}
        {branch.phone && (
          <div className="flex gap-2.5 items-center">
            <Phone size={13} color="#9CA3AF" className="shrink-0" />
            <a href={`tel:${branch.phone}`} className="text-[12px] font-semibold hover:underline" style={{ color: "#374151" }}>{branch.phone}</a>
          </div>
        )}
        {hours && (
          <div className="flex gap-2.5">
            <Clock size={13} color="#9CA3AF" className="mt-0.5 shrink-0" />
            <div className="space-y-0.5">
              {hours.weekday && <p className="text-[12px]" style={{ color: "#374151" }}>월-금  {hours.weekday}</p>}
              {hours.saturday && <p className="text-[12px]" style={{ color: "#374151" }}>토      {hours.saturday}</p>}
              {hours.sunday && <p className="text-[12px]" style={{ color: "#374151" }}>일      {hours.sunday}</p>}
            </div>
          </div>
        )}
        {branch.instagram && (
          <div className="flex gap-2.5 items-center">
            <AtSign size={13} color="#9CA3AF" className="shrink-0" />
            <a href={`https://instagram.com/${branch.instagram}`} target="_blank" rel="noopener noreferrer"
              className="text-[12px] font-semibold hover:underline flex items-center gap-1" style={{ color: "#374151" }}>
              @{branch.instagram} <ExternalLink size={10} color="#9CA3AF" />
            </a>
          </div>
        )}
      </div>

      <div className="h-px" style={{ background: "#F3F4F6" }} />

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest mb-2" style={{ color: "#9CA3AF" }}>회비</p>
        <FeeSection slug={branch.slug} />
      </div>

      <div className="h-px" style={{ background: "#F3F4F6" }} />

      <div className="grid grid-cols-2 gap-2">
        <a href={branch.naver_reservation_url ?? "#"} target="_blank" rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 rounded-xl py-2 text-[12px] font-semibold hover:opacity-70 transition-opacity"
          style={{ background: "#03C75A18", color: "#03a84e", border: "1px solid #03C75A28" }}>
          <ExternalLink size={12} /> 네이버 예약
        </a>
        <a href={branch.kakao_map_url ?? "#"} target="_blank" rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 rounded-xl py-2 text-[12px] font-semibold hover:opacity-70 transition-opacity"
          style={{ background: "#FEE50018", color: "#a0720a", border: "1px solid #FEE50038" }}>
          <ExternalLink size={12} /> 카카오맵
        </a>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => alert("상담 페이지로 이동")}
          className="flex items-center justify-center gap-1.5 rounded-xl py-2 text-[12px] font-semibold hover:bg-gray-100 transition-colors"
          style={{ background: "#F3F4F6", color: "#374151" }}>
          <MessageSquare size={13} /> 상담 답변
        </button>
        <button onClick={() => alert("콘텐츠 페이지로 이동")}
          className="flex items-center justify-center gap-1.5 rounded-xl py-2 text-[12px] font-semibold hover:bg-gray-100 transition-colors"
          style={{ background: "#F3F4F6", color: "#374151" }}>
          <Clapperboard size={13} /> 콘텐츠
        </button>
      </div>
    </div>
  );
}

/* ── 모달 ─────────────────────────────────────────── */

function BranchModal({
  initial, onClose, onSave,
}: {
  initial: Partial<Branch> | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const isEdit = !!initial?.id;
  const hours: BusinessHours =
    (typeof initial?.business_hours === "string"
      ? JSON.parse(initial.business_hours)
      : initial?.business_hours) ?? { weekday: "", saturday: "", sunday: "" };

  const [form, setForm] = useState({
    name: initial?.name ?? "",
    slug: initial?.slug ?? "",
    phone: initial?.phone ?? "",
    address: initial?.address ?? "",
    instagram: initial?.instagram ?? "",
    kakao_map_url: initial?.kakao_map_url ?? "",
    naver_reservation_url: initial?.naver_reservation_url ?? "",
    memo: initial?.memo ?? "",
    weekday: hours.weekday ?? "",
    saturday: hours.saturday ?? "",
    sunday: hours.sunday ?? "",
  });
  const [saving, setSaving] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleSave = async () => {
    if (!form.name.trim() || !form.slug.trim()) return alert("지점명과 슬러그는 필수입니다.");
    setSaving(true);
    const body = {
      name: form.name, slug: form.slug,
      phone: form.phone || null,
      address: form.address || null,
      instagram: form.instagram || null,
      kakao_map_url: form.kakao_map_url || null,
      naver_reservation_url: form.naver_reservation_url || null,
      memo: form.memo || null,
      business_hours: { weekday: form.weekday, saturday: form.saturday, sunday: form.sunday },
    };
    try {
      if (isEdit) {
        await fetch(`/api/hq/branches/${initial!.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      } else {
        await fetch("/api/hq/branches", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      }
      onSave();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full rounded-xl border px-3 py-2 text-[13px] outline-none focus:border-red-400 transition-colors";
  const inputStyle = { borderColor: "#E5E7EB", color: "#111827", background: "#FAFAFA" };
  const labelCls = "block text-[11px] font-semibold mb-1.5 uppercase tracking-widest";
  const labelStyle = { color: "#9CA3AF" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.3)" }}>
      <div className="w-full max-w-lg rounded-2xl p-6 max-h-[90vh] overflow-y-auto" style={cardStyle}>
        <div className="flex items-center justify-between mb-5">
          <p className="text-[16px] font-black" style={{ color: "#111827" }}>{isEdit ? "지점 수정" : "지점 추가"}</p>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100"><X size={16} color="#6B7280" /></button>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} style={labelStyle}>지점명 *</label>
              <input className={inputCls} style={inputStyle} value={form.name} onChange={set("name")} placeholder="목동점" />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>슬러그 *</label>
              <input className={inputCls} style={inputStyle} value={form.slug} onChange={set("slug")} placeholder="mokdong" />
            </div>
          </div>
          <div>
            <label className={labelCls} style={labelStyle}>전화번호</label>
            <input className={inputCls} style={inputStyle} value={form.phone} onChange={set("phone")} placeholder="02-0000-0000" />
          </div>
          <div>
            <label className={labelCls} style={labelStyle}>주소</label>
            <input className={inputCls} style={inputStyle} value={form.address} onChange={set("address")} placeholder="서울 양천구 목동..." />
          </div>
          <div>
            <label className={labelCls} style={labelStyle}>인스타그램 (@ 제외)</label>
            <input className={inputCls} style={inputStyle} value={form.instagram} onChange={set("instagram")} placeholder="strongboxing_mokdong" />
          </div>
          <div>
            <label className={labelCls} style={labelStyle}>운영시간 — 평일</label>
            <input className={inputCls} style={inputStyle} value={form.weekday} onChange={set("weekday")} placeholder="14:00~24:00" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} style={labelStyle}>토요일</label>
              <input className={inputCls} style={inputStyle} value={form.saturday} onChange={set("saturday")} placeholder="11:00~16:00" />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>일요일</label>
              <input className={inputCls} style={inputStyle} value={form.sunday} onChange={set("sunday")} placeholder="휴무" />
            </div>
          </div>
          <div>
            <label className={labelCls} style={labelStyle}>네이버 예약 URL</label>
            <input className={inputCls} style={inputStyle} value={form.naver_reservation_url} onChange={set("naver_reservation_url")} placeholder="https://..." />
          </div>
          <div>
            <label className={labelCls} style={labelStyle}>카카오맵 URL</label>
            <input className={inputCls} style={inputStyle} value={form.kakao_map_url} onChange={set("kakao_map_url")} placeholder="https://..." />
          </div>
          <div>
            <label className={labelCls} style={labelStyle}>메모</label>
            <textarea className={inputCls} style={inputStyle} rows={2} value={form.memo} onChange={set("memo")} />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose}
            className="rounded-xl px-4 py-2 text-[13px] font-semibold hover:bg-gray-100 transition-colors"
            style={{ background: "#F3F4F6", color: "#6B7280" }}>취소</button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 rounded-xl px-5 py-2 text-[13px] font-bold transition-colors disabled:opacity-50"
            style={{ background: "#EF3B2D", color: "#FFF" }}>
            <Save size={14} />{saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── 페이지 ────────────────────────────────────────── */

export default function BranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ open: boolean; data: Partial<Branch> | null }>({ open: false, data: null });

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/hq/branches");
      if (!res.ok) {
        const text = await res.text();
        console.error("[hq/branches] API error", res.status, text);
        setLoading(false);
        return;
      }
      const json = await res.json();
      console.log("[hq/branches] response", json);
      setBranches(json.data ?? json.items ?? []);
    } catch (e) {
      console.error("[hq/branches] fetch failed", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (b: Branch) => {
    if (!confirm(`"${b.name}"을 삭제하시겠습니까?`)) return;
    await fetch(`/api/hq/branches/${b.id}`, { method: "DELETE" });
    load();
  };

  const stats = [
    { label: "전체 지점",   value: String(branches.length), unit: "개" },
    { label: "운영중",      value: String(branches.filter((b) => b.is_active).length), unit: "개" },
    { label: "오늘 상담",  value: "12", unit: "건" },
    { label: "이번달 등록",value: "58", unit: "명" },
  ];

  return (
    <div className="max-w-[1360px] mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[20px] font-black tracking-tight" style={{ color: "#111827" }}>지점 관리</h1>
          <p className="mt-0.5 text-[13px]" style={{ color: "#6B7280" }}>지점별 운영시간, 회비, 연락처, SNS를 관리합니다.</p>
        </div>
        <button onClick={() => setModal({ open: true, data: null })}
          className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-bold transition-colors hover:opacity-90 shrink-0"
          style={{ background: "#EF3B2D", color: "#FFF" }}>
          <Plus size={15} /> 지점 추가
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border px-5 py-4 transition-all duration-200 hover:shadow-md" style={cardStyle}>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: "#9CA3AF" }}>{s.label}</p>
            <div className="flex items-end gap-1">
              <span className="text-[30px] font-black leading-none" style={{ color: "#111827" }}>{s.value}</span>
              <span className="text-[13px] font-semibold mb-0.5" style={{ color: "#6B7280" }}>{s.unit}</span>
            </div>
            <div className="mt-3 h-[2px] w-6 rounded-full" style={{ background: "#EF3B2D" }} />
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <p className="text-[13px]" style={{ color: "#9CA3AF" }}>불러오는 중…</p>
        </div>
      ) : branches.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <p className="text-3xl">🏋️</p>
          <p className="text-[13px]" style={{ color: "#9CA3AF" }}>등록된 지점이 없습니다. SQL을 먼저 실행해주세요.</p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {branches.map((b, i) => (
            <BranchCard
              key={b.id}
              branch={b}
              color={branchColor(b.slug, i)}
              onEdit={(b) => setModal({ open: true, data: b })}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {modal.open && (
        <BranchModal
          initial={modal.data}
          onClose={() => setModal({ open: false, data: null })}
          onSave={load}
        />
      )}
    </div>
  );
}
