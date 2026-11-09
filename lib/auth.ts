import { getErpUser } from "@/lib/erp-session";
export type { ErpUser } from "@/lib/erp-session";

export type UserRole = "ADMIN" | "OWNER" | "DIRECTOR" | "COACH";

/** x-user-* 헤더는 더 이상 신뢰하지 않습니다. erp_session 쿠키만 사용합니다. */
export async function getUserFromRequest(req: Request) {
  return getErpUser(req);
}

export function isAdminOrOwner(role?: string | null) {
  return role === "ADMIN" || role === "OWNER";
}

export async function requireLogin(req: Request) {
  const user = await getUserFromRequest(req);

  if (!user) {
    return {
      ok: false as const,
      user: null,
      message: "로그인이 필요합니다.",
    };
  }

  return {
    ok: true as const,
    user,
    message: "",
  };
}

export function canAccessBranch(
  userRole?: string | null,
  userBranch?: string | null,
  targetBranch?: string | null
) {
  if (isAdminOrOwner(userRole)) return true;

  if (!targetBranch) return true;

  return userBranch === targetBranch;
}