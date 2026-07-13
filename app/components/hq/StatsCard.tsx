interface Props {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  accent?: string;
}

export default function StatsCard({ label, value, unit = "", sub = "", accent = "#EF3B2D" }: Props) {
  return (
    <div
      className="rounded-2xl border px-4 py-3.5 transition-shadow hover:shadow-md"
      style={{
        background: "#FFFFFF",
        borderColor: "#E5E7EB",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        minHeight: 0,
      }}
    >
      <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "#9CA3AF" }}>
        {label}
      </p>
      <div className="flex items-end gap-1">
        <span className="text-[26px] font-black leading-none tracking-tight" style={{ color: "#111827" }}>{value}</span>
        {unit && <span className="text-[12px] font-semibold mb-0.5" style={{ color: "#6B7280" }}>{unit}</span>}
      </div>
      {sub && <p className="mt-1 text-[11px]" style={{ color: "#9CA3AF" }}>{sub}</p>}
      <div className="mt-2.5 h-[2px] w-5 rounded-full" style={{ background: accent }} />
    </div>
  );
}
