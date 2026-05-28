import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest, isAdminOrOwner } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const user = getUserFromRequest(req);
    const { searchParams } = new URL(req.url);

    const branch_name = searchParams.get("branch_name");
    const count = Number(searchParams.get("count") || 3);

    let branchCondition = "";
    const params: any[] = [count];

    if (isAdminOrOwner(user.role)) {
      if (branch_name && branch_name !== "전체") {
        branchCondition = " AND branch_name = ? ";
        params.push(branch_name);
      }
    } else {
      branchCondition = " AND branch_name = ? ";
      params.push(user.branch_name);
    }

    const [rows]: any = await pool.query(
      `
      SELECT
        member_id,
        branch_name,
        name,
        phone,
        product_name,
        pass_type,
        remaining_count,
        start_date,
        end_date,
        status,
        staff_name
      FROM members
      WHERE status = 'ACTIVE'
        AND pass_type = 'COUNT'
        AND remaining_count <= ?
        ${branchCondition}
      ORDER BY remaining_count ASC, end_date ASC
      `,
      params
    );

    return NextResponse.json({
      success: true,
      count,
      rows,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: "횟수 부족 회원 조회 실패",
      error,
    });
  }
}