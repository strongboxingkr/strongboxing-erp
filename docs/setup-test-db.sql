-- 테스트 DB 생성 및 스키마 초기화
-- 운영 DB와 완전히 분리 (strongboxing_test)
-- 실행: mysql -u root -p strongboxing < docs/setup-test-db.sql

DROP DATABASE IF EXISTS strongboxing_test;
CREATE DATABASE strongboxing_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE strongboxing_test;

CREATE TABLE members (
  member_id    BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  branch_name  VARCHAR(50) NOT NULL,
  name         VARCHAR(50) NOT NULL,
  phone        VARCHAR(30) NOT NULL,
  phone_last4  VARCHAR(4)  NOT NULL,
  checkin_code VARCHAR(4)  NULL,
  product_name VARCHAR(100) NULL,
  pass_type    ENUM('COUNT','PERIOD') NULL,
  remaining_count INT NULL DEFAULT 0,
  start_date   DATE NULL,
  end_date     DATE NULL,
  status       ENUM('ACTIVE','EXPIRED','REST') NULL DEFAULT 'ACTIVE',
  memo         TEXT NULL,
  created_at   DATETIME NULL DEFAULT CURRENT_TIMESTAMP
);

-- payments: pass_type NULL 허용 (GENERAL 결제용),
--           total_count / start_date / end_date 추가,
--           idempotency_key UNIQUE
CREATE TABLE payments (
  payment_id      BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  member_id       BIGINT NOT NULL,
  branch_name     VARCHAR(50) NOT NULL,
  payment_date    DATE NOT NULL,
  payment_method  ENUM('CASH','CARD','TRANSFER') NOT NULL,
  product_name    VARCHAR(100) NULL,
  pass_type       ENUM('COUNT','PERIOD') NULL,  -- GENERAL 결제는 NULL
  total_count     INT NULL,
  start_date      DATE NULL,
  end_date        DATE NULL,
  amount          INT NOT NULL,
  discount_amount INT NULL DEFAULT 0,
  refund_amount   INT NULL DEFAULT 0,
  final_amount    INT NOT NULL,
  memo            TEXT NULL,
  idempotency_key VARCHAR(64) NULL,
  created_at      DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_idempotency (idempotency_key)
);

CREATE TABLE settings_options (
  option_id      BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  option_type    VARCHAR(50) NOT NULL,
  option_name    VARCHAR(100) NOT NULL,
  option_value   VARCHAR(100) NULL,
  sort_order     INT NULL DEFAULT 0,
  use_yn         CHAR(1) NULL DEFAULT 'Y',
  created_at     DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  amount         INT NULL DEFAULT 0,
  duration_months INT NULL DEFAULT 0,
  count_value    INT NULL DEFAULT 0
);

-- ── 테스트용 상품 마스터 ──────────────────────────────────────

-- 정상 PASS_PRODUCT
INSERT INTO settings_options (option_type, option_name, option_value, duration_months, count_value) VALUES
  ('PASS_PRODUCT', '1month', 'PERIOD', 1,  0),
  ('PASS_PRODUCT', '3month', 'PERIOD', 3,  0),
  ('PASS_PRODUCT', '8count', 'COUNT',  1,  8),
  ('PASS_PRODUCT', '8count_2m', 'COUNT',  2,  8),
  ('PASS_PRODUCT', '36count_3m', 'COUNT',  3, 36);

INSERT INTO settings_options (option_type, option_name, option_value, duration_months, count_value) VALUES
  ('PASS_PRODUCT', 'daily',   NULL,     0,  0),
  ('PASS_PRODUCT', '3x_1m',   'COUNT',  1,  0),
  ('PASS_PRODUCT', '3x_3m',   'COUNT',  0,  0);

INSERT INTO settings_options (option_type, option_name, option_value, sort_order) VALUES
  ('EXTRA_PRODUCT', 'entry_fee', '30000', 1),
  ('EXTRA_PRODUCT', 'locker',    '10000', 2),
  ('EXTRA_PRODUCT', 'uniform',   '5000',  3);

CREATE TABLE attendance (
  attendance_id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  member_id     BIGINT NULL,
  branch_name   VARCHAR(50) NULL,
  member_name   VARCHAR(50) NULL,
  pass_type     ENUM('COUNT','PERIOD') NULL,
  used_count    INT NULL DEFAULT 0,
  result        VARCHAR(20) NOT NULL,
  memo          TEXT NULL,
  checkin_time  DATETIME NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE member_histories (
  history_id    BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  member_id     BIGINT NULL,
  member_name   VARCHAR(50) NULL,
  action_type   VARCHAR(50) NULL,
  action_memo   TEXT NULL,
  old_value     TEXT NULL,
  new_value     TEXT NULL,
  created_by    VARCHAR(50) NULL,
  created_at    DATETIME NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE member_holds (
  hold_id       BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  member_id     BIGINT NOT NULL,
  hold_start    DATE NOT NULL,
  hold_end      DATE NOT NULL,
  hold_days     INT NOT NULL,
  reason        TEXT NULL,
  old_end_date  DATE NULL,
  new_end_date  DATE NULL,
  released_at   DATETIME NULL,
  released_by   VARCHAR(50) NULL,
  created_by    VARCHAR(50) NULL,
  created_at    DATETIME NULL DEFAULT CURRENT_TIMESTAMP
);

-- ── 테스트용 회원 ─────────────────────────────────────────────

INSERT INTO members (branch_name, name, phone, phone_last4, checkin_code, product_name, pass_type, remaining_count, start_date, end_date, status) VALUES
  ('철산점', '횟수권테스트', '01011110001', '0001', '1001', '8회권',      'COUNT',  5, '2026-01-01', '2099-12-31', 'ACTIVE'),
  ('철산점', '기간권테스트', '01011110002', '0002', '1002', '1개월 기간권','PERIOD', 0, '2026-01-01', '2099-12-31', 'ACTIVE'),
  ('철산점', '신규테스트',   '01011110003', '0003', '1003', NULL,         NULL,     0, NULL,          NULL,          'ACTIVE'),
  ('철산점', '만료회원',     '01011110004', '0004', '1004', '8회권',      'COUNT',  3, '2020-01-01', '2020-12-31', 'ACTIVE'),
  ('철산점', '0회횟수권',    '01011110005', '0005', '1005', '8회권',      'COUNT',  0, '2026-01-01', '2099-12-31', 'ACTIVE');
