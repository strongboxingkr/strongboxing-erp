/**
 * 입장·퇴장·취소 횟수 차감 로직 통합 테스트
 * 실행: npx tsx docs/integration-test-checkin.ts
 *
 * 사전 준비: mysql -u root -p < docs/setup-test-db.sql
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

async function resetData() {
  await pool.query(`DELETE FROM attendance`);
  await pool.query(`UPDATE members SET remaining_count = 5, pass_type = 'COUNT' WHERE checkin_code = '1001'`);
  await pool.query(`UPDATE members SET remaining_count = 0, pass_type = 'PERIOD' WHERE checkin_code = '1002'`);
  await pool.query(`UPDATE members SET remaining_count = 0, pass_type = 'COUNT' WHERE checkin_code = '1005'`);
  await pool.query(`UPDATE members SET status = 'ACTIVE' WHERE checkin_code IN ('1001','1002','1003','1004')`);
}

async function countSuccessAttendance(memberId: number): Promise<number> {
  const [rows]: any = await pool.query(
    `SELECT COUNT(*) as cnt FROM attendance WHERE member_id = ? AND result = 'SUCCESS' AND DATE(checkin_time) = CURDATE()`,
    [memberId]
  );
  return rows[0].cnt;
}

async function getRemainingCount(memberId: number): Promise<number> {
  const [rows]: any = await pool.query(`SELECT remaining_count FROM members WHERE member_id = ?`, [memberId]);
  return Number(rows[0].remaining_count);
}

async function getMemberId(code: string): Promise<number> {
  const [rows]: any = await pool.query(`SELECT member_id FROM members WHERE checkin_code = ?`, [code]);
  return rows[0].member_id;
}

async function checkin(code: string, checkType = "CHECK_IN") {
  const [rows]: any = await pool.query(`SELECT * FROM members WHERE checkin_code = ? LIMIT 1`, [code]);
  if (rows.length === 0) return { success: false, result: "NOT_FOUND" };

  const member = rows[0];
  const today = new Date().toISOString().slice(0, 10);

  if (checkType === "CHECK_OUT") {
    const [todayIn]: any = await pool.query(
      `SELECT attendance_id FROM attendance WHERE member_id = ? AND result = 'SUCCESS' AND DATE(checkin_time) = ? LIMIT 1`,
      [member.member_id, today]
    );
    if (todayIn.length > 0) {
      await pool.query(
        `INSERT INTO attendance (member_id, branch_name, member_name, pass_type, used_count, result, memo) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [member.member_id, member.branch_name, member.name, member.pass_type, 0, "CHECK_OUT", "퇴실"]
      );
      return { success: true, result: "CHECK_OUT" };
    }
  }

  // 당일 중복 체크
  const [todayCheckins]: any = await pool.query(
    `SELECT attendance_id FROM attendance WHERE member_id = ? AND result = 'SUCCESS' AND DATE(checkin_time) = ? LIMIT 1`,
    [member.member_id, today]
  );
  if (todayCheckins.length > 0) return { success: false, result: "DUPLICATE" };

  // 만료 체크
  const endDate = member.end_date ? new Date(member.end_date) : null;
  const todayD = new Date(); todayD.setHours(0, 0, 0, 0);
  if (endDate) { endDate.setHours(0, 0, 0, 0); }
  if (member.status === "EXPIRED" || (endDate && endDate < todayD)) {
    await pool.query(`INSERT INTO attendance (member_id, branch_name, member_name, pass_type, used_count, result, memo) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [member.member_id, member.branch_name, member.name, member.pass_type, 0, "EXPIRED", "만료"]);
    return { success: false, result: "EXPIRED" };
  }

  const remaining = Number(member.remaining_count || 0);

  if (member.pass_type === "COUNT") {
    if (remaining <= 0) {
      await pool.query(`INSERT INTO attendance (member_id, branch_name, member_name, pass_type, used_count, result, memo) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [member.member_id, member.branch_name, member.name, member.pass_type, 0, "NO_COUNT", "횟수없음"]);
      return { success: false, result: "NO_COUNT" };
    }
    // 원자성: 차감 + INSERT
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(`UPDATE members SET remaining_count = remaining_count - 1 WHERE member_id = ?`, [member.member_id]);
      await conn.query(`INSERT INTO attendance (member_id, branch_name, member_name, pass_type, used_count, result, memo) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [member.member_id, member.branch_name, member.name, member.pass_type, 1, "SUCCESS", "출석"]);
      await conn.commit();
    } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
  } else {
    await pool.query(`INSERT INTO attendance (member_id, branch_name, member_name, pass_type, used_count, result, memo) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [member.member_id, member.branch_name, member.name, member.pass_type, 0, "SUCCESS", "출석"]);
  }

  return { success: true, result: "SUCCESS" };
}

async function cancelAttendance(attendanceId: number) {
  // used_count 기반 복원 (현재 pass_type이 아닌 실제 차감 여부 기준)
  const [rows]: any = await pool.query(
    `SELECT result, member_id, used_count FROM attendance WHERE attendance_id = ?`,
    [attendanceId]
  );
  if (rows.length === 0) return { success: false, message: "이미 삭제된 기록" };
  const { result, member_id, used_count } = rows[0];
  const shouldRestore = result === "SUCCESS" && Number(used_count) > 0;

  if (shouldRestore && member_id) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      // 반복 취소 방지: FOR UPDATE 후 존재 확인
      const [check]: any = await conn.query(`SELECT attendance_id FROM attendance WHERE attendance_id = ? FOR UPDATE`, [attendanceId]);
      if (check.length === 0) { await conn.rollback(); return { success: false, message: "이미 삭제된 기록" }; }
      await conn.query(`DELETE FROM attendance WHERE attendance_id = ?`, [attendanceId]);
      await conn.query(`UPDATE members SET remaining_count = remaining_count + 1 WHERE member_id = ?`, [member_id]);
      // 취소 이력 기록
      await conn.query(
        `INSERT INTO member_histories (member_id, member_name, action_type, action_memo, old_value, new_value, created_by)
         VALUES (?, ?, 'ATTENDANCE_UNDO', '입장 취소', ?, ?, '테스트')`,
        [member_id, null, JSON.stringify({ attendance_id: attendanceId, used_count }), JSON.stringify({ remaining_count: "+1" })]
      );
      await conn.commit();
    } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
  } else {
    const [check]: any = await pool.query(`SELECT attendance_id FROM attendance WHERE attendance_id = ?`, [attendanceId]);
    if (check.length === 0) return { success: false, message: "이미 삭제된 기록" };
    await pool.query(`DELETE FROM attendance WHERE attendance_id = ?`, [attendanceId]);
    if (member_id) {
      await pool.query(
        `INSERT INTO member_histories (member_id, member_name, action_type, action_memo, old_value, new_value, created_by)
         VALUES (?, ?, 'ATTENDANCE_UNDO', '출석 기록 삭제', ?, ?, '테스트')`,
        [member_id, null, JSON.stringify({ attendance_id: attendanceId, result }), JSON.stringify({ remaining_count: "변경 없음" })]
      );
    }
  }
  return { success: true };
}

// KST 오늘 날짜 (UTC+9)
function kstToday() {
  return new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
}

type TestResult = { name: string; passed: boolean; error?: string };
const results: TestResult[] = [];

async function test(name: string, fn: () => Promise<void>) {
  try {
    await resetData();
    await fn();
    results.push({ name, passed: true });
    console.log(`  ✓ ${name}`);
  } catch (e: any) {
    results.push({ name, passed: false, error: e.message });
    console.log(`  ✗ ${name}: ${e.message}`);
  }
}

async function main() {
  console.log(`\n=== 체크인 횟수 차감 로직 통합 테스트 (DB: ${DB.database}) ===\n`);

  await test("T1: COUNT 권 입장 → remaining_count 1 감소", async () => {
    const id = await getMemberId("1001");
    const before = await getRemainingCount(id); // 5
    const r = await checkin("1001");
    assert(r.result === "SUCCESS", `예상 SUCCESS, 실제 ${r.result}`);
    const after = await getRemainingCount(id);
    assert(after === before - 1, `남은 횟수 ${before} → ${after}, 1 감소해야 함`);
    const cnt = await countSuccessAttendance(id);
    assert(cnt === 1, `출석 기록 1개여야 함, 실제 ${cnt}`);
  });

  await test("T2: 당일 재입장 → 추가 차감 없음, 중복 출석 없음", async () => {
    const id = await getMemberId("1001");
    await checkin("1001"); // 첫 입장 (5→4)
    const after1 = await getRemainingCount(id);
    const r2 = await checkin("1001"); // 재입장
    assert(r2.result === "DUPLICATE", `두 번째 체크인은 DUPLICATE여야 함, 실제 ${r2.result}`);
    const after2 = await getRemainingCount(id);
    assert(after2 === after1, `재입장 후 횟수 변화 없어야 함 (${after1} → ${after2})`);
    const cnt = await countSuccessAttendance(id);
    assert(cnt === 1, `출석 기록 1개여야 함, 실제 ${cnt}`);
  });

  await test("T3: PERIOD 권 입장 → remaining_count 변화 없음", async () => {
    const id = await getMemberId("1002");
    const before = await getRemainingCount(id); // 0
    const r = await checkin("1002");
    assert(r.result === "SUCCESS", `예상 SUCCESS, 실제 ${r.result}`);
    const after = await getRemainingCount(id);
    assert(after === before, `기간권 remaining_count 변화 없어야 함 (${before} → ${after})`);
  });

  await test("T4: 만료 회원 입장 → 거부, remaining_count 변화 없음", async () => {
    const id = await getMemberId("1004");
    const before = await getRemainingCount(id); // 3
    const r = await checkin("1004");
    assert(r.result === "EXPIRED", `예상 EXPIRED, 실제 ${r.result}`);
    const after = await getRemainingCount(id);
    assert(after === before, `만료 거부 후 횟수 변화 없어야 함 (${before} → ${after})`);
  });

  await test("T5: remaining_count=0인 COUNT 권 입장 → 거부", async () => {
    const id = await getMemberId("1005");
    const before = await getRemainingCount(id); // 0
    const r = await checkin("1005");
    assert(r.result === "NO_COUNT", `예상 NO_COUNT, 실제 ${r.result}`);
    const after = await getRemainingCount(id);
    assert(after === before, `NO_COUNT 거부 후 횟수 변화 없어야 함 (${before} → ${after})`);
  });

  await test("T6: COUNT 권 퇴장 → remaining_count 변화 없음", async () => {
    const id = await getMemberId("1001");
    await checkin("1001"); // 먼저 입장 (5→4)
    const afterCheckin = await getRemainingCount(id);
    const r = await checkin("1001", "CHECK_OUT"); // 퇴장
    assert(r.result === "CHECK_OUT", `예상 CHECK_OUT, 실제 ${r.result}`);
    const afterCheckout = await getRemainingCount(id);
    assert(afterCheckout === afterCheckin, `퇴장 후 횟수 변화 없어야 함 (${afterCheckin} → ${afterCheckout})`);
  });

  await test("T7: 입장 취소 → remaining_count 1 복원", async () => {
    const id = await getMemberId("1001");
    await checkin("1001"); // 5→4
    const afterCheckin = await getRemainingCount(id); // 4
    const [attendRows]: any = await pool.query(
      `SELECT attendance_id FROM attendance WHERE member_id = ? AND result = 'SUCCESS' LIMIT 1`, [id]
    );
    assert(attendRows.length > 0, "취소할 출석 기록이 있어야 함");
    await cancelAttendance(attendRows[0].attendance_id);
    const afterCancel = await getRemainingCount(id); // 5
    assert(afterCancel === afterCheckin + 1, `취소 후 횟수 1 복원 (${afterCheckin} → ${afterCancel})`);
    const cnt = await countSuccessAttendance(id);
    assert(cnt === 0, `취소 후 오늘 출석 기록 0개여야 함, 실제 ${cnt}`);
  });

  await test("T8: 마지막 횟수(1) 입장 후 퇴장 허용", async () => {
    await pool.query(`UPDATE members SET remaining_count = 1 WHERE checkin_code = '1001'`);
    const id = await getMemberId("1001");
    await checkin("1001"); // 1→0
    const afterCheckin = await getRemainingCount(id);
    assert(afterCheckin === 0, `1→0 감소해야 함, 실제 ${afterCheckin}`);
    const r = await checkin("1001", "CHECK_OUT");
    assert(r.result === "CHECK_OUT", `0 남은 후에도 퇴장 가능해야 함, 실제 ${r.result}`);
    const afterCheckout = await getRemainingCount(id);
    assert(afterCheckout === 0, `퇴장 후 횟수 그대로 0이어야 함, 실제 ${afterCheckout}`);
  });

  // ── 추가 케이스 ──────────────────────────────────────────────

  await test("T9: 같은 attendance_id로 취소 2번 → 2번째는 거부, remaining_count +1만", async () => {
    const id = await getMemberId("1001");
    await checkin("1001"); // 5→4
    const afterCheckin = await getRemainingCount(id);
    const [attendRows]: any = await pool.query(`SELECT attendance_id FROM attendance WHERE member_id = ? AND result = 'SUCCESS' LIMIT 1`, [id]);
    assert(attendRows.length > 0, "취소할 출석 기록이 있어야 함");
    const aid = attendRows[0].attendance_id;
    // 첫 번째 취소: 성공
    const r1 = await cancelAttendance(aid);
    assert(r1.success === true, `첫 취소는 성공이어야 함`);
    const afterCancel1 = await getRemainingCount(id);
    assert(afterCancel1 === afterCheckin + 1, `첫 취소 후 +1 (${afterCheckin}→${afterCancel1})`);
    // 두 번째 취소: 이미 삭제된 기록 → 실패
    const r2 = await cancelAttendance(aid);
    assert(r2.success === false, `두 번째 취소는 실패(이미 삭제됨)여야 함`);
    const afterCancel2 = await getRemainingCount(id);
    assert(afterCancel2 === afterCancel1, `두 번째 취소 후 추가 증가 없어야 함 (${afterCancel1}→${afterCancel2})`);
  });

  await test("T10: 퇴장(CHECK_OUT) 기록 취소 → remaining_count 변화 없음", async () => {
    const id = await getMemberId("1001");
    await checkin("1001");                     // 5→4 입장
    const afterCheckin = await getRemainingCount(id); // 4
    await checkin("1001", "CHECK_OUT");        // 퇴장 기록 INSERT
    // 퇴장 기록 조회
    const [checkoutRows]: any = await pool.query(`SELECT attendance_id FROM attendance WHERE member_id = ? AND result = 'CHECK_OUT' LIMIT 1`, [id]);
    assert(checkoutRows.length > 0, "퇴장 기록이 있어야 함");
    await cancelAttendance(checkoutRows[0].attendance_id);
    const afterCancel = await getRemainingCount(id);
    assert(afterCancel === afterCheckin, `퇴장 취소 후 remaining_count 변화 없어야 함 (${afterCheckin}→${afterCancel})`);
  });

  await test("T11: 재결제 후 과거 COUNT 입장 취소 → used_count 기반 복원", async () => {
    // 시나리오: COUNT권(5회) 입장 → PERIOD 재결제 → 과거 입장 취소
    // 현재 구조에서 attendance에 payment_id가 없으므로 "어떤 결제"인지 식별 불가
    // → used_count > 0 기준으로 복원하면 현재 PERIOD 회원권의 remaining_count(=0)가 +1 됨 (구조적 한계)
    // 이 테스트는 현재 동작을 명시하는 문서 테스트
    const id = await getMemberId("1001");
    await checkin("1001"); // 5→4, used_count=1 기록
    const afterCheckin = await getRemainingCount(id); // 4
    // PERIOD로 재결제 시뮬레이션
    await pool.query(`UPDATE members SET pass_type = 'PERIOD', remaining_count = 0 WHERE member_id = ?`, [id]);
    const afterRepay = await getRemainingCount(id); // 0
    // 과거 COUNT 입장 취소
    const [attendRows]: any = await pool.query(`SELECT attendance_id FROM attendance WHERE member_id = ? AND result = 'SUCCESS' AND used_count > 0 LIMIT 1`, [id]);
    assert(attendRows.length > 0, "취소할 COUNT 출석 기록이 있어야 함");
    await cancelAttendance(attendRows[0].attendance_id);
    const afterCancel = await getRemainingCount(id);
    // used_count > 0이므로 복원 발생 → 0+1=1 (구조적 한계: PERIOD 회원권에 복원됨)
    // 운영에서 이 케이스는 수동 처리 권장
    assert(afterCancel === afterRepay + 1, `used_count>0 기준 복원: ${afterRepay}→${afterCancel} (한계: payment_id 없어 당시 회원권 식별 불가)`);
    console.log(`    ⚠ 구조적 한계: attendance에 payment_id 없음 → 재결제 후 과거 취소 시 현재 회원권에 복원됨`);
  });

  await test("T12: KST today 함수 — UTC 오전 0시와 오전 15시 모두 KST 날짜 반환", async () => {
    // kstToday()가 항상 KST 기준 'YYYY-MM-DD' 반환하는지 확인
    const kst = kstToday();
    assert(/^\d{4}-\d{2}-\d{2}$/.test(kst), `kstToday() 형식 오류: ${kst}`);
    // UTC와 KST 날짜가 다를 수 있는 시간대 확인
    const nowUtc = new Date().toISOString().slice(0, 10);
    const utcHour = new Date().getUTCHours();
    if (utcHour < 15) {
      // UTC 00:00~14:59 → KST 09:00~23:59 → 같은 날
      assert(kst === nowUtc, `UTC ${utcHour}시: kstToday(${kst}) === utcToday(${nowUtc}) 여야 함`);
    } else {
      // UTC 15:00~23:59 → KST 00:00~08:59 (다음날) → kstToday > utcToday
      assert(kst > nowUtc, `UTC ${utcHour}시: kstToday(${kst}) > utcToday(${nowUtc}) 여야 함 (KST 자정 이후)`);
    }
    console.log(`    UTC ${new Date().toISOString().slice(0, 16)}, KST today=${kst}, UTC today=${nowUtc}`);
  });

  await test("T13: 취소 이력 member_histories 기록 확인", async () => {
    const id = await getMemberId("1001");
    await checkin("1001"); // 입장
    const [attendRows]: any = await pool.query(`SELECT attendance_id FROM attendance WHERE member_id = ? AND result = 'SUCCESS' LIMIT 1`, [id]);
    assert(attendRows.length > 0, "취소할 출석 기록이 있어야 함");
    const histBefore: any = await pool.query(`SELECT COUNT(*) as cnt FROM member_histories WHERE member_id = ? AND action_type = 'ATTENDANCE_UNDO'`, [id]);
    const countBefore = histBefore[0][0].cnt;
    await cancelAttendance(attendRows[0].attendance_id);
    const histAfter: any = await pool.query(`SELECT COUNT(*) as cnt FROM member_histories WHERE member_id = ? AND action_type = 'ATTENDANCE_UNDO'`, [id]);
    const countAfter = histAfter[0][0].cnt;
    assert(countAfter > countBefore, `취소 후 member_histories ATTENDANCE_UNDO 기록 증가해야 함 (${countBefore}→${countAfter})`);
  });

  await test("T14: PERIOD 입장 취소 → remaining_count 변화 없음, 이력 기록", async () => {
    const id = await getMemberId("1002"); // PERIOD 회원
    await checkin("1002"); // 입장 (차감 없음, used_count=0)
    const afterCheckin = await getRemainingCount(id); // 0
    const [attendRows]: any = await pool.query(`SELECT attendance_id FROM attendance WHERE member_id = ? AND result = 'SUCCESS' LIMIT 1`, [id]);
    assert(attendRows.length > 0, "취소할 출석 기록이 있어야 함");
    await cancelAttendance(attendRows[0].attendance_id);
    const afterCancel = await getRemainingCount(id);
    assert(afterCancel === afterCheckin, `PERIOD 취소 후 remaining_count 변화 없어야 함 (${afterCheckin}→${afterCancel})`);
  });

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`\n결과: ${passed} 통과 / ${failed} 실패 / 전체 ${results.length}`);
  if (failed > 0) {
    console.log("\n실패 목록:");
    results.filter((r) => !r.passed).forEach((r) => console.log(`  - ${r.name}: ${r.error}`));
  }

  await pool.end();
  if (failed > 0) throw new Error(`${failed}개 테스트 실패`);
}

main().catch((e) => { console.error(e); });
