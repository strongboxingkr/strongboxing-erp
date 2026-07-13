import AppShell from "@/components/AppShell";

export default function HQLayout({ children }: { children: React.ReactNode }) {
  return <AppShell title="홈페이지 관리">{children}</AppShell>;
}
