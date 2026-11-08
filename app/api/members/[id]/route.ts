import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest, isAdminOrOwner } from "@/lib/auth";

export async function PUT(
  req: Request,
  context: any
) {
  const memberId = context.params.id;

  try {
    const body = await req.json();

    const {
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
      staff_name,
    } = body;

    const [oldRows]: any = await pool.query(
      "SELECT * FROM members WHERE member_id = ?",
      [memberId]
    );

    if (oldRows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "회원을 찾을 수 없습니다.",
        },
        { status: 404 }
      );
    }

    const oldMember = oldRows[0];

    const user = getUserFromRequest(req);

    if (!isAdminOrOwner(user.role) && oldMember.branch_name !== user.branch_name) {
    return NextResponse.json(
        { success: false, message: "다른 지점 회원은 수정할 수 없습니다." },
        { status: 403 }
    );
    }

    if (!isAdminOrOwner(user.role) && oldMember.branch_name !== user.branch_name) {
    return NextResponse.json(
        {
        success: false,
        message: "해당 지점 회원만 수정/삭제할 수 있습니다.",
        },
        { status: 403 }
    );
    }

    // 락커 중복 배정 방지: 같은 지점·같은 번호에 다른 사람이 배정돼 있으면 거부
    if (locker_no) {
      const [dupRows]: any = await pool.query(
        `SELECT member_id FROM lockers WHERE branch_name = ? AND locker_no = ? AND member_id IS NOT NULL AND member_id != ?`,
        [branch_name || oldMember.branch_name, locker_no, memberId]
      );
      if (dupRows.length > 0) {
        return NextResponse.json({ success: false, message: `락카 ${locker_no}번은 이미 다른 회원에게 배정돼 있습니다.` });
      }
    }

    await pool.query(
      `
      UPDATE members
      SET
        branch_name = ?,
        name = ?,
        phone = ?,
        phone_last4 = ?,
        checkin_code = ?,
        product_name = ?,
        pass_type = ?,
        remaining_count = ?,
        start_date = ?,
        end_date = ?,
        status = ?,
        memo = ?,
        locker_no = ?,
        member_no = ?,
        gender = ?,
        birth_date = ?,
        staff_name = ?
      WHERE member_id = ?
      `,
      [
        branch_name,
        name,
        phone,
        phone_last4,
        checkin_code,
        product_name,
        pass_type,
        remaining_count,
        start_date || null,
        end_date || null,
        status,
        memo,
        locker_no || null,
        member_no,
        gender,
        birth_date || null,
        staff_name,
        memberId,
      ]
    );

    // 이전 락커 해제 (번호가 바뀐 경우)
    if (oldMember.locker_no && oldMember.locker_no !== locker_no) {
      await pool.query(
        `UPDATE lockers SET member_id=NULL, member_name=NULL, start_date=NULL, end_date=NULL
         WHERE branch_name=? AND locker_no=? AND member_id=?`,
        [oldMember.branch_name, oldMember.locker_no, memberId]
      );
    }

    // 새 락커 lockers 테이블 동기화
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
        [branch_name || oldMember.branch_name, locker_no, memberId, name, gender || null, start_date || null, end_date || null]
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
        "UPDATE",
        "회원정보 수정",
        JSON.stringify(oldMember),
        JSON.stringify(body),
        staff_name || "관리자",
      ]
    );

    return NextResponse.json({
      success: true,
      message: "회원정보가 수정되었습니다.",
    });

  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: "회원정보 수정 중 오류가 발생했습니다.",
        error,
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  context: any
) {
  const memberId = context.params.id;

  try {
    const [oldRows]: any = await pool.query(
      "SELECT * FROM members WHERE member_id = ?",
      [memberId]
    );

    if (oldRows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "회원을 찾을 수 없습니다.",
        },
        { status: 404 }
      );
    }

    const oldMember = oldRows[0];

    const user = getUserFromRequest(req);

    if (!isAdminOrOwner(user.role) && oldMember.branch_name !== user.branch_name) {
    return NextResponse.json(
        { success: false, message: "다른 지점 회원은 수정할 수 없습니다." },
        { status: 403 }
    );
    }

    if (
    !isAdminOrOwner(user.role) &&
    oldMember.branch_name !== user.branch_name
    ) {
    return NextResponse.json(
        {
        success: false,
        message: "다른 지점 회원은 삭제할 수 없습니다.",
        },
        { status: 403 }
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
        created_by
      )
      VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        memberId,
        oldMember.name,
        "DELETE",
        "회원 삭제",
        JSON.stringify(oldMember),
        "관리자",
      ]
    );

    await pool.query(
      "DELETE FROM members WHERE member_id = ?",
      [memberId]
    );

    return NextResponse.json({
      success: true,
      message: "회원이 삭제되었습니다.",
    });

  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: "회원 삭제 중 오류가 발생했습니다.",
        error,
      },
      { status: 500 }
    );
  }
}