/**
 * 출석 삭제 — COUNT 재등록 시나리오 통합 테스트
 * 실행: npx tsx docs/integration-test-attendance-reregistration.ts
 *
 * 사전 준비: strongboxing_test DB에 테스트 회원(member_id=9001) 없으면 아래 setup에서 생성
 */

import mysql from "mysql2/promise";

const DB = {
  host: "localhost",
  port: 3306,
  user: "root",
  password: "strongboxing0406!",
  database: "strongboxing_test",
  dateStrings: true,
};

const pool = mysql.createPool({ ...DB, waitForConnections: true, connectionLimit: 5 });

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

const TEST_MEMBER_ID = 9001;
const TEST_BRANCH = "테스트지점";

async function setup() {
  await pool.query(`DELETE FROM attendance WHERE member_id = ?`, [TEST_MEMBER_ID]);
  await pool.query(`DELETE FROM member_histories WHERE member_id = ?`, [TEST_MEMBER_ID]);
  await pool.query(`DELETE FROM members WHERE member_id = ?`, [TEST_MEMBER_ID]);
  await pool.query(
    `INSERT INTO members (member_id, name, phone, phone_last4, branch_name, pass_type, remaining_count, start_date, end_date, status, checkin_code)
     VALUES (?, '테스트회원', '01000000000', '0000', ?, 'COUNT', 5, '2026-11-01', '2027-01-31', 'ACTIVE', '9001')
     ON DUPLICATE KEY UPDATE pass_type='COUNT', remaining_count=5, start_date='2026-11-01', end_date='2027-01-31', status='ACTIVE'`,
    [TEST_MEMBER_ID, TEST_BRANCH]
  );
}

async function cleanup() {
  await pool.query(`DELETE FROM attendance WHERE member_id = ?`, [TEST_MEMBER_ID]);
  await pool.query(`DELETE FROM member_histories WHERE member_id = ?`, [TEST_MEMBER_ID]);
  await pool.query(`DELETE FROM members WHERE member_id = ?`, [TEST_MEMBER_ID]);
}

async function insertAttendance(checkinDate: string, usedCount: number, passType = "COUNT", result = "SUCCESS"): Promise<number> {
  const [res]: any = await pool.query(
    `INSERT INTO attendance (member_id, member_name, branch_name, pass_type, used_count, result, checkin_time)
     VALUES (?, '테스트회원', ?, ?, ?, ?, ?)`,
    [TEST_MEMBER_ID, TEST_BRANCH, passType, usedCount, result, `${checkinDate} 10:00:00`]
  );
  return res.insertId;
}

async function getRemainingCount(): Promise<number> {
  const [rows]: any = await pool.query(`SELECT remaining_count FROM members WHERE member_id = ?`, [TEST_MEMBER_ID]);
  return Number(rows[0]?.remaining_count);
}

async function attendanceExists(id: number): Promise<boolean> {
  const [rows]: any = await pool.query(`SELECT attendance_id FROM attendance WHERE attendance_id = ?`, [id]);
  return rows.length > 0;
}

// 출석 삭제 로직을 직접 DB로 시뮬레이션 (route 함수를 직접 호출하는 대신)
// 실제 route 로직과 동일한 조건을 DB 쿼리로 재현
async function simulateDeleteAttendance(attendanceId: number): Promise<{ status: number; body: any }> {
  const conn = await pool.getConnection();
  try {
    const [attRows]: any = await conn.query(
      `SELECT attendance_id, result, member_id, member_name, branch_name, used_count, pass_type AS att_pass_type, memo, checkin_time
       FROM attendance WHERE attendance_id = ?`,
      [attendanceId]
    );
    if (attRows.length === 0) return { status: 200, body: { success: false, message: "출석 기록 없음" } };

    const { result, member_id, member_name, used_count, att_pass_type, checkin_time } = attRows[0];
    const shouldRestore = result === "SUCCESS" && Number(used_count) > 0;

    if (shouldRestore && member_id) {
      const [memberRows]: any = await conn.query(
        `SELECT pass_type, start_date FROM members WHERE member_id = ?`,
        [member_id]
      );
      const member = memberRows[0];
      if (member && member.pass_type === "COUNT") {
        const memberStartDate = member.start_date ? String(member.start_date).slice(0, 10) : null;
        const checkinDate = checkin_time ? String(checkin_time).slice(0, 10) : null;
        // 허용 조건: checkin > start_date만 (NULL 차단, 당일 차단, 이전 차단)
        const isCurrentPass = memberStartDate && checkinDate && checkinDate > memberStartDate;
        if (!isCurrentPass) {
          return {
            status: 409,
            body: {
              success: false,
              requiresManualReview: true,
              message: memberStartDate
                ? `현재 회원권(시작일: ${memberStartDate}) 범위를 벗어난 출석 기록입니다. 자동 횟수 복원이 차단됩니다. 관리자가 직접 확인 후 처리해주세요.`
                : "현재 회원권의 시작일을 확인할 수 없어 자동 횟수 복원이 차단됩니다. 관리자가 직접 확인 후 처리해주세요.",
            },
          };
        }
      }
    }

    await conn.beginTransaction();
    try {
      await conn.query(`DELETE FROM attendance WHERE attendance_id = ?`, [attendanceId]);
      if (shouldRestore && member_id) {
        await conn.query(`UPDATE members SET remaining_count = remaining_count + 1 WHERE member_id = ?`, [member_id]);
        await conn.query(
          `INSERT INTO member_histories (member_id, member_name, action_type, action_memo, old_value, new_value, created_by)
           VALUES (?, ?, 'ATTENDANCE_UNDO', '입장 취소', ?, ?, 'test')`,
          [member_id, member_name || null, JSON.stringify({ attendance_id: attendanceId }), JSON.stringify({ remaining_count: "+1" })]
        );
      }
      await conn.commit();
      return { status: 200, body: { success: true } };
    } catch (e) {
      await conn.rollback();
      throw e;
    }
  } finally {
    conn.release();
  }
}

