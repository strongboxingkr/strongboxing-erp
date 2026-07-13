export default function RecentActivity({ items }: { items: { text: string; time: string }[] }) {
  return (
    <ul className="space-y-3">
      {items.map((item, i) => (
        <li key={i} className="flex items-center justify-between text-sm">
          <span className="text-zinc-700">{item.text}</span>
          <span className="text-zinc-400">{item.time}</span>
        </li>
      ))}
    </ul>
  );
}
