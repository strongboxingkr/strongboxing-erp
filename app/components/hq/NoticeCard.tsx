export default function NoticeCard({ notices }: { notices: { title: string; date: string }[] }) {
  return (
    <ul className="space-y-3">
      {notices.map((n, i) => (
        <li key={i} className="flex items-center justify-between text-sm">
          <span className="font-bold text-zinc-800">{n.title}</span>
          <span className="text-zinc-400">{n.date}</span>
        </li>
      ))}
    </ul>
  );
}
