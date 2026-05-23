export type UserRole = "ADMIN" | "OWNER" | "DIRECTOR" | "COACH";

export function getUserFromRequest(req: Request) {
  const role = req.headers.get("x-user-role") as UserRole | null;
  const branch_name = req.headers.get("x-user-branch");
  const user_id = req.headers.get("x-user-id");
  const login_id = req.headers.get("x-user-login-id");

  return {
    user_id,
    login_id,
    role,
    branch_name,
  };
}

export function isAdminOrOwner(role?: string | null) {
  return role === "ADMIN" || role === "OWNER";
}

export function requireLogin(req: Request) {
  const user = getUserFromRequest(req);

  if (!user.role) {
    return {
      ok: false,
      user,
      message: "로그인이 필요합니다.",
    };
  }

  return {
    ok: true,
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