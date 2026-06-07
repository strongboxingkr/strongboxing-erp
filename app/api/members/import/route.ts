import { NextResponse } from "next/server";
import pool from "@/lib/db";
import * as XLSX from "xlsx";

const cleanPhone = (v: any) =>
  String(v || "").replace(/[^0-9]/g, "");

const toDate = (v: any) => {
  if (!v) return null;

  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }

  const text = String(v).trim().replace(/\./g, "-").replace(/\//g, "-");
  if (!text) return null;

  const d = new Date(text);
  if (isNaN(d.getTime())) return null;

  return d.toISOString().slice(0, 10);
};

const getValue = (row: any, names: string[]) => {
  for (const name of names) {
    if (row[name] !== undefined && row[name] !== null && row[name] !== "") {
      return row[name];
    }
  }
  return "";
};

const normalizeGender = (v: any) => {
  const text = String(v || "").trim().toUpperCase();
  if (text === "M" || text === "남") return "남";
  if (text === "F" || text === "여") return "여";
  return "";
};

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const branchName = String(formData.get("branch_name") || "");

    if (!file) {
      return NextResponse.json({ success: false, message: "엑셀 파일이 없습니다." });
    }

    if (!branchName) {
      return NextResponse.json({ success: false, message: "지점을 선택해주세요." });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    let successCount = 0;
    let skipCount = 0;

    for (const row of rows) {
      const name = String(getValue(row, ["회원명", "이름", "성명", "name"])).trim();
      const phone = cleanPhone(getValue(row, ["전화번호", "휴대폰", "연락처", "phone"]));
      const checkinCode = String(
        getValue(row, ["회원번호", "출석번호", "출석코드", "checkin_code"])
      )
        .replace(/[^0-9]/g, "")
        .slice(-4);

      if (!name || !phone || !checkinCode || checkinCode.length !== 4) {
        skipCount++;
        continue;
      }

      const [dupRows]: any = await pool.query(
        `
        SELECT member_id
        FROM members
        WHERE branch_name = ?
          AND checkin_code = ?
        LIMIT 1
        `,
        [branchName, checkinCode]
      );

      if (dupRows.length > 0) {
        skipCount++;
        continue;
      }

      const [noRows]: any = await pool.query(
        `
        SELECT COALESCE(MAX(CAST(member_no AS UNSIGNED)), 0) + 1 AS next_member_no
        FROM members
        WHERE branch_name = ?
          AND member_no REGEXP '^[0-9]+$'
        `,
        [branchName]
      );

      const nextMemberNo = String(noRows[0].next_member_no);

      const productName = String(getValue(row, ["프로그램", "상품", "회원권", "product_name"])).trim();
      const remainingCount = Number(getValue(row, ["잔여횟수", "남은횟수", "remaining_count"]) || 0);

      const passType = remainingCount > 0 ? "COUNT" : "PERIOD";

      await pool.query(
        `
        INSERT INTO members (
          branch_name,
          member_no,
          name,
          phone,
          emergency_contact,
          checkin_code,
          product_name,
          pass_type,
          remaining_count,
          start_date,
          end_date,
          status,
          memo,
          locker_no,
          gender,
          birth_date,
          join_date,
          staff_name,
          checkin_sms_enabled,
          checkout_sms_enabled
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          branchName,
          nextMemberNo,
          name,
          phone,
          cleanPhone(getValue(row, ["비상연락처", "보호자", "보호자연락처", "emergency_contact"])) || null,
          checkinCode,
          productName || null,
          passType,
          remainingCount,
          toDate(getValue(row, ["시작일", "등록일", "start_date"])),
          toDate(getValue(row, ["종료일", "만료일", "end_date"])),
          String(getValue(row, ["메모", "memo"]) || ""),
          String(getValue(row, ["락카번호", "락커번호", "locker_no"]) || "") || null,
          normalizeGender(getValue(row, ["성별", "gender"])),
          toDate(getValue(row, ["생년월일", "생일", "birth_date"])),
          toDate(getValue(row, ["가입일", "join_date"])) || toDate(getValue(row, ["시작일", "등록일", "start_date"])),
          String(getValue(row, ["담당자", "staff_name"]) || "") || null,
          0,
          0,
        ]
      );

      successCount++;
    }

    return NextResponse.json({
      success: true,
      message: `회원 업로드 완료: ${successCount}명 등록, ${skipCount}명 제외`,
      successCount,
      skipCount,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({
      success: false,
      message: "회원 엑셀 업로드 실패",
      error,
    });
  }
}