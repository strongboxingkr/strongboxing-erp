import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// 인메모리 rate limiting — 단일 프로세스 pm2 환경에 적합
// 멀티 인스턴스 환경에서는 Redis 기반으로 교체 필요

interface RateEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateEntry>();

// 메모리 누수 방지: 만료 항목 주기적 정리
function cleanup() {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt < now) store.delete(key);
  }
}
// 5분마다 정리 (setInterval은 Edge Runtime에서 미지원 — middleware 호출 시 샘플링으로 처리)
let lastCleanup = Date.now();

function checkRate(key: string, limitCount: number, windowMs: number): boolean {
  const now = Date.now();

  // 10% 확률로 만료 항목 정리 (Edge Runtime 호환)
  if (now - lastCleanup > 60_000) {
    cleanup();
    lastCleanup = now;
  }

  const entry = store.get(key);
  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true; // 허용
  }
  if (entry.count >= limitCount) {
    return false; // 차단
  }
  entry.count++;
  return true; // 허용
}

function getIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const ip = getIp(req);

  // /api/check-in: 60회/분 per IP
  // 근거: 실제 키오스크 최대 부하 ~3req/min, 10배 여유. 10,000회 대입 공격은 167분 소요로 실용적 차단.
  if (pathname === "/api/check-in") {
    const allowed = checkRate(`checkin:${ip}`, 60, 60_000);
    if (!allowed) {
      return new NextResponse(
        JSON.stringify({ success: false, message: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." }),
        { status: 429, headers: { "Content-Type": "application/json", "Retry-After": "60" } }
      );
    }
  }

  // /api/login: 10회/15분 per IP
  // 근거: 정상 로그인은 하루 수회. 자동화 공격은 초당 수십 회 → 15분 내 10회 초과로 감지.
  if (pathname === "/api/login") {
    const allowed = checkRate(`login:${ip}`, 10, 15 * 60_000);
    if (!allowed) {
      return new NextResponse(
        JSON.stringify({ success: false, message: "로그인 시도 횟수를 초과했습니다. 15분 후 다시 시도해주세요." }),
        { status: 429, headers: { "Content-Type": "application/json", "Retry-After": "900" } }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/check-in", "/api/login"],
};
