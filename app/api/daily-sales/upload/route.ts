import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest, isAdminOrOwner } from "@/lib/auth";
import * as xlsx from "xlsx";

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminOrOwner(user.role)) return NextResponse.json({ error: "권한 없음" }, { status: 403 });

  const formData = await req.formData();
  const file = formData.get("file") as File;
  const branch_name = formData.get("branch_name") as string;

  if (!file || !branch_name) return NextResponse.json({ error: "파일과 지점을 선택해주세요." }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const wb = xlsx.read(buffer, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data: any[] = xlsx.utils.sheet_to_json(ws, { header: 1 });

  // 헤더 찾기 (년도, 월, 일 컬럼이 있는 행)
  let headerIdx = -1;
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (row && String(row[0]).includes("년도") || String(row[0]) === "년도") {
      headerIdx = i;
      break;
    }
  }

  const rows = headerIdx >= 0 ? data.slice(headerIdx + 1) : data.slice(1);

  let inserted = 0;
  let skipped = 0;

  for (const row of rows) {
    if (!row[0] || !row[1] || !row[2]) continue;
    const year = String(row[0]).trim();
    const month = String(row[1]).trim().padStart(2, "0");
    const day = String(row[2]).trim().padStart(2, "0");

    if (!/^\d{4}$/.test(year) || !/^\d{2}$/.test(month) || !/^\d{2}$/.test(day)) continue;

    const sale_date = `${year}-${month}-${day}`;
    const cash_amount = Number(row[4]) || 0;
    const card_amount = Number(row[5]) || 0;
    const unpaid_amount = Number(row[6]) || 0;
    const total_amount = Number(row[7]) || 0;
    const expense_amount = Number(row[8]) || 0;
    const net_amount = Number(row[9]) || 0;

    try {
      await pool.query(
        `INSERT INTO daily_sales (branch_name, sale_date, cash_amount, card_amount, unpaid_amount, total_amount, expense_amount, net_amount)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           cash_amount=VALUES(cash_amount), card_amount=VALUES(card_amount),
           unpaid_amount=VALUES(unpaid_amount), total_amount=VALUES(total_amount),
           expense_amount=VALUES(expense_amount), net_amount=VALUES(net_amount)`,
        [branch_name, sale_date, cash_amount, card_amount, unpaid_amount, total_amount, expense_amount, net_amount]
      );
      inserted++;
    } catch (e) {
      skipped++;
    }
  }

  return NextResponse.json({ success: true, inserted, skipped });
}
