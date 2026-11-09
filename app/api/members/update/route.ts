import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { withMemberChange } from "@/lib/membership-ops";

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

    const finalLockerNo = locker_no ?? oldMember.locker_no;
    const finalBranch = branch_name || oldMember.branch_name;
    const finalName = name || oldMember.name;
    const finalGender = gender ?? oldMember.gender;
    const finalEndDate = toDate(end_date || oldMember.end_date);
    const finalStartDate = toDate(start_date || oldMember.start_date);
    const finalStatus = (() => {
      const s = status || oldMember.status;
      if (s === "EXPIRED" && finalEndDate && new Date(finalEndDate) >= new Date(new Date().toISOString().slice(0, 10))) return "ACTIVE";
      return s;
    })();

    await withMemberChange(
      { type: "CORRECTION", reason: "회원 정보 수정", source: "members/update", actor: staff_name || "직원" },
      async (conn) => {
        await conn.query(
          `UPDATE members SET branch_name=?,name=?,phone=?,phone_last4=?,checkin_code=?,product_name=?,
           pass_type=?,remaining_count=?,start_date=?,end_date=?,status=?,memo=?,locker_no=?,member_no=?,
           gender=?,birth_date=?,emergency_contact=?,address=?,join_date=?,staff_name=?,
           attendance_sms_enabled=?,checkin_sms_enabled=?,checkout_sms_enabled=?,has_uniform=?,has_locker=?
           WHERE member_id=?`,
          [
            finalBranch, finalName, phone || oldMember.phone, phoneLast4, finalCheckinCode,
            product_name || oldMember.product_name, pass_type || oldMember.pass_type,
            remaining_count ?? oldMember.remaining_count, finalStartDate, finalEndDate, finalStatus,
            memo ?? oldMember.memo, finalLockerNo, member_no ?? oldMember.member_no, finalGender,
            toDate(birth_date || oldMember.birth_date), emergency_contact ?? oldMember.emergency_contact,
            address ?? oldMember.address, toDate(join_date || oldMember.join_date),
            staff_name ?? oldMember.staff_name,
            attendance_sms_enabled ?? oldMember.attendance_sms_enabled ?? 0,
            checkin_sms_enabled ?? oldMember.checkin_sms_enabled,
            checkout_sms_enabled ?? oldMember.checkout_sms_enabled,
            has_uniform ?? oldMember.has_uniform ?? 0,
            has_locker ?? oldMember.has_locker ?? 0,
            member_id,
          ]
        );

        // 락커번호 변경 시 lockers 테이블 동기화 (동일 트랜잭션 — 원자성 보장)
        if (finalLockerNo) {
          // 중복 배정 방지: 대상 락커가 다른 회원에게 배정돼 있으면 거부
          const [occupied]: any = await conn.query(
            `SELECT member_id FROM lockers WHERE branch_name=? AND locker_no=? AND member_id IS NOT NULL AND member_id != ? FOR UPDATE`,
            [finalBranch, finalLockerNo, member_id]
          );
          if (occupied.length > 0) {
            throw new Error("LOCKER_OCCUPIED");
          }
          // 이전 락커 해제
          if (oldMember.locker_no && oldMember.locker_no !== finalLockerNo) {
            await conn.query(
              `UPDATE lockers SET member_id=NULL,member_name=NULL,gender=NULL,start_date=NULL,end_date=NULL
               WHERE branch_name=? AND locker_no=? AND member_id=?`,
              [finalBranch, oldMember.locker_no, member_id]
            );
          }
          // 새 락커 배정
          await conn.query(
            `INSERT INTO lockers (branch_name,locker_zone,locker_no,member_id,member_name,gender,start_date,end_date)
             VALUES (?,'A',?,?,?,?,?,?)
             ON DUPLICATE KEY UPDATE member_id=VALUES(member_id),member_name=VALUES(member_name),
               gender=VALUES(gender),start_date=VALUES(start_date),end_date=VALUES(end_date)`,
            [finalBranch, finalLockerNo, member_id, finalName, finalGender, finalStartDate, finalEndDate]
          );
        } else if (oldMember.locker_no && locker_no === null) {
          await conn.query(
            `UPDATE lockers SET member_id=NULL,member_name=NULL,gender=NULL,start_date=NULL,end_date=NULL
             WHERE branch_name=? AND locker_no=? AND member_id=?`,
            [finalBranch, oldMember.locker_no, member_id]
          );
        }

        await conn.query(
          `INSERT INTO member_histories (member_id,member_name,action_type,action_memo,old_value,new_value,created_by)
           VALUES (?,?,?,?,?,?,?)`,
          [member_id, finalName, "UPDATE", "회원정보 수정", JSON.stringify(oldMember), JSON.stringify(body), staff_name || "관리자"]
        );
      }
    );

    return NextResponse.json({ success: true, message: "회원 수정 완료" });
  } catch (error: any) {
    console.error(error);
    if (error?.message === "LOCKER_OCCUPIED") {
      return NextResponse.json({ success: false, message: "해당 락커는 이미 다른 회원에게 배정되어 있습니다." });
    }
    return NextResponse.json({ success: false, message: "회원 수정 실패", error });
  }
}