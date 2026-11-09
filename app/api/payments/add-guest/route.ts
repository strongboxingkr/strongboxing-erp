import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest, canAccessBranch } from "@/lib/auth";

export async function POST(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    const {
      branch_name, payment_date, payment_method, product_name, final_amount, memo,
      use_date: use_date_input, // 일일권 지정 이용일 (없으면 KST 오늘)
      guest_name,               // 비회원 성명 (일일권 추적용)
      guest_phone,              // 비회원 연락처
    } = body;

    if (branch_name && !canAccessBranch(user.role, user.branch_name, branch_name)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!branch_name) return NextResponse.json({ success: false, message: "지점 선택 필요" });
    if (!product_name) return NextResponse.json({ success: false, message: "상품 선택 필요" });
    if (final_amount === undefined || final_amount === null || final_amount === "") return NextResponse.json({ success: false, message: "금액 입력 필요" });

    // 상품이 일일권(DAILY)인지 확인
    const [productRows]: any = await pool.query(
      `SELECT option_value FROM settings_options WHERE option_type='PASS_PRODUCT' AND option_name=? AND use_yn='Y' LIMIT 1`,
      [product_name]
    );
    const isDailyPass = productRows[0]?.option_value === "DAILY";

    const kstToday = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
    const payDate = payment_date || kstToday;
    const useDate = use_date_input ? String(use_date_input).slice(0, 10) : kstToday;

    if (isDailyPass) {
      // 비회원 일일권: 결제 기록만 저장 (입장코드·출석 처리 없음)
      await pool.query(
        `INSERT INTO payments (member_id, branch_name, payment_date, payment_method, product_name, pass_type, total_count, start_date, end_date, amount, discount_amount, refund_amount, final_amount, memo)
         VALUES (NULL, ?, ?, ?, ?, 'DAILY', 1, ?, NULL, ?, 0, 0, ?, ?)`,
        [branch_name, payDate, payment_method || "CARD", product_name, useDate, final_amount, final_amount, memo || "비회원 일일권"]
      );
      return NextResponse.json({ success: true, message: "비회원 일일권 등록 완료" });
    }

    // 일반 비회원 결제 (non-DAILY)
    await pool.query(
      `INSERT INTO payments (member_id, branch_name, payment_date, payment_method, product_name, pass_type, amount, discount_amount, refund_amount, final_amount, memo)
       VALUES (NULL, ?, ?, ?, ?, 'PERIOD', ?, 0, 0, ?, ?)`,
      [branch_name, payDate, payment_method || "CARD", product_name, final_amount, final_amount, memo || "비회원"]
    );

    return NextResponse.json({ success: true, message: "비회원 결제 등록 완료" });
  } catch (error) {
    return NextResponse.json({ success: false, message: "결제 등록 실패", error });
  }
}
