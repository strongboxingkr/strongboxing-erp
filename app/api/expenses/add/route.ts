import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function POST(req: Request) {
  try {
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

    await pool.query(
      `
      INSERT INTO expenses
      (
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
        branch_name,
        expense_date,
        category,
        title,
        amount,
        is_fixed ? "Y" : "N",
        memo || "",
      ]
    );

    return NextResponse.json({
      success: true,
      message: "비용 등록 완료",
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: "비용 등록 실패",
      error,
    });
  }
}