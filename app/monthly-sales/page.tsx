"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function MonthlySalesRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/sales?tab=월별"); }, []);
  return null;
}
