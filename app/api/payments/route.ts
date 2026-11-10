import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest, isAdminOrOwner } from "@/lib/auth";
import { lockPaymentForEdit, paymentGuardErrorResponse } from "@/lib/payment-guard";

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
  const conn = await (pool as any).getConnection();
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ success: false, message: "로그인이 필요합니다." }, { status: 401 });

    const body = await req.json();
    const { payment_id, product_name, final_amount, payment_method, payment_date, memo } = body;

    if (!payment_id) return NextResponse.json({ success: false, message: "payment_id 필요" });
    const allowed = ["ADMIN", "OWNER", "DIRECTOR"];
    if (!allowed.includes(user.role)) return NextResponse.json({ success: false, message: "권한 없음" }, { status: 403 });

    await conn.beginTransaction();

    // FOR UPDATE 잠금 후 최신 상태 검증
    await lockPaymentForEdit(conn, payment_id);

    await conn.query(
      `UPDATE payments SET product_name=?, amount=?, final_amount=?, payment_method=?, payment_date=?, memo=? WHERE payment_id=?`,
      [product_name, final_amount, final_amount, payment_method, payment_date, memo || null, payment_id]
    );

    await conn.commit();
    return NextResponse.json({ success: true });
  } catch (error: any) {
    await conn.rollback();
    const guardRes = paymentGuardErrorResponse(error);
    if (guardRes) return NextResponse.json(guardRes.body, { status: guardRes.status });
    return NextResponse.json({ success: false, message: "결제 수정 실패", error });
  } finally {
    conn.release();
  }
}