import crypto from "node:crypto";
import pool from "@/lib/db";

/**
 * ERP 서버 세션 (httpOnly 쿠키).
 * 기존 ERP 는 브라우저가 보내는 x-user-* 헤더로 권한을 판단해 위조가 가능합니다.
 * 새로 추가한 관리 API(휴회 신청 처리, 마무리 운동, 회원앱 소식)는 헤더를 쓰지 않고 이 세션만 신뢰합니다.
 */
export const ERP_SESSION_COOKIE = "erp_session";
const HOURS = 12;
const sha256 = (v: string) => crypto.createHash("sha256").update(v).digest("hex");

export type ErpUser = { user_id: number; login_id: string; name: string; role: string; branch_name: string | null };

export async function createErpSession(userId: number) {
  const token = crypto.randomBytes(32).toString("base64url");
  await pool.query(
    `INSERT INTO erp_sessions (user_id, token_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ${HOURS} HOUR))`,
    [userId, sha256(token)]
  );
  return token;
}

export function sessionCookie(token: string) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${ERP_SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${HOURS * 3600}${secure}`;
}
export const clearSessionCookie = () => `${ERP_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;

function readCookie(req: Request, name: string) {
  const raw = req.headers.get("cookie") || "";
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}

export async function getErpUser(req: Request): Promise<ErpUser | null> {
  const token = readCookie(req, ERP_SESSION_COOKIE);
  if (!token || token.length < 20) return null;
  const [rows]: any = await pool.query(
    `SELECT u.user_id, u.login_id, u.name, u.role, u.branch_name, u.use_yn, u.status
     FROM erp_sessions s JOIN users u ON u.user_id = s.user_id
     WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > NOW() LIMIT 1`,
    [sha256(token)]
  );
  const u = rows[0];
  if (!u || u.use_yn !== "Y" || (u.status && u.status !== "APPROVED")) return null;
  return { user_id: u.user_id, login_id: u.login_id, name: u.name, role: u.role, branch_name: u.branch_name };
}

export async function revokeErpSession(req: Request) {
  const token = readCookie(req, ERP_SESSION_COOKIE);
  if (token) await pool.query(`UPDATE erp_sessions SET revoked_at = NOW() WHERE token_hash = ?`, [sha256(token)]);
}

export const isHq = (u: ErpUser) => u.role === "ADMIN" || u.role === "OWNER";

/** 대표·관리자: 전 지점 / 관장: 자기 지점만 / 그 외: 불가 */
export function canManageBranch(u: ErpUser, branch: string) {
  if (isHq(u)) return true;
  return u.role === "DIRECTOR" && !!u.branch_name && u.branch_name === branch;
}

export function requireRole(u: ErpUser | null, roles = ["ADMIN", "OWNER", "DIRECTOR"]) {
  return !!u && roles.includes(u.role);
}
