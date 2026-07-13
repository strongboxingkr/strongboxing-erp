export default function ContentCard({ title, branch, category, date }: { title: string; branch: string; category: string; date: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5">
      <div className="mb-2 flex gap-2">
        <span className="rounded-full bg-[#FC5230] px-3 py-1 text-xs font-black text-white">{branch}</span>
        <span className="rounded-full border border-zinc-200 px-3 py-1 text-xs text-zinc-500">{category}</span>
      </div>
      <h3 className="font-bold text-zinc-900">{title}</h3>
      <p className="mt-1 text-xs text-zinc-400">{date}</p>
    </div>
  );
}