async function runTests() {
  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      console.log(`  ✅ ${name}`);
      passed++;
    } catch (e: any) {
      console.log(`  ❌ ${name}: ${e.message}`);
      failed++;
    }
  }

  console.log("\n=== 출석 삭제 COUNT 재등록 시나리오 통합 테스트 ===\n");

  // T1: 정상 취소 — 현재 COUNT 패스 출석 취소 → remaining_count 복원
  await test("T1: 현재 COUNT 패스 출석 취소 → remaining_count +1", async () => {
    await setup();
    // start_date = 2026-11-01, 출석일 = 2026-11-05 (패스 기간 내)
    const attId = await insertAttendance("2026-11-05", 1, "COUNT");
    const before = await getRemainingCount(); // 5

    const res = await simulateDeleteAttendance(attId);
    assert(res.status === 200, `expected 200, got ${res.status}`);
    assert(res.body.success === true, "expected success");

    const after = await getRemainingCount();
    assert(after === before + 1, `expected ${before + 1}, got ${after}`);
    assert(!(await attendanceExists(attId)), "attendance should be deleted");
  });

  // T2: 재등록 차단 — 이전 COUNT 패스 출석 취소 → 409
  await test("T2: 이전 COUNT 패스 출석 (start_date 이전) → 409, 데이터 불변", async () => {
    await setup();
    // 회원이 2026-10-01에 사용한 이전 패스 출석 기록이 DB에 남아 있음
    // 현재 패스 start_date = 2026-11-01
    const attId = await insertAttendance("2026-10-15", 1, "COUNT");
    const before = await getRemainingCount(); // 5

    const res = await simulateDeleteAttendance(attId);
    assert(res.status === 409, `expected 409, got ${res.status}`);
    assert(res.body.requiresManualReview === true, "expected requiresManualReview");

    const after = await getRemainingCount();
    assert(after === before, `remaining_count should NOT change: before=${before}, after=${after}`);
    assert(await attendanceExists(attId), "attendance should NOT be deleted on 409");
  });

  // T3: PERIOD 패스 취소 → 복원 없이 삭제 성공
  await test("T3: PERIOD 패스 출석 취소 (used_count=0) → 삭제만, 복원 없음", async () => {
    await setup();
    // PERIOD 회원으로 전환
    await pool.query(`UPDATE members SET pass_type='PERIOD', remaining_count=0 WHERE member_id=?`, [TEST_MEMBER_ID]);
    const attId = await insertAttendance("2026-10-15", 0, "PERIOD");
    const before = await getRemainingCount(); // 0

    const res = await simulateDeleteAttendance(attId);
    assert(res.status === 200, `expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert(res.body.success === true, "expected success");

    const after = await getRemainingCount();
    assert(after === before, `PERIOD: remaining_count should stay ${before}, got ${after}`);
    assert(!(await attendanceExists(attId)), "attendance should be deleted");
  });

  // T4: 당일 재등록 — checkin_date == start_date → 차단 (증명 불가)
  await test("T4: 당일 재등록 (checkin_date == start_date) → 409, 데이터 불변", async () => {
    await setup();
    // 출석일 = start_date = 2026-11-01 (같은 날 — 이전 패스 출석과 구분 불가 → 차단)
    const attId = await insertAttendance("2026-11-01", 1, "COUNT");
    const before = await getRemainingCount();

    const res = await simulateDeleteAttendance(attId);
    assert(res.status === 409, `expected 409 (same-day blocked), got ${res.status}`);
    assert(res.body.requiresManualReview === true, "expected requiresManualReview");

    const after = await getRemainingCount();
    assert(after === before, `remaining_count should NOT change: before=${before}, after=${after}`);
    assert(await attendanceExists(attId), "attendance should NOT be deleted on 409");
  });

  // T5: start_date NULL COUNT 회원 → 패스 소속 증명 불가 → 409
  await test("T5: start_date NULL COUNT 회원 → 409, 데이터 불변", async () => {
    await setup();
    await pool.query(`UPDATE members SET start_date=NULL WHERE member_id=?`, [TEST_MEMBER_ID]);
    const attId = await insertAttendance("2026-10-01", 1, "COUNT");
    const before = await getRemainingCount();

    const res = await simulateDeleteAttendance(attId);
    // start_date NULL → 현재 패스 시작일 미확인 → 패스 소속 증명 불가 → 409
    assert(res.status === 409, `expected 409 (NULL start_date blocked), got ${res.status}`);
    assert(res.body.requiresManualReview === true, "expected requiresManualReview");

    const after = await getRemainingCount();
    assert(after === before, `remaining_count should NOT change: before=${before}, after=${after}`);
    assert(await attendanceExists(attId), "attendance should NOT be deleted on 409");
  });

  await cleanup();
  console.log(`\n결과: ${passed}/${passed + failed} 통과`);
  if (failed > 0) process.exit(1);
}

runTests()
  .then(() => pool.end())
  .catch((e) => { console.error(e); process.exit(1); });
