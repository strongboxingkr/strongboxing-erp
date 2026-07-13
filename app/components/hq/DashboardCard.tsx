export default function DashboardCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl border p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl"
      style={{
        background: "linear-gradient(145deg,#181C22,#1a1f28)",
        borderColor: "#2A313C",
      }}
    >
      <h3 className="mb-4 text-[11px] font-black uppercase tracking-widest" style={{ color: "#94A3B8" }}>{title}</h3>
      {children}
    </div>
  );
}
