-- Migration 001: ERP 세션 테이블 생성
-- 적용일: 2026-11-10 (배포 커밋 7a4f74a 함께 운영 적용)
-- 비고: 기존 x-user-* 헤더 인증 → erp_session 쿠키 기반 인증으로 전환
--       백업 완료 후 운영 DB에 적용됨

CREATE TABLE IF NOT EXISTS erp_sessions (
  token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  user_id    BIGINT NOT NULL,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (token_hash),
  INDEX idx_erp_sessions_user    (user_id),
  INDEX idx_erp_sessions_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 롤백 (세션 테이블 삭제는 파괴적 — 운영에서 활성 세션이 있으므로 신중히 판단)
-- DROP TABLE IF EXISTS erp_sessions;
