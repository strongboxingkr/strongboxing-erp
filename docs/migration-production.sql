-- ============================================================
-- 운영 DB 마이그레이션 — payments 테이블 스키마 확장
-- 적용 대상: strongboxing (운영)
-- 적용 전 반드시 읽기 전용 검증 쿼리를 먼저 실행할 것
--
-- 적용 순서:
--   1. 이 파일의 [STEP 0] 검증 쿼리 실행 (읽기 전용)
--   2. 운영 서버에서 git pull + npm run build (빌드 중단 없음)
--   3. [STEP 1~4] ALTER 순서대로 실행
--   4. [STEP 5] 적용 후 검증
--   5. pm2 restart strongboxing-erp
-- ============================================================

-- ── [STEP 0] 적용 전 현황 확인 (읽기 전용) ─────────────────
-- 실행 후 결과 보고 후 진행할 것

-- 현재 컬럼 목록
SHOW COLUMNS FROM payments;

-- 현재 인덱스 목록
SHOW INDEX FROM payments;

-- 기존 데이터 건수 및 pass_type 분포
SELECT
  COUNT(*) AS total_payments,
  SUM(pass_type IS NULL) AS pass_type_null,
  SUM(pass_type = 'COUNT') AS count_type,
  SUM(pass_type = 'PERIOD') AS period_type
FROM payments;

-- pass_type이 NOT NULL이고 값이 없는 행 존재 여부
SELECT COUNT(*) AS empty_passtype FROM payments WHERE pass_type = '';


-- ── [STEP 1] pass_type NULL 허용 ─────────────────────────────
-- 목적: GENERAL 결제(회원권 아닌 단순 결제) 저장 시 NULL 허용
-- 영향: 기존 행 변경 없음. 기존 조회는 IS NULL 조건 없으면 동일.
-- 롤백: ALTER TABLE payments MODIFY pass_type ENUM('COUNT','PERIOD') NOT NULL;
--       (단, NULL 행이 없을 때만 가능)

ALTER TABLE payments
  MODIFY COLUMN pass_type ENUM('COUNT','PERIOD') NULL;

-- ── [STEP 2] total_count 컬럼 추가 ───────────────────────────
-- 목적: 횟수권 등록 시 총 제공 횟수 기록 (기간권·일반결제는 NULL)
-- 기존 데이터: NULL로 채워짐 (문제없음)
-- 롤백: ALTER TABLE payments DROP COLUMN total_count;

ALTER TABLE payments
  ADD COLUMN total_count INT NULL AFTER pass_type;

-- ── [STEP 3] start_date, end_date 컬럼 추가 ──────────────────
-- 목적: 결제 시점에 약정된 이용 기간을 payments에도 기록
--       (members 테이블 변경 이력과 별개로 결제 원본 보존)
-- 기존 데이터: NULL로 채워짐 (문제없음)
-- 롤백: ALTER TABLE payments DROP COLUMN start_date, DROP COLUMN end_date;

ALTER TABLE payments
  ADD COLUMN start_date DATE NULL AFTER total_count,
  ADD COLUMN end_date   DATE NULL AFTER start_date;

-- ── [STEP 4] idempotency_key 컬럼 + UNIQUE 인덱스 ────────────
-- 목적: 클라이언트 재시도 시 중복 결제 방지
--       값이 없을 때는 NULL (UNIQUE는 NULL 여러 개 허용)
-- 기존 데이터: NULL로 채워짐. UNIQUE에서 NULL 중복 허용됨.
-- 주의: 중복 값이 있으면 UNIQUE 생성 실패 → STEP 0 조회 먼저 확인
-- 롤백: ALTER TABLE payments DROP INDEX uq_idempotency;
--       ALTER TABLE payments DROP COLUMN idempotency_key;

ALTER TABLE payments
  ADD COLUMN idempotency_key VARCHAR(64) NULL AFTER memo;

ALTER TABLE payments
  ADD UNIQUE KEY uq_idempotency (idempotency_key);


-- ── [STEP 5] 적용 후 검증 (읽기 전용) ───────────────────────
-- 모든 STEP 완료 후 실행, 결과가 예상과 맞는지 확인

-- 최종 컬럼 목록 (total_count, start_date, end_date, idempotency_key 있어야 함)
SHOW COLUMNS FROM payments;

-- 최종 인덱스 (uq_idempotency UNIQUE 있어야 함)
SHOW INDEX FROM payments;

-- 기존 데이터 무결성 확인 (기존 행이 그대로여야 함)
SELECT COUNT(*) AS total_payments FROM payments;
SELECT COUNT(*) AS null_idempotency FROM payments WHERE idempotency_key IS NOT NULL;
-- → 기존 행은 idempotency_key=NULL 이어야 함. 0 이어야 정상.

