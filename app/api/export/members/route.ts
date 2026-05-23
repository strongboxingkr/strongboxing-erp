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
        branch_name,
        name,
        phone,
        checkin_code,
        product_name,
        pass_type,
        remaining_count,
        start_date,
        end_date,
        status,
        memo,
        created_at
      FROM members
      WHERE 1=1
    `;

    const params: any[] = [];

    if (!isAdminOrOwner(user.role)) {
      sql += ` AND branch_name = ? `;
      params.push(user.branch_name);
    }

    sql += ` ORDER BY branch_name, name `;

    const [rows]: any = await pool.query(sql, params);

    const header = [
      "지점",
      "이름",
      "전화번호",
      "출석번호",
      "회원권",
      "구분",
      "남은횟수",
      "시작일",
      "만료일",
      "상태",
      "메모",
      "등록일",
    ];

    const csvRows = [
      header.map(csvEscape).join(","),
      ...rows.map((r: any) =>
        [
          r.branch_name,
          r.name,
          r.phone,
          r.checkin_code,
          r.product_name,
          r.pass_type === "COUNT" ? "횟수권" : "기간권",
          r.remaining_count,
          r.start_date?.toISOString?.().slice(0, 10) || r.start_date,
          r.end_date?.toISOString?.().slice(0, 10) || r.end_date,
          r.status,
          r.memo,
          r.created_at?.toISOString?.().slice(0, 19) || r.created_at,
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
        "Content-Disposition": `attachment; filename="members.csv"`,
      },
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: "회원 다운로드 실패",
      error,
    });
  }
}