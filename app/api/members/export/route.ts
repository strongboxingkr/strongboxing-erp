import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest, isAdminOrOwner } from "@/lib/auth";
import * as XLSX from "xlsx";

export async function GET(req: Request) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const branch_name = searchParams.get("branch_name");

    let sql = `
      SELECT
        m.member_id, m.name, m.phone, m.birth_date, m.gender, m.address,
        m.product_name, m.start_date, m.end_date, m.remaining_count,
        m.status, m.locker_no, m.has_uniform, m.member_no, m.staff_name,
        m.memo, m.join_date, m.attendance_sms_enabled, m.branch_name,
        l.locker_zone,
        (SELECT MAX(a.checkin_time) FROM attendance a WHERE a.member_id = m.member_id AND a.result = 'SUCCESS') AS last_visit
      FROM members m
      LEFT JOIN lockers l ON l.branch_name = m.branch_name AND l.locker_no = m.locker_no AND l.member_id = m.member_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (isAdminOrOwner(user.role)) {
      if (branch_name) {
        sql += ` AND m.branch_name = ?`;
        params.push(branch_name);
      }
    } else {
      sql += ` AND m.branch_name = ?`;
      params.push(user.branch_name);
    }

    sql += ` ORDER BY m.member_id DESC`;
    const [rows]: any = await pool.query(sql, params);

    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    const sheetData = rows.map((m: any, idx: number) => {
      const endDate = m.end_date ? String(m.end_date).slice(0, 10) : "";
      let remainDays = "";
      if (endDate) {
        const diff = Math.ceil((new Date(endDate).getTime() - today.getTime()) / 86400000);
        remainDays = String(diff);
      }

      const lastVisit = m.last_visit ? String(m.last_visit).slice(0, 10) : "";

      return {
        NO: idx + 1,
        회원명: m.name || "",
        아이디: "",
        생년월일: m.birth_date ? String(m.birth_date).slice(0, 10) : "",
        성별: m.gender === "M" ? "M" : m.gender === "F" ? "F" : "",
        주소: m.address || "",
        전화번호: m.phone || "",
        프로그램: m.product_name || "",
        시작일: m.start_date ? String(m.start_date).slice(0, 10) : "",
        종료일: endDate,
        최종방문일: lastVisit,
        상태: m.status || "",
        잔여일: remainDays,
        잔여횟수: m.remaining_count != null ? String(m.remaining_count) : "",
        옷: m.has_uniform === 1 || m.has_uniform === "1" || m.has_uniform === true ? "O" : "X",
        락카: m.locker_no ? (m.locker_zone ? `${m.locker_zone}-${m.locker_no}` : String(m.locker_no)) : "X",
        "NO ": "",
        회원번호: m.member_no || m.phone?.slice(-4) || "",
        회원번호1: "",
        담당자: m.staff_name || "",
        메모: m.memo || "",
        포인트: "0",
        등록: "",
        가입일: m.join_date ? String(m.join_date).slice(0, 10) : "",
        구분: "",
        문자수신: m.attendance_sms_enabled ? "1" : "0",
      };
    });

    const ws = XLSX.utils.json_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "1");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    const branchLabel = branch_name || (user.branch_name || "전체");
    const dateLabel = todayStr.replace(/-/g, "");
    const filename = encodeURIComponent(`회원목록_${dateLabel}.xlsx`);

    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename*=UTF-8''${filename}`,
      },
    });
  } catch (err) {
    console.error("member export error", err);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
