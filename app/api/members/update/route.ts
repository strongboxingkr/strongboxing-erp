import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { withMemberChange } from "@/lib/membership-ops";
import { getUserFromRequest, canAccessBranch } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ success: false, message: "로그인이 필요합니다." }, { status: 401 });

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
      locker_end_date, // 명시된 경우에만 lockers.end_date 갱신; 생략 시 기존 종료일 유지
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
    // locker_end_date가 요청 body에 명시됐는지 여부 (undefined/null 구분)
    const hasLockerEndDate = Object.prototype.hasOwnProperty.call(body, "locker_end_date");

    if (!member_id) {
      return NextResponse.json({
        success: false,
        message: "member_id가 필요합니다.",
      });
    }

    if (branch_name && !canAccessBranch(user.role, user.branch_name, branch_name)) {
      return NextResponse.json({ success: false, message: "해당 지점에 대한 권한이 없습니다." }, { status: 403 });
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
    // checkin_code 형식 검증: 숫자 1~8자리
    const rawCode = checkin_code || oldMember.checkin_code || phoneLast4;
    if (!/^\d{1,8}$/.test(rawCode)) {
      return NextResponse.json({ success: false, message: "출석번호는 숫자 최대 8자리로 입력해주세요." });
    }
    const finalCheckinCode = rawCode;

    // 같은 지점 내 중복 코드 차단 (본인 제외)
    const [codeConflict]: any = await pool.query(
      `SELECT member_id FROM members WHERE branch_name = ? AND checkin_code = ? AND member_id != ? LIMIT 1`,
      [branch_name || oldMember.branch_name, finalCheckinCode, member_id]
    );
    if (codeConflict.length > 0) {
      return NextResponse.json({ success: false, message: `출석번호 ${finalCheckinCode}는 이미 같은 지점 다른 회원이 사용 중입니다.` });
    }
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

        // 락커 테이블 동기화 (동일 트랜잭션)
        // locker_end_date를 명시한 경우에만 종료일 갱신 — 이름·메모 등 일반 정보 수정 시 락커 기간 유지
        if (finalLockerNo) {
          // 중복 배정 방지: 대상 락커가 다른 회원에게 배정돼 있으면 거부
          const [occupied]: any = await conn.query(
            `SELECT member_id FROM lockers WHERE branch_name=? AND locker_no=? AND member_id IS NOT NULL AND member_id != ? FOR UPDATE`,
            [finalBranch, finalLockerNo, member_id]
          );
          if (occupied.length > 0) {
            throw new Error("LOCKER_OCCUPIED");
          }
          // 이전 락커 해제: lockers.member_id가 현재 회원인 경우에만 해제
          // 불일치(다른 회원 배정) 상태면 건드리지 않음
          if (oldMember.locker_no && oldMember.locker_no !== finalLockerNo) {
            const [prevLock]: any = await conn.query(
              `SELECT member_id FROM lockers WHERE branch_name=? AND locker_no=? FOR UPDATE`,
              [finalBranch, oldMember.locker_no]
            );
            if (prevLock.length > 0 && String(prevLock[0].member_id) === String(member_id)) {
              await conn.query(
                `UPDATE lockers SET member_id=NULL,member_name=NULL,gender=NULL,start_date=NULL,end_date=NULL
                 WHERE branch_name=? AND locker_no=? AND member_id=?`,
                [finalBranch, oldMember.locker_no, member_id]
              );
            }
          }
          // 새 락커 배정: locker_end_date 명시 여부에 따라 end_date 갱신 여부 결정
          if (hasLockerEndDate) {
            await conn.query(
              `INSERT INTO lockers (branch_name,locker_zone,locker_no,member_id,member_name,gender,start_date,end_date)
               VALUES (?,'A',?,?,?,?,?,?)
               ON DUPLICATE KEY UPDATE member_id=VALUES(member_id),member_name=VALUES(member_name),
                 gender=VALUES(gender),start_date=VALUES(start_date),end_date=VALUES(end_date)`,
              [finalBranch, finalLockerNo, member_id, finalName, finalGender, finalStartDate, locker_end_date || null]
            );
          } else {
            // end_date 갱신 없이 식별 정보만 갱신 (기존 락커 종료일 유지)
            await conn.query(
              `INSERT INTO lockers (branch_name,locker_zone,locker_no,member_id,member_name,gender,start_date,end_date)
               VALUES (?,'A',?,?,?,?,?,NULL)
               ON DUPLICATE KEY UPDATE member_id=VALUES(member_id),member_name=VALUES(member_name),
                 gender=VALUES(gender),start_date=VALUES(start_date)`,
              [finalBranch, finalLockerNo, member_id, finalName, finalGender, finalStartDate]
            );
          }
        } else if (oldMember.locker_no && locker_no === null) {
          // 명시적 락커 반납: 불일치 가드 적용
          const [prevLock]: any = await conn.query(
            `SELECT member_id FROM lockers WHERE branch_name=? AND locker_no=? FOR UPDATE`,
            [finalBranch, oldMember.locker_no]
          );
          if (prevLock.length > 0 && String(prevLock[0].member_id) === String(member_id)) {
            await conn.query(
              `UPDATE lockers SET member_id=NULL,member_name=NULL,gender=NULL,start_date=NULL,end_date=NULL
               WHERE branch_name=? AND locker_no=? AND member_id=?`,
              [finalBranch, oldMember.locker_no, member_id]
            );
          }
          // 불일치(lockers.member_id != member_id): lockers는 그대로, members.locker_no만 null로 변경됨
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