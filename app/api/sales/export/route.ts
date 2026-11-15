import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest, isAdminOrOwner } from "@/lib/auth";
// @ts-ignore
import * as XLSX from "xlsx";

export async function GET(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminOrOwner(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("mode") || "monthly"; // daily | monthly | annual
  const year = searchParams.get("year") || String(new Date().getFullYear());
  const month = searchParams.get("month") || String(new Date().getMonth() + 1);
  const date = searchParams.get("date") || new Date().toISOString().slice(0, 10);
  const branch_name = searchParams.get("branch_name") || null; // null = all

  const branchWhere = branch_name ? "AND p.branch_name = ?" : "";
  const branchParams: any[] = branch_name ? [branch_name] : [];
  const branchLabel = branch_name || "전체 지점";

  const fmt = (n: any) => Number(n || 0);

  let wb: XLSX.WorkBook;

  if (mode === "daily") {
    // ── 일별 상세 ──────────────────────────────
    const [rows]: any = await pool.query(
      `SELECT p.payment_id, p.payment_date, p.created_at, p.payment_method,
              p.product_name, p.amount, p.discount_amount, p.final_amount, p.memo,
              p.branch_name, m.name AS member_name
       FROM payments p
       LEFT JOIN members m ON p.member_id = m.member_id
       WHERE DATE(p.payment_date) = ? AND p.final_amount > 0 ${branchWhere}
       ORDER BY p.payment_id DESC`,
      [date, ...branchParams]
    );

    const METHOD: Record<string, string> = { CASH: "현금", CARD: "카드", TRANSFER: "계좌이체" };
    const data: any[][] = [
      [`${branchLabel}  ${date} 일별 매출`],
      [],
      ["No", "지점", "회원명", "상품명", "결제수단", "정가", "할인", "실결제액", "결제시각", "메모"],
    ];
    rows.forEach((r: any, i: number) => {
      data.push([
        i + 1,
        r.branch_name || "",
        r.member_name || "",
        r.product_name || "",
        METHOD[r.payment_method] || r.payment_method || "",
        fmt(r.amount),
        fmt(r.discount_amount),
        fmt(r.final_amount),
        r.created_at ? String(r.created_at).slice(11, 16) : "",
        r.memo || "",
      ]);
    });

    // 합계
    const cashSum = rows.reduce((s: number, r: any) => r.payment_method === "CASH" ? s + fmt(r.final_amount) : s, 0);
    const cardSum = rows.reduce((s: number, r: any) => r.payment_method === "CARD" ? s + fmt(r.final_amount) : s, 0);
    const trfSum  = rows.reduce((s: number, r: any) => r.payment_method === "TRANSFER" ? s + fmt(r.final_amount) : s, 0);
    const totalSum = rows.reduce((s: number, r: any) => s + fmt(r.final_amount), 0);
    data.push([]);
    data.push(["", "", "", "", "현금", cashSum, "", "", "", ""]);
    data.push(["", "", "", "", "카드", cardSum, "", "", "", ""]);
    data.push(["", "", "", "", "계좌이체", trfSum, "", "", "", ""]);
    data.push(["합계", "", "", "", "", "", "", totalSum, "", ""]);

    wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = [{ wch: 5 }, { wch: 10 }, { wch: 12 }, { wch: 20 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 8 }, { wch: 20 }];
    applyNumberFmt(ws, data, [5, 6, 7], 3); // 열 F,G,H (0-indexed 5,6,7) → rows starting at index 3
    XLSX.utils.book_append_sheet(wb, ws, "일별매출");

  } else if (mode === "monthly") {
    // ── 월별 ──────────────────────────────────
    const [rows]: any = await pool.query(
      `SELECT DATE_FORMAT(p.payment_date,'%Y-%m-%d') AS sale_date,
              IFNULL(SUM(CASE WHEN p.payment_method='CASH' THEN p.final_amount ELSE 0 END),0) AS cash_amount,
              IFNULL(SUM(CASE WHEN p.payment_method='CARD' THEN p.final_amount ELSE 0 END),0) AS card_amount,
              IFNULL(SUM(CASE WHEN p.payment_method='TRANSFER' THEN p.final_amount ELSE 0 END),0) AS transfer_amount,
              IFNULL(SUM(CASE WHEN p.payment_method NOT IN ('CASH','CARD','TRANSFER') THEN p.final_amount ELSE 0 END),0) AS other_amount,
              IFNULL(SUM(p.final_amount),0) AS total_amount, COUNT(*) AS count
       FROM payments p
       WHERE YEAR(p.payment_date)=? AND MONTH(p.payment_date)=? AND p.final_amount>0 ${branchWhere}
       GROUP BY sale_date ORDER BY sale_date`,
      [year, month, ...branchParams]
    );

    const data: any[][] = [
      [`${branchLabel}`, `${year}년 ${month}월 월별 매출`, "", "", "", "", "", "(단위: 원)"],
      [],
      ["날짜", "현금매출", "카드매출", "계좌이체매출", "기타결제매출", "총매출", "지출", "차액(매출-등록지출)"],
    ];
    let tc = 0, tca = 0, tt = 0, to = 0, ttot = 0;
    rows.forEach((r: any) => {
      const cash = fmt(r.cash_amount), card = fmt(r.card_amount), trf = fmt(r.transfer_amount), oth = fmt(r.other_amount), tot = fmt(r.total_amount);
      tc += cash; tca += card; tt += trf; to += oth; ttot += tot;
      data.push([r.sale_date, cash, card, trf, oth, tot, "미집계", ""]);
    });
    data.push([]);
    data.push(["합계", tc, tca, tt, to, ttot, "미집계", ""]);

    wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = [{ wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 20 }];
    applyNumberFmt(ws, data, [1, 2, 3, 4, 5], 3);
    XLSX.utils.book_append_sheet(wb, ws, "월별매출");

  } else {
    // ── 연별 ──────────────────────────────────
    const [rows]: any = await pool.query(
      `SELECT MONTH(p.payment_date) AS month_num,
              IFNULL(SUM(CASE WHEN p.payment_method='CASH' THEN p.final_amount ELSE 0 END),0) AS cash_amount,
              IFNULL(SUM(CASE WHEN p.payment_method='CARD' THEN p.final_amount ELSE 0 END),0) AS card_amount,
              IFNULL(SUM(CASE WHEN p.payment_method='TRANSFER' THEN p.final_amount ELSE 0 END),0) AS transfer_amount,
              IFNULL(SUM(CASE WHEN p.payment_method NOT IN ('CASH','CARD','TRANSFER') THEN p.final_amount ELSE 0 END),0) AS other_amount,
              IFNULL(SUM(p.final_amount),0) AS total_amount
       FROM payments p
       WHERE YEAR(p.payment_date)=? AND p.final_amount>0 ${branchWhere}
       GROUP BY month_num ORDER BY month_num`,
      [year, ...branchParams]
    );

    const byMonth: Record<number, any> = {};
    rows.forEach((r: any) => { byMonth[Number(r.month_num)] = r; });

    const data: any[][] = [
      [`${branchLabel}`, `${year}년 연별 매출`, "", "", "", "", "", "(단위: 원)"],
      [],
      ["연도", "월", "현금매출", "카드매출", "계좌이체매출", "기타결제매출", "총매출", "지출", "차액(매출-등록지출)"],
    ];
    let tc = 0, tca = 0, tt = 0, to = 0, ttot = 0;
    for (let m = 1; m <= 12; m++) {
      const r = byMonth[m];
      const cash = r ? fmt(r.cash_amount) : 0;
      const card = r ? fmt(r.card_amount) : 0;
      const trf  = r ? fmt(r.transfer_amount) : 0;
      const oth  = r ? fmt(r.other_amount) : 0;
      const tot  = r ? fmt(r.total_amount) : 0;
      tc += cash; tca += card; tt += trf; to += oth; ttot += tot;
      data.push([year, `${m}월`, cash, card, trf, oth, tot, "미집계", ""]);
    }
    data.push([]);
    data.push(["합계", "", tc, tca, tt, to, ttot, "미집계", ""]);

    wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = [{ wch: 8 }, { wch: 6 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 20 }];
    applyNumberFmt(ws, data, [2, 3, 4, 5, 6], 3);
    XLSX.utils.book_append_sheet(wb, ws, "연별매출");
  }

  const modeLabel = mode === "daily" ? "일별" : mode === "monthly" ? "월별" : "연별";
  const periodLabel = mode === "daily" ? date : mode === "monthly" ? `${year}-${month.padStart(2, "0")}` : year;
  const safeB = (branch_name || "전체").replace(/[\\/:*?"<>|]/g, "_");
  const filename = `매출_${modeLabel}_${safeB}_${periodLabel}.xlsx`;

  const buf: Buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new Response(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}

// 숫자 열에 천 단위 형식 적용
function applyNumberFmt(ws: any, data: any[][], colIndices: number[], startRow: number) {
  const totalRows = data.length;
  for (let r = startRow; r < totalRows; r++) {
    for (const c of colIndices) {
      const cell = XLSX.utils.encode_cell({ r, c });
      if (ws[cell] && typeof ws[cell].v === "number") {
        ws[cell].t = "n";
        ws[cell].z = '#,##0';
      }
    }
  }
}
