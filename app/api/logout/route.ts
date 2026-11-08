import { NextResponse } from "next/server";
import { clearSessionCookie, revokeErpSession } from "@/lib/erp-session";

/** ERP 서버 세션 종료 (쿠키 삭제 + DB 세션 폐기) */
export async function POST(req: Request) {
  await revokeErpSession(req).catch(() => {});
  const res = NextResponse.json({ success: true });
  res.headers.append("Set-Cookie", clearSessionCookie());
  return res;
}
