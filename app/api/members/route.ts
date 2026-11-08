import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest, isAdminOrOwner } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const user = getUserFromRequest(req);

    const { searchParams } = new URL(req.url);
    const branch_name = searchParams.get("branch_name");
    const search = searchParams.get("search");

    let sql = `
      SELECT m.*,
        (SELECT COUNT(*) FROM payments p WHERE p.member_id = m.member_id AND p.final_amount > 0) AS payment_count
      FROM members m
      WHERE 1=1
    `;

    const params: any[] = [];

    if (isAdminOrOwner(user.role)) {
      if (branch_name) {
        sql += ` AND m.branch_name = ? `;
        params.push(branch_name);
      }
    } else {
      if (!user.branch_name) {
        return NextResponse.json({
          success: false,
          message: "지점 정보가 없습니다.",
        });
      }

      sql += ` AND m.branch_name = ? `;
      params.push(user.branch_name);
    }

    if (search) {
      sql += `
        AND (
          m.name LIKE ?
          OR m.phone LIKE ?
          OR m.checkin_code LIKE ?
          OR m.product_name LIKE ?
          OR m.memo LIKE ?
          OR m.locker_no LIKE ?
          OR m.member_no LIKE ?
          OR m.staff_name LIKE ?
        )
      `;

      const keyword = `%${search}%`;
      params.push(
        keyword,
        keyword,
        keyword,
        keyword,
        keyword,
        keyword,
        keyword,
        keyword
      );
    }

    sql += ` ORDER BY m.member_id DESC `;

    const [rows]: any = await pool.query(sql, params);

    return NextResponse.json({
      success: true,
      rows,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: "회원 목록 조회 실패",
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
      name,
      phone,
      product_name,
      pass_type,
      remaining_count,
      start_date,
      end_date,
      status,
      memo,
      locker_no,
      member_no,
      gender,
      birth_date,
      staff_name,
    } = body;

    const finalBranchName = isAdminOrOwner(user.role)
      ? branch_name
      : user.branch_name;

    if (!finalBranchName || !name || !phone || !pass_type) {
      return NextResponse.json({
        success: false,
        message: "지점명, 이름, 전화번호, 회원권 타입은 필수입니다.",
      });
    }

    const normalizedPhone = String(phone).replace(/[^0-9]/g, "");
    const phoneLast4 = normalizedPhone.slice(-4);
    const checkinCode = phoneLast4;
    const finalStaffName = staff_name || "관리자";

    // 락커 중복 배정 방지
    if (locker_no) {
      const [dupRows]: any = await pool.query(
        `SELECT member_id FROM lockers WHERE branch_name = ? AND locker_no = ? AND member_id IS NOT NULL`,
        [finalBranchName, locker_no]
      );
      if (dupRows.length > 0) {
        return NextResponse.json({ success: false, message: `락카 ${locker_no}번은 이미 다른 회원에게 배정돼 있습니다.` });
      }
    }

    const [result]: any = await pool.query(
      `
      INSERT INTO members (
        branch_name,
        name,
        phone,
        phone_last4,
        checkin_code,
        product_name,
        pass_type,
        remaining_count,
        start_date,
        end_date,
        status,
        memo,
        locker_no,
        member_no,
        gender,
        birth_date,
        staff_name
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        finalBranchName,
        name,
        normalizedPhone,
        phoneLast4,
        checkinCode,
        product_name || null,
        pass_type,
        remaining_count || 0,
        start_date || null,
        end_date || null,
        status || "ACTIVE",
        memo || null,
        locker_no || null,
        member_no || null,
        gender || null,
        birth_date || null,
        finalStaffName,
      ]
    );

    const memberId = result.insertId;

    // 락커번호 입력 시 lockers 테이블 자동 동기화
    if (locker_no) {
      await pool.query(
        `INSERT INTO lockers (branch_name, locker_zone, locker_no, member_id, member_name, gender, start_date, end_date)
         VALUES (?, 'A', ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           member_id = VALUES(member_id),
           member_name = VALUES(member_name),
           gender = VALUES(gender),
           start_date = VALUES(start_date),
           end_date = VALUES(end_date)`,
        [finalBranchName, locker_no, memberId, name, gender || null, start_date || null, end_date || null]
      );
    }

    await pool.query(
      `
      INSERT INTO member_histories (
        member_id,
        member_name,
        action_type,
        action_memo,
        old_value,
        new_value,
        created_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        memberId,
        name,
        "REGISTER",
        "회원 등록",
        null,
        JSON.stringify(body),
        finalStaffName,
      ]
    );

    return NextResponse.json({
      success: true,
      message: "회원이 등록되었습니다.",
      member_id: memberId,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: "회원 등록 실패",
        error,
      },
      { status: 500 }
    );
  }
}