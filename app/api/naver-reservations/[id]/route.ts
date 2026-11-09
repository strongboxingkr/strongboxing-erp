import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest, canAccessBranch } from "@/lib/auth";

async function getReservationBranch(reservationId: string): Promise<string | null> {
  const [rows]: any = await pool.query(
    "SELECT branch_name FROM naver_reservations WHERE reservation_id = ? LIMIT 1",
    [reservationId]
  );
  return rows[0]?.branch_name ?? null;
}

export async function PUT(req: Request, context: any) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ success: false, message: "로그인이 필요합니다." }, { status: 401 });

    const reservationId = context.params.id;
    const branchName = await getReservationBranch(reservationId);

    if (!canAccessBranch(user.role, user.branch_name, branchName)) {
      return NextResponse.json({ success: false, message: "권한이 없습니다." }, { status: 403 });
    }

    const body = await req.json();
    const { status, memo, is_read } = body;

    await pool.query(
      `UPDATE naver_reservations
       SET status = COALESCE(?, status),
           memo = COALESCE(?, memo),
           is_read = COALESCE(?, is_read)
       WHERE reservation_id = ?`,
      [status || null, memo || null, is_read || null, reservationId]
    );

    return NextResponse.json({ success: true, message: "예약 정보가 수정되었습니다." });
  } catch (error) {
    return NextResponse.json({ success: false, message: "예약 수정 실패", error });
  }
}

export async function DELETE(req: Request, context: any) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ success: false, message: "로그인이 필요합니다." }, { status: 401 });

    const reservationId = context.params.id;
    const branchName = await getReservationBranch(reservationId);

    if (!canAccessBranch(user.role, user.branch_name, branchName)) {
      return NextResponse.json({ success: false, message: "권한이 없습니다." }, { status: 403 });
    }

    await pool.query("DELETE FROM naver_reservations WHERE reservation_id = ?", [reservationId]);

    return NextResponse.json({ success: true, message: "예약이 삭제되었습니다." });
  } catch (error) {
    return NextResponse.json({ success: false, message: "예약 삭제 실패", error });
  }
}
