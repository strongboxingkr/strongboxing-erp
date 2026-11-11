import { NextResponse } from "next/server";
import { withMemberChange } from "@/lib/membership-ops";
import { getUserFromRequest } from "@/lib/auth";

export async function POST(req: Request, context: any) {
  const memberId = context.params.id;

  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ success: false, message: "로그인이 필요합니다." }, { status: 401 });

    const body = await req.json();
    const {
      payment_date, payment_method, product_name, pass_type,
      amount, discount_amount, refund_amount, final_amount,
      unpaid_amount, start_date, end_date, total_count, memo, staff_name,
      extend_locker,  // true: 라커 종료일을 회원권 종료일에 맞춤
    } = body;

    let responsePayload: any = null;

    await withMemberChange(
      { type: "RENEW", reason: "회원권 재등록", source: "members/renew", actor: staff_name || user.name || "직원" },
      async (conn) => {
        const [memberRows]: any = await conn.query(
          "SELECT * FROM members WHERE member_id = ?",
          [memberId]
        );
        if (memberRows.length === 0) {
          responsePayload = { success: false, message: "회원을 찾을 수 없습니다.", status: 404 };
          return;
        }

        const member = memberRows[0];
        const finalStaffName = staff_name || "관리자";

        const [paymentResult]: any = await conn.query(
          `INSERT INTO payments (
            member_id, branch_name, payment_date, payment_method, product_name, pass_type,
            start_date, end_date, total_count, amount, discount_amount, refund_amount,
            final_amount, unpaid_amount, operator_name, history_type, memo,
            payment_purpose
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PASS')`,
          [
            memberId, member.branch_name,
            payment_date || new Date(), payment_method, product_name, pass_type,
            start_date || null, end_date || null, total_count || 0,
            amount || 0, discount_amount || 0, refund_amount || 0, final_amount || 0,
            unpaid_amount || 0, finalStaffName, "RENEWAL", memo || null,
          ]
        );

        await conn.query(
          `SET @sbm_change_ref_type = 'payment', @sbm_change_ref_id = ?`,
          [paymentResult.insertId]
        );

        await conn.query(
          `UPDATE members
           SET product_name = ?, pass_type = ?, remaining_count = ?,
               start_date = ?, end_date = ?, status = 'ACTIVE', staff_name = ?
           WHERE member_id = ?`,
          [
            product_name, pass_type,
            pass_type === "COUNT" ? total_count || 0 : 0,
            start_date || null, end_date || null, finalStaffName, memberId,
          ]
        );

        // 라커 기간 함께 연장: extend_locker=true 이고 회원권 종료일이 있을 때만
        // 라커가 없는 회원에게는 임의 배정하지 않음, 이용료 임의 생성 없음
        if (extend_locker && end_date && member.locker_no) {
          await conn.query(
            `UPDATE lockers SET end_date = ?
             WHERE branch_name = ? AND locker_no = ? AND member_id = ?`,
            [end_date, member.branch_name, member.locker_no, memberId]
          );
          await conn.query(
            `INSERT INTO member_histories (member_id, member_name, action_type, action_memo, old_value, new_value, created_by)
             VALUES (?, ?, 'LOCKER_EXTEND', ?, ?, ?, ?)`,
            [
              memberId, member.name, "라커 기간 연장(재등록)",
              JSON.stringify({ locker_no: member.locker_no, old_end_date: member.end_date }),
              JSON.stringify({ locker_no: member.locker_no, new_end_date: end_date }),
              finalStaffName,
            ]
          );
        }

        responsePayload = {
          success: true,
          message: "재등록이 완료되었습니다.",
          payment_id: paymentResult.insertId,
          locker_extended: !!(extend_locker && end_date && member.locker_no),
        };
      }
    );

    if (responsePayload?.status) {
      return NextResponse.json(responsePayload, { status: responsePayload.status });
    }
    return NextResponse.json(responsePayload);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, message: "재등록 처리 중 오류가 발생했습니다.", error }, { status: 500 });
  }
}
