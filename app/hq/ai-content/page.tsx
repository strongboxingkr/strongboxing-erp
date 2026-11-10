"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export const dynamic = "force-dynamic";

// /hq/contents 로 통합됨 (사이드바 링크 호환용 redirect)
export default function AiContentRedirectPage() {
  const router = useRouter();
  useEffect(() => { router.replace("/hq/contents"); }, [router]);
  return null;
}
