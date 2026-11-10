import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest, isAdminOrOwner } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const user = await getUserFromRequest(req);

    if (!user) return NextResponse.json({ success: false, message: "로그인이 필요합니다." }, { status: 401 });


    const { searchParams } = new URL(req.url);
    const branch_name = searchParams.get("branch_name");
    const member_id = searchParams.get("member_id");

    let sql = `
      SELECT
        p.*,
        m.name,
        CASE WHEN p.member_id IS NULL THEN 'Y' ELSE 'N' END AS is_guest
      FROM payments p
      LEFT JOIN members m
        ON p.member_id = m.member_id
      WHERE 1=1
    `;

    const params: any[] = [];

    // 특정 회원 결제만 조회 (회원상세에서 호출)
    if (member_id) {
      sql += ` AND p.member_id = ? `;
      params.push(member_id);
    } else if (isAdminOrOwner(user.role)) {
      if (branch_name) {
        sql += ` AND p.branch_name = ? `;
        params.push(branch_name);
      }
    } else {
      if (!user.branch_name) {
        return NextResponse.json({
          success: false,
          message: "지점 정보가 없습니다.",
        });
      }

      sql += ` AND p.branch_name = ? `;
      params.push(user.branch_name);
    }

    sql += ` ORDER BY p.payment_id DESC `;

    const [rows]: any = await pool.query(sql, params);

    return NextResponse.json({
      success: true,
      rows,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: "결제 목록 조회 실패",
      error,
    });
  }
}

export async function PUT(req: Request) {
  try {
    const user = await getUserFromRequest(req);

    if (!user) return NextResponse.json({ success: false, message: "로그인이 필요합니다." }, { status: 401 });

    const body = await req.json();
    const { payment_id, product_name, final_amount, payment_method, payment_date, memo } = body;

    if (!payment_id) return NextResponse.json({ success: false, message: "payment_id 필요" });
    const allowed = ["ADMIN", "OWNER", "DIRECTOR"];
    if (!allowed.includes(user.role)) return NextResponse.json({ success: false, message: "권한 없음" }, { status: 403 });

    // 취소(final_amount=0 & refund_amount>0) 또는 환불(history_type=REFUND) 결제는 수정 불가
    const [rows]: any = await pool.query(
      `SELECT final_amount, refund_amount, history_type FROM payments WHERE payment_id = ?`,
      [payment_id]
    );
    if (!rows.length) return NextResponse.json({ success: false, message: "결제 없음" }, { status: 404 });
    const p = rows[0];
    if (Number(p.final_amount) === 0 && Number(p.refund_amount) > 0) {
      return NextResponse.json({ success: false, message: "이미 취소된 결제는 수정할 수 없습니다." }, { status: 409 });
    }
    if (p.history_type === "REFUND") {
      return NextResponse.json({ success: false, message: "환불 기록은 수정할 수 없습니다." }, { status: 409 });
    }

    await pool.query(
      `UPDATE payments SET product_name=?, amount=?, final_amount=?, payment_method=?, payment_date=?, memo=? WHERE payment_id=?`,
      [product_name, final_amount, final_amount, payment_method, payment_date, memo || null, payment_id]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, message: "결제 수정 실패", error });
  }
}