import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest, isAdminOrOwner } from "@/lib/auth";

function csvEscape(value: any) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET(req: Request) {
  try {
    const user = getUserFromRequest(req);

    let sql = `
      SELECT
        p.*,
        m.name
      FROM payments p
      LEFT JOIN members m
        ON p.member_id = m.member_id
      WHERE 1=1
    `;

    const params: any[] = [];

    if (!isAdminOrOwner(user.role)) {
      sql += ` AND p.branch_name = ? `;
      params.push(user.branch_name);
    }

    sql += ` ORDER BY p.payment_date DESC, p.payment_id DESC `;

    const [rows]: any = await pool.query(sql, params);

    const header = [
      "지점",
      "회원명",
      "상품명",
      "결제금액",
      "결제수단",
      "결제일",
      "메모",
    ];

    const csvRows = [
      header.map(csvEscape).join(","),
      ...rows.map((r: any) =>
        [
          r.branch_name,
          r.name,
          r.product_name,
          r.amount,
          r.payment_method,
          r.payment_date?.toISOString?.().slice(0, 10) ||
            r.payment_date,
          r.memo,
        ]
          .map(csvEscape)
          .join(",")
      ),
    ];

    const csv = "\uFEFF" + csvRows.join("\n");

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition":
          'attachment; filename="payments.csv"',
      },
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: "결제 다운로드 실패",
      error,
    });
  }
}