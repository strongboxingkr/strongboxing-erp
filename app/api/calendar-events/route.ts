import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest, isAdminOrOwner, canAccessBranch } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { searchParams } = new URL(req.url);

    const branch_name = searchParams.get("branch_name");
    if (branch_name && !canAccessBranch(user.role, user.branch_name, branch_name)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const start_date = searchParams.get("start_date");
    const end_date = searchParams.get("end_date");

    // DIRECTOR/COACH는 세션 지점으로 강제 고정, ADMIN/OWNER는 파라미터 사용
    const effectiveBranch = isAdminOrOwner(user.role)
      ? (branch_name && branch_name !== "전체" ? branch_name : null)
      : user.branch_name;

    if (!effectiveBranch && !isAdminOrOwner(user.role)) {
      return NextResponse.json({ success: false, message: "지점 정보가 없습니다." }, { status: 403 });
    }

    let sql = `
      SELECT *
      FROM calendar_events
      WHERE 1=1
    `;

    const params: any[] = [];

    if (effectiveBranch) {
      sql += ` AND branch_name = ?`;
      params.push(effectiveBranch);
    }

    if (start_date) {
      sql += ` AND start_datetime >= ?`;
      params.push(start_date + " 00:00:00");
    }

    if (end_date) {
      sql += ` AND start_datetime <= ?`;
      params.push(end_date + " 23:59:59");
    }

    const include_cancelled = searchParams.get("include_cancelled") === "true";
    if (!include_cancelled) {
      sql += ` AND status != '취소'`;
    }

    sql += `
      ORDER BY start_datetime ASC
    `;

    const [rows]: any = await pool.query(sql, params);

    return NextResponse.json({
      success: true,
      rows,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json({
      success: false,
      message: "캘린더 조회 실패",
      error,
    });
  }
}

export async function POST(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();

    const {
      branch_name,
      event_type,
      title,
      customer_name,
      phone,
      start_datetime,
      end_datetime,
      memo,
      status,
      source_type,
      source_id,
    } = body;

    await pool.query(
      `
      INSERT INTO calendar_events
      (
        branch_name,
        event_type,
        title,
        customer_name,
        phone,
        start_datetime,
        end_datetime,
        memo,
        status,
        source_type,
        source_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        branch_name,
        event_type,
        title,
        customer_name,
        phone,
        start_datetime,
        end_datetime || null,
        memo || "",
        status || "예약",
        source_type || "",
        source_id || "",
      ]
    );

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json({
      success: false,
      message: "캘린더 저장 실패",
      error,
    });
  }
}