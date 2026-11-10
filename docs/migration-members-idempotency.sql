-- LOCAL ONLY — 운영 적용 금지
-- 목적: 회원 신규 등록 응답 유실 복구를 위한 idempotency 지원
--
-- 복구 흐름:
--   1. UI가 폼 오픈 시 UUID를 생성해 memberIdempotencyKey로 저장
--   2. POST /api/members/add 에 idempotency_key 포함
--   3. 서버: INSERT 전 idempotency_key로 기존 회원 조회
--      - 있으면: 기존 member_id 반환 (idempotent 성공)
--      - 없으면: INSERT 후 반환
--   4. UNIQUE 제약(uk_members_idempotency)으로 동시 요청도 보호
--
-- 주의: phone+branch UNIQUE 추가 금지 (가족 연락처 공유 시나리오)

ALTER TABLE members
  ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(36) NULL AFTER memo;

ALTER TABLE members
  ADD UNIQUE INDEX IF NOT EXISTS uk_members_idempotency (idempotency_key);
