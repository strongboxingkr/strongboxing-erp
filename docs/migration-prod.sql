-- ============================================================
-- 운영 DB 마이그레이션
-- 목적: Bug 1 (8자리 입장번호) + Bug 2 (일일권) 배포 준비
-- 작성일: 2026-11-10
-- 주의: 실제 운영 서버 접속 후 SHOW CREATE TABLE로 현재 스키마
--       재확인 후 적용. 이미 존재하는 컬럼·인덱스·제약은 건너뜀.
-- 백업 먼저: mysqldump -u root -p strongboxing > backup_YYYYMMDD.sql
-- ============================================================

-- ── 1. members: checkin_code 4→8자리 ─────────────────────────
-- Bug 1 fix: 최대 8자리 입장번호 허용
ALTER TABLE members
  MODIFY COLUMN checkin_code VARCHAR(8) NULL;

-- ── 2. members: pass_type ENUM DAILY 추가 ────────────────────
-- Bug 2 fix: 일일권 회원권 유형
ALTER TABLE members
  MODIFY COLUMN pass_type ENUM('COUNT','PERIOD','DAILY') NULL;

-- ── 3. payments: pass_type ENUM DAILY 추가 ───────────────────
-- Bug 2 fix: 일일권 결제 기록
-- 주의: 운영에 total_count, start_date, end_date, idempotency_key가
--       이미 있는지 먼저 SHOW COLUMNS FROM payments; 로 확인할 것
ALTER TABLE payments
  MODIFY COLUMN pass_type ENUM('COUNT','PERIOD','DAILY') NULL;

-- ── 4. payments: 추가 컬럼 (없을 경우에만 실행) ───────────────
-- 아래 각 줄은 운영에서 SHOW COLUMNS 결과에 없는 항목만 실행
-- (이미 있으면 중복 ADD로 오류 발생)

-- total_count: 횟수권 제공 횟수 / 일일권은 1 고정
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS total_count INT NULL AFTER pass_type;

-- start_date: 시작일
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS start_date DATE NULL AFTER total_count;

-- end_date: 만료일
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS end_date DATE NULL AFTER start_date;

-- idempotency_key: 중복 결제 방지
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(64) NULL AFTER end_date;

-- idempotency_key UNIQUE 인덱스 (없을 경우에만)
ALTER TABLE payments
  ADD UNIQUE INDEX IF NOT EXISTS uq_payments_idempotency (idempotency_key);

-- ── 5. day_passes 테이블 생성 (없을 경우에만) ────────────────
-- Bug 2 fix: 일일권 개별 이용 기록
CREATE TABLE IF NOT EXISTS day_passes (
  pass_id      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  payment_id   BIGINT UNSIGNED NOT NULL,
  member_id    BIGINT UNSIGNED NOT NULL,
  guest_name   VARCHAR(100)    NULL,
  guest_phone  VARCHAR(20)     NULL,
  pass_code    VARCHAR(20)     NULL,
  branch_name  VARCHAR(100)    NOT NULL,
  use_date     DATE            NOT NULL,
  status       ENUM('PENDING','USED','CANCELLED') NOT NULL DEFAULT 'PENDING',
  used_at      DATETIME        NULL,
  attendance_id BIGINT UNSIGNED NULL,
  created_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (pass_id),
  INDEX idx_dp_member (member_id),
  INDEX idx_dp_payment (payment_id),
  INDEX idx_dp_usedate (use_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 6. kiosk_devices 테이블 생성 (없을 경우에만) ─────────────
-- 키오스크 기기 토큰 관리
CREATE TABLE IF NOT EXISTS kiosk_devices (
  device_id     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  device_token  VARCHAR(64)     NOT NULL,
  branch_name   VARCHAR(100)    NOT NULL,
  label         VARCHAR(100)    NULL,
  registered_by VARCHAR(100)    NOT NULL,
  registered_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at    DATETIME        NULL,
  PRIMARY KEY (device_id),
  UNIQUE KEY uq_kiosk_token (device_token),
  INDEX idx_kiosk_branch (branch_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 7. 검증 쿼리 ────────────────────────────────────────────
-- 적용 후 아래로 확인
SELECT 'members.checkin_code' AS tbl, COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='members' AND COLUMN_NAME='checkin_code'
UNION ALL
SELECT 'members.pass_type', COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='members' AND COLUMN_NAME='pass_type'
UNION ALL
SELECT 'payments.pass_type', COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='payments' AND COLUMN_NAME='pass_type'
UNION ALL
SELECT 'day_passes exists', IF(COUNT(*)>0,'YES','NO') FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='day_passes'
UNION ALL
SELECT 'kiosk_devices exists', IF(COUNT(*)>0,'YES','NO') FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='kiosk_devices';
