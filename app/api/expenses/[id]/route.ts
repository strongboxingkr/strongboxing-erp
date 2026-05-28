import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest, isAdminOrOwner } from "@/lib/auth";

export async function PUT(req: Request, context: any) {
  try {
    const user = getUserFromRequest(req);
    const expenseId = context.params.id;
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

    const [oldRows]: any = await pool.query(
      `
      SELECT *
      FROM expenses
      WHERE expense_id = ?
      LIMIT 1
      `,
      [expenseId]
    );

    if (oldRows.length === 0) {
      return NextResponse.json(
        { success: false, message: "비용 내역을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const oldExpense = oldRows[0];

    if (!isAdminOrOwner(user.role) && oldExpense.branch_name !== user.branch_name) {
      return NextResponse.json(
        { success: false, message: "수정 권한이 없습니다." },
        { status: 403 }
      );
    }

    const finalBranchName = isAdminOrOwner(user.role)
      ? branch_name || oldExpense.branch_name
      : user.branch_name;

    await pool.query(
      `
      UPDATE expenses
      SET
        branch_name = ?,
        expense_date = ?,
        category = ?,
        title = ?,
        amount = ?,
        is_fixed = ?,
        memo = ?
      WHERE expense_id = ?
      `,
      [
        finalBranchName,
        expense_date || oldExpense.expense_date,
        category || null,
        title || oldExpense.title,
        amount ?? oldExpense.amount,
        is_fixed || oldExpense.is_fixed || "N",
        memo || null,
        expenseId,
      ]
    );

    return NextResponse.json({
      success: true,
      message: "비용 내역이 수정되었습니다.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: "비용 수정 실패",
        error,
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request, context: any) {
  try {
    const user = getUserFromRequest(req);
    const expenseId = context.params.id;

    const [oldRows]: any = await pool.query(
      `
      SELECT *
      FROM expenses
      WHERE expense_id = ?
      LIMIT 1
      `,
      [expenseId]
    );

    if (oldRows.length === 0) {
      return NextResponse.json(
        { success: false, message: "비용 내역을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const oldExpense = oldRows[0];

    if (!isAdminOrOwner(user.role) && oldExpense.branch_name !== user.branch_name) {
      return NextResponse.json(
        { success: false, message: "삭제 권한이 없습니다." },
        { status: 403 }
      );
    }

    await pool.query(
      `
      DELETE FROM expenses
      WHERE expense_id = ?
      `,
      [expenseId]
    );

    return NextResponse.json({
      success: true,
      message: "비용 내역이 삭제되었습니다.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: "비용 삭제 실패",
        error,
      },
      { status: 500 }
    );
  }
}