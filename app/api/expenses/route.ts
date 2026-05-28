import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest, isAdminOrOwner } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const user = getUserFromRequest(req);

    const { searchParams } = new URL(req.url);
    const branch_name = searchParams.get("branch_name");
    const month = searchParams.get("month");
    const date = searchParams.get("date");

    let sql = `
      SELECT *
      FROM expenses
      WHERE 1=1
    `;

    const params: any[] = [];

    if (isAdminOrOwner(user.role)) {
      if (branch_name && branch_name !== "전체") {
        sql += ` AND branch_name = ? `;
        params.push(branch_name);
      }
    } else {
      if (!user.branch_name) {
        return NextResponse.json({
          success: false,
          message: "지점 정보가 없습니다.",
        });
      }

      sql += ` AND branch_name = ? `;
      params.push(user.branch_name);
    }

    if (date) {
      sql += ` AND expense_date = ? `;
      params.push(date);
    }

    if (month) {
      sql += ` AND DATE_FORMAT(expense_date, '%Y-%m') = ? `;
      params.push(month);
    }

    sql += ` ORDER BY expense_date DESC, expense_id DESC `;

    const [rows]: any = await pool.query(sql, params);

    return NextResponse.json({
      success: true,
      rows,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: "비용 목록 조회 실패",
      error,
    });
  }
}

export async function POST(req: Request) {
  try {
    const user = getUserFromRequest(req);
    const body = await req.json();

    const {
      branch_name,
      expense_date,
      category,
      title,
      amount,
      is_fixed,
      memo,
    } = body;

    const finalBranchName = isAdminOrOwner(user.role)
      ? branch_name
      : user.branch_name;

    if (!finalBranchName || !expense_date || !title || !amount) {
      return NextResponse.json({
        success: false,
        message: "지점명, 지출일, 제목, 금액은 필수입니다.",
      });
    }

    const [result]: any = await pool.query(
      `
      INSERT INTO expenses (
        branch_name,
        expense_date,
        category,
        title,
        amount,
        is_fixed,
        memo
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        finalBranchName,
        expense_date,
        category || null,
        title,
        amount,
        is_fixed || "N",
        memo || null,
      ]
    );

    return NextResponse.json({
      success: true,
      message: "비용이 등록되었습니다.",
      expense_id: result.insertId,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: "비용 등록 실패",
        error,
      },
      { status: 500 }
    );
  }
}