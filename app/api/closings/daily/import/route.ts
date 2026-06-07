import { NextResponse } from "next/server";
import pool from "@/lib/db";
import * as XLSX from "xlsx";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const file = formData.get("file") as File;
    const branch_name = String(formData.get("branch_name"));

    if (!file) {
      return NextResponse.json({
        success: false,
        message: "파일이 없습니다.",
      });
    }

    const bytes = await file.arrayBuffer();
    const workbook = XLSX.read(bytes);

    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet);

    for (const row of rows) {
      const closingDate =
        `${row["년도"]}-${String(row["월"]).padStart(2, "0")}-${String(
          row["일"]
        ).padStart(2, "0")}`;

      const cashAmount = Number(row["현금매출"] || 0);
      const cardAmount = Number(row["카드매출"] || 0);
      const salesAmount = Number(row["총매출"] || 0);

      const [exist]: any = await pool.query(
        `
        SELECT closing_id
        FROM daily_closings
        WHERE branch_name = ?
          AND closing_date = ?
        `,
        [branch_name, closingDate]
      );

      if (exist.length > 0) {
        await pool.query(
          `
          UPDATE daily_closings
          SET
            sales_amount = ?,
            cash_amount = ?,
            card_amount = ?
          WHERE closing_id = ?
          `,
          [
            salesAmount,
            cashAmount,
            cardAmount,
            exist[0].closing_id,
          ]
        );
      } else {
        await pool.query(
          `
          INSERT INTO daily_closings (
            branch_name,
            closing_date,
            sales_amount,
            cash_amount,
            card_amount
          )
          VALUES (?, ?, ?, ?, ?)
          `,
          [
            branch_name,
            closingDate,
            salesAmount,
            cashAmount,
            cardAmount,
          ]
        );
      }
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json({
      success: false,
      message: "엑셀 업로드 실패",
    });
  }
}