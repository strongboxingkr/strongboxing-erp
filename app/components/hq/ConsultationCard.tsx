import type { Consultation } from "@/lib/hq/types";

export default function ConsultationCard({ item }: { item: Consultation }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-black text-zinc-900">{item.name}</span>
        <span className="rounded-full bg-[#FC5230]/10 px-3 py-1 text-xs font-bold text-[#FC5230]">{item.branch}</span>
      </div>
      <p className="text-sm text-zinc-600">{item.reservation_date} {item.reservation_time}</p>
      <p className="text-sm text-zinc-500">{item.phone}</p>
      {item.goal && <p className="mt-1 text-xs text-zinc-400">{item.goal}</p>}
    </div>
  );
}
