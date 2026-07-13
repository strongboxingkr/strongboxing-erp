export default function EmptyState({ message = "데이터가 없습니다." }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <p className="text-4xl">📭</p>
      <p className="mt-3 text-sm" style={{ color: "#94A3B8" }}>{message}</p>
    </div>
  );
}