-- ============================================================
-- 일일권(DAILY) 지원 마이그레이션
-- ============================================================

-- ── [STEP 6] payments.pass_type에 DAILY 추가 ──────────────────
-- 목적: 일일권 결제 기록 시 pass_type='DAILY' 허용
-- 롤백: 기존 'DAILY' 행이 없을 때만 가능
--   ALTER TABLE payments MODIFY pass_type ENUM('COUNT','PERIOD') NULL;

ALTER TABLE payments
  MODIFY COLUMN pass_type ENUM('COUNT','PERIOD','DAILY') NULL;

-- ── [STEP 7] members.checkin_code VARCHAR(8) 확장 ─────────────
-- 목적: 출석코드 최대 8자리 지원 (기존 4자리 호환 유지)
-- 기존 데이터: 4자리 그대로 유지됨
-- 롤백: ALTER TABLE members MODIFY COLUMN checkin_code VARCHAR(4) NULL;
--   (기존에 5자리 이상 코드가 없을 때만 가능)

ALTER TABLE members
  MODIFY COLUMN checkin_code VARCHAR(8) NULL;

-- ── [STEP 8] day_passes 테이블 생성 ───────────────────────────
-- 목적: 일일권 사용 추적 (회원·비회원 모두)
-- 롤백: DROP TABLE day_passes;

CREATE TABLE IF NOT EXISTS day_passes (
  pass_id       INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  payment_id    INT          NOT NULL,
  member_id     INT          NULL,                -- 비회원이면 NULL
  guest_name    VARCHAR(50)  NULL,                -- 비회원 성명
  guest_phone   VARCHAR(20)  NULL,                -- 비회원 연락처
  branch_name   VARCHAR(50)  NOT NULL,
  use_date      DATE         NOT NULL,            -- 지정 이용일
  status        ENUM('PENDING','USED','CANCELLED') NOT NULL DEFAULT 'PENDING',
  used_at       DATETIME     NULL,
  attendance_id INT          NULL,                -- 사용 시 연결된 출석 ID
  created_at    DATETIME     NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_dp_payment  FOREIGN KEY (payment_id)    REFERENCES payments(payment_id),
  CONSTRAINT fk_dp_member   FOREIGN KEY (member_id)     REFERENCES members(member_id),
  CONSTRAINT fk_dp_attend   FOREIGN KEY (attendance_id) REFERENCES attendance(attendance_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── [STEP 9] settings_options에 일일권 상품 추가 ─────────────
-- 목적: 결제 화면에서 일일권 선택 가능하도록
-- 주의: 같은 option_name이 이미 있으면 중복 삽입됨 — STEP 0에서 확인 후 실행

-- 사전 확인 (실행 전 반드시 확인)
SELECT * FROM settings_options WHERE option_type='PASS_PRODUCT' AND option_name LIKE '%일일%';

-- 없으면 아래 INSERT 실행
-- INSERT INTO settings_options (option_type, option_name, option_value, count_value, duration_months, use_yn)
-- VALUES ('PASS_PRODUCT', '일일권', 'DAILY', 1, NULL, 'Y');

-- ── [STEP 10] 적용 후 검증 (읽기 전용) ──────────────────────
SHOW COLUMNS FROM day_passes;
SHOW COLUMNS FROM members LIKE 'checkin_code';
SELECT COLUMN_TYPE FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='payments' AND COLUMN_NAME='pass_type';

-- ── [STEP 11] day_passes.pass_code 컬럼 추가 ─────────────────
-- 목적: 비회원 현장 입장코드 (4자리 숫자, 앞자리 0 보존)
-- 롤백: ALTER TABLE day_passes DROP COLUMN pass_code;

ALTER TABLE day_passes
  ADD COLUMN pass_code VARCHAR(8) NULL
    COMMENT '비회원 현장 입장코드 (4자리 숫자, padStart)' AFTER guest_phone;

-- 기존 day_passes 행에는 pass_code=NULL이 허용됨
-- 신규 비회원 등록 시 자동 생성됨

-- ── [STEP 12] attendance.pass_type ENUM에 DAILY 추가 ─────────
-- 목적: 일일권 출석 기록 시 pass_type='DAILY' 저장
-- 롤백: ALTER TABLE attendance MODIFY COLUMN pass_type ENUM('COUNT','PERIOD') NULL;
--   (DAILY 행이 없을 때만 가능)

ALTER TABLE attendance
  MODIFY COLUMN pass_type ENUM('COUNT','PERIOD','DAILY') NULL;

-- ── [STEP 13] 최종 검증 ───────────────────────────────────────
SHOW COLUMNS FROM day_passes LIKE 'pass_code';
SELECT COLUMN_TYPE FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='attendance' AND COLUMN_NAME='pass_type';
