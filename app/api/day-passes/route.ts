import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getErpUser, requireRole } from "@/lib/erp-session";
import { kstToday } from "@/lib/membership-ops";

// GET /api/day-passes?branch_name=&use_date=&member_id=
export async function GET(req: Request) {
  const user = await getErpUser(req);
  if (!user) return NextResponse.json({ success: false, message: "로그인이 필요합니다." }, { status: 401 });
  if (!requireRole(user, ["ADMIN", "OWNER", "DIRECTOR", "COACH"])) {
    return NextResponse.json({ success: false, message: "권한이 없습니다." }, { status: 403 });
  }

  const url = new URL(req.url);
  const branch = url.searchParams.get("branch_name");
  const useDate = url.searchParams.get("use_date");
  const memberId = url.searchParams.get("member_id");

  const conditions: string[] = [];
  const params: any[] = [];

  if (branch) { conditions.push("dp.branch_name = ?"); params.push(branch); }
  if (useDate) { conditions.push("dp.use_date = ?"); params.push(useDate); }
  if (memberId) { conditions.push("dp.member_id = ?"); params.push(memberId); }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const [rows]: any = await pool.query(
    `SELECT dp.*, p.amount, p.final_amount, p.payment_method, p.payment_date, p.product_name
     FROM day_passes dp
     LEFT JOIN payments p ON p.payment_id = dp.payment_id
     ${where}
     ORDER BY dp.use_date DESC, dp.created_at DESC
     LIMIT 200`,
    params
  );

  return NextResponse.json({ success: true, rows });
}
