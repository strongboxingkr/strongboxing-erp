import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      member_id,
      branch_name,
      name,
      phone,
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
      emergency_contact,
      address,
      join_date,
      staff_name,
      attendance_sms_enabled,
      checkin_sms_enabled,
      checkout_sms_enabled,
      has_uniform,
      has_locker,
    } = body;

    if (!member_id) {
      return NextResponse.json({
        success: false,
        message: "member_id가 필요합니다.",
      });
    }

    const [oldRows]: any = await pool.query(
      `
      SELECT *
      FROM members
      WHERE member_id = ?
      LIMIT 1
      `,
      [member_id]
    );

    if (oldRows.length === 0) {
      return NextResponse.json({
        success: false,
        message: "회원을 찾을 수 없습니다.",
      });
    }

    const oldMember = oldRows[0];
    const phoneLast4 = String(phone || oldMember.phone || "").slice(-4);
    const finalCheckinCode = checkin_code || oldMember.checkin_code || phoneLast4;
    const toDate = (v: any) => v ? String(v).slice(0, 10) : null;

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
        emergency_contact = ?,
        address = ?,
        join_date = ?,
        staff_name = ?,
        attendance_sms_enabled = ?,
        checkin_sms_enabled = ?,
        checkout_sms_enabled = ?,
        has_uniform = ?,
        has_locker = ?
      WHERE member_id = ?
      `,
      [
        branch_name || oldMember.branch_name,
        name || oldMember.name,
        phone || oldMember.phone,
        phoneLast4,
        finalCheckinCode,
        product_name || oldMember.product_name,
        pass_type || oldMember.pass_type,
        remaining_count ?? oldMember.remaining_count,
        toDate(start_date || oldMember.start_date),
        toDate(end_date || oldMember.end_date),
        (() => {
          const finalStatus = status || oldMember.status;
          const finalEndDate = toDate(end_date || oldMember.end_date);
          // 만료 상태인데 종료일이 오늘 이후면 자동으로 ACTIVE 복구
          if (finalStatus === "EXPIRED" && finalEndDate && new Date(finalEndDate) >= new Date(new Date().toISOString().slice(0, 10))) {
            return "ACTIVE";
          }
          return finalStatus;
        })(),
        memo ?? oldMember.memo,
        locker_no ?? oldMember.locker_no,
        member_no ?? oldMember.member_no,
        gender ?? oldMember.gender,
        toDate(birth_date || oldMember.birth_date),
        emergency_contact ?? oldMember.emergency_contact,
        address ?? oldMember.address,
        toDate(join_date || oldMember.join_date),
        staff_name ?? oldMember.staff_name,
        attendance_sms_enabled ?? oldMember.attendance_sms_enabled ?? 0,
        checkin_sms_enabled ?? oldMember.checkin_sms_enabled,
        checkout_sms_enabled ?? oldMember.checkout_sms_enabled,
        has_uniform ?? oldMember.has_uniform ?? 0,
        has_locker ?? oldMember.has_locker ?? 0,
        member_id,
      ]
    );

    // 락커번호 변경 시 lockers 테이블 자동 동기화
    const finalLockerNo = locker_no ?? oldMember.locker_no;
    const finalBranch = branch_name || oldMember.branch_name;
    const finalName = name || oldMember.name;
    const finalGender = gender ?? oldMember.gender;
    const finalEndDate = toDate(end_date || oldMember.end_date);
    const finalStartDate = toDate(start_date || oldMember.start_date);

    if (finalLockerNo) {
      // 이전 락커 해제
      if (oldMember.locker_no && oldMember.locker_no !== finalLockerNo) {
        await pool.query(
          `UPDATE lockers SET member_id = NULL, member_name = NULL, gender = NULL, start_date = NULL, end_date = NULL
           WHERE branch_name = ? AND locker_no = ? AND member_id = ?`,
          [finalBranch, oldMember.locker_no, member_id]
        );
      }
      // 새 락커 배정
      await pool.query(
        `INSERT INTO lockers (branch_name, locker_zone, locker_no, member_id, member_name, gender, start_date, end_date)
         VALUES (?, 'A', ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           member_id = VALUES(member_id),
           member_name = VALUES(member_name),
           gender = VALUES(gender),
           start_date = VALUES(start_date),
           end_date = VALUES(end_date)`,
        [finalBranch, finalLockerNo, member_id, finalName, finalGender, finalStartDate, finalEndDate]
      );
    } else if (oldMember.locker_no && locker_no === null) {
      // 락커 삭제된 경우 해제
      await pool.query(
        `UPDATE lockers SET member_id = NULL, member_name = NULL, gender = NULL, start_date = NULL, end_date = NULL
         WHERE branch_name = ? AND locker_no = ? AND member_id = ?`,
        [finalBranch, oldMember.locker_no, member_id]
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
        member_id,
        name || oldMember.name,
        "UPDATE",
        "회원정보 수정",
        JSON.stringify(oldMember),
        JSON.stringify(body),
        staff_name || "관리자",
      ]
    );

    return NextResponse.json({
      success: true,
      message: "회원 수정 완료",
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json({
      success: false,
      message: "회원 수정 실패",
      error,
    });
  }
}