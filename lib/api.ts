export function getSavedUser() {
  if (typeof window === "undefined") return null;

  const savedUser = localStorage.getItem("user");

  if (!savedUser) return null;

  try {
    return JSON.parse(savedUser);
  } catch {
    return null;
  }
}

export async function apiFetch(url: string, options: RequestInit = {}) {
  const user = getSavedUser();

  const headers = new Headers(options.headers || {});

  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (user) {
    headers.set("x-user-id", String(user.user_id || ""));
    headers.set("x-user-login-id", String(user.login_id || ""));
    headers.set("x-user-role", String(user.role || ""));
    headers.set("x-user-branch", String(user.branch_name || ""));
  }

  return fetch(url, {
    ...options,
    headers,
  });
}