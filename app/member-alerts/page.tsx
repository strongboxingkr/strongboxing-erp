"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function MemberAlertsRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/member-management"); }, []);
  return null;
}
