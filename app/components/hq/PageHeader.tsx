export default function PageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-black tracking-tight" style={{ color: "#F8FAFC" }}>{title}</h1>
      {description && <p className="mt-1 text-sm" style={{ color: "#94A3B8" }}>{description}</p>}
    </div>
  );
}
