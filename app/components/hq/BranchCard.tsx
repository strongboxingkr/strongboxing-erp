import type { Branch } from "@/lib/hq/types";

export default function BranchCard({ branch }: { branch: Branch }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-black text-zinc-900">{branch.name}</h3>
        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${branch.status === "active" ? "bg-green-100 text-green-600" : "bg-zinc-100 text-zinc-400"}`}>
          {branch.status === "active" ? "운영중" : "휴점"}
        </span>
      </div>
      <p className="text-sm text-zinc-500">{branch.address}</p>
      <p className="text-sm text-zinc-500">{branch.phone}</p>
      <p className="text-sm text-zinc-500">{branch.hours}</p>
    </div>
  );
}
