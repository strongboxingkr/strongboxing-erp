import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest, isAdminOrOwner } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isAdminOrOwner(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();

    const { branch_name, target_month, target_amount, memo } = body;

    await pool.query(
      `
      INSERT INTO branch_monthly_targets
      (branch_name, target_month, target_amount, memo)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        target_amount = VALUES(target_amount),
        memo = VALUES(memo)
      `,
      [branch_name, target_month, target_amount, memo || ""]
    );

    return NextResponse.json({
      success: true,
      message: "목표매출 저장 완료",
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: "목표매출 저장 실패",
      error,
    });
  }
}