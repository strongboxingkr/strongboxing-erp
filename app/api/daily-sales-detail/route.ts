import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest, isAdminOrOwner } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const user = await getUserFromRequest(req);

    if (!user) return NextResponse.json({ success: false, message: "로그인이 필요합니다." }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");
    const branch_name = searchParams.get("branch_name");

    if (!date) return NextResponse.json({ success: false, message: "date 필요" });

    const finalBranch = isAdminOrOwner(user.role) ? branch_name : user.branch_name;
    const branchWhere = finalBranch ? "AND p.branch_name = ?" : "";
    const params: any[] = finalBranch ? [finalBranch] : [];

    const [rows]: any = await pool.query(
      `
      SELECT
        p.payment_id,
        p.payment_date,
        p.created_at,
        p.payment_method,
        p.product_name,
        p.amount,
        p.discount_amount,
        p.final_amount,
        p.memo,
        p.branch_name,
        m.name AS member_name,
        (SELECT COUNT(*) FROM payments p2 WHERE p2.member_id = p.member_id AND p2.final_amount > 0) AS payment_count
      FROM payments p
      LEFT JOIN members m ON p.member_id = m.member_id
      WHERE DATE(p.payment_date) = ?
        AND p.final_amount > 0
        ${branchWhere}
      ORDER BY p.payment_id DESC
      `,
      [date, ...params]
    );

    const cashTotal = rows.reduce((s: number, r: any) => r.payment_method === "CASH" ? s + Number(r.final_amount) : s, 0);
    const cardTotal = rows.reduce((s: number, r: any) => r.payment_method === "CARD" ? s + Number(r.final_amount) : s, 0);
    const transferTotal = rows.reduce((s: number, r: any) => r.payment_method === "TRANSFER" ? s + Number(r.final_amount) : s, 0);
    const total = rows.reduce((s: number, r: any) => s + Number(r.final_amount), 0);

    return NextResponse.json({
      success: true,
      rows,
      summary: { cash: cashTotal, card: cardTotal, transfer: transferTotal, total },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error });
  }
}
