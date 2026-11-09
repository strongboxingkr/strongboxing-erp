import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getErpUser, canManageBranch } from "@/lib/erp-session";
import crypto from "node:crypto";

// GET /api/kiosk-device?branch_name= — 직원이 담당 지점 기기 목록 조회
export async function GET(req: Request) {
  const user = await getErpUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const branch = searchParams.get("branch_name") || user.branch_name;

  if (!branch) return NextResponse.json({ success: false, message: "지점 필요" });
  if (!canManageBranch(user, branch)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [rows]: any = await pool.query(
    `SELECT device_id, branch_name, label, registered_by, created_at, revoked_at
     FROM kiosk_devices WHERE branch_name = ? ORDER BY created_at DESC`,
    [branch]
  );
  return NextResponse.json({ success: true, rows });
}

// POST /api/kiosk-device — 현재 기기를 지점에 등록 (직원 로그인 필요)
// body: { branch_name, label? }
export async function POST(req: Request) {
  const user = await getErpUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { branch_name, label } = await req.json();
  if (!branch_name) return NextResponse.json({ success: false, message: "지점 필요" });
  if (!canManageBranch(user, branch_name)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const token = crypto.randomBytes(32).toString("base64url");
  await pool.query(
    `INSERT INTO kiosk_devices (device_token, branch_name, label, registered_by) VALUES (?, ?, ?, ?)`,
    [token, branch_name, label || null, user.name || user.login_id]
  );
  return NextResponse.json({ success: true, device_token: token });
}

// DELETE /api/kiosk-device?device_id= — 기기 해제
export async function DELETE(req: Request) {
  const user = await getErpUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const deviceId = searchParams.get("device_id");
  if (!deviceId) return NextResponse.json({ success: false, message: "device_id 필요" });

  const [rows]: any = await pool.query(`SELECT * FROM kiosk_devices WHERE device_id = ?`, [deviceId]);
  if (!rows[0]) return NextResponse.json({ success: false, message: "기기 없음" });
  if (!canManageBranch(user, rows[0].branch_name)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await pool.query(`UPDATE kiosk_devices SET revoked_at = NOW() WHERE device_id = ?`, [deviceId]);
  return NextResponse.json({ success: true });
}
