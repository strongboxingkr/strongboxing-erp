# ERP 보안 감사 상태 (2026-11-09)

> 모든 수정은 strongboxing_test DB에서 테스트 완료.  
> 운영 DB 직접 접근 없음 — 운영 관련 항목은 "배포 절차" 섹션에 명시.

---

## 완료된 수정 사항

### Auth P0 — x-user-* 헤더 인증 → erp-session 쿠키 인증
- **상태**: 완료 (commit c8a7d03)
- `lib/auth.ts` → `getUserFromRequest()` = `getErpUser()` (cookie 기반)
- `lib/api.ts` → x-user-* 헤더 전송 제거, `credentials: "include"` 추가
- 약 190개 API 라우트 커버됨

### 체크인 KST 날짜, 원자성
- **상태**: 완료
- `kstToday()` 사용, 중복 체크인 방지, `withMemberChange()` 트랜잭션

### 결제 취소 (payments/cancel)
- **상태**: 완료 (commit 376cde7)
- PASS / GENERAL 분리, 재결제 감지

### 휴회 해제 end_date 재계산
- **상태**: 완료 (commit 13071c6)
- `computeReleaseEnd()` 추가

### COUNT 출석 취소 차단 강화
- **상태**: 완료 (commit 50adbc3)
- 허용 조건: `checkin_date > start_date` 만
- `start_date NULL` → 409 차단
- `checkin_date == start_date` (당일 재등록) → 409 차단
- 차단 시 출석·횟수·이력 모두 불변
- 통합 테스트 5/5 통과

### 로그인 SQL 버그 수정
- **상태**: 완료 (commit ee4db71)
- `users` 테이블에 `status` 컬럼 없음 → `ER_UNKNOWN_COLUMN` 에러 → SELECT에서 제거

### bulk-extend pass_type 오타
- **상태**: 완료 (commit 65c200f)
- `'DATE'` → `'PERIOD'`

### 로그인 rate limiting
- **상태**: 완료 (middleware.ts, commit b74fee4)
- `/api/check-in`: 60req/분/IP
- `/api/login`: 10req/15분/IP

---

## 구조적 한계 (코드 수정으로 해결 불가)

### 키오스크 보호 — 미구현 항목 명시

**구현된 것:**
- `/api/check-in`: 60req/분/IP rate limiting (middleware.ts)
- 4자리 체크인 코드 (0000-9999)

**미구현 (기기 인증 없음):**
- 등록된 기기(MAC/장치ID)에서만 체크인 허용하는 기능이 없음
- 임의의 HTTP 클라이언트에서 올바른 checkin_code만 알면 체크인 가능
- `/api/check-in`에 세션 인증 없음 (의도적: 키오스크는 로그인 불필요)

**IP 헤더 스푸핑 가능성:**
- `middleware.ts`의 `getIp()` = `x-forwarded-for` 헤더 첫 번째 값
- Nginx가 `x-forwarded-for`를 덮어쓰거나(`proxy_set_header X-Real-IP $remote_addr`) 신뢰 프록시를 명시하지 않으면 클라이언트가 헤더 조작 가능
- Nginx 설정에 `set_real_ip_from 127.0.0.1; real_ip_header X-Forwarded-For;` 없으면 rate limit 우회 가능

**메모리 기반 rate limiter 한계:**
- pm2 재시작 시 카운터 초기화
- 여러 pm2 인스턴스 실행 시 프로세스 간 상태 공유 없음 (클러스터 모드 불가)
- Redis 기반으로 교체하면 해결 가능

**→ 키오스크 보호 완료 분류 불가. 완화(mitigating control) 수준임.**

---

### attendance 테이블 payment_id 없음

- 출석 취소 시 "어떤 패스의 차감인지" 완전한 증명 불가
- start_date 비교 휴리스틱으로 최선 추정 → 불확실한 경우 409 반환
- 완전한 추적성을 위해 `attendance.payment_id` 컬럼 추가 필요 (스키마 변경 필요)

---

## 비밀번호 현황

### 평문 계정 수
- **테스트 DB** (`strongboxing_test`): 2개 계정이 평문 비밀번호로 저장됨 확인
- **운영 DB**: 미접촉 — 운영 평문 계정 수는 **확인 불가**
- 로그인 성공 시 자동 bcrypt 업그레이드 로직 있음 (로그인 1회 후 해시로 전환됨)

### 비밀번호 초기화 경로
- `app/api/users/reset-password/route.ts` — ADMIN/OWNER 전용, bcrypt 해시 저장
- `app/api/users/add/route.ts` — 계정 추가 시 bcrypt 해시로 저장 (초기화 아님)
- 직접 초기화: `mysql> UPDATE users SET password_hash = ? WHERE user_id = ?` (hashed)

---

## 배포 시 필요한 추가 작업 (로컬 완료 불가)

### CRON_SECRET 설정
- 현재 `.env.local`, `.env.production` 어디에도 `CRON_SECRET` 없음
- `/api/sms/auto-run`은 `Authorization: Bearer <secret>` OR OWNER/ADMIN 세션으로 인증
- 배포 전 `.env.production`에 `CRON_SECRET=<강한 랜덤값>` 추가 필요

### 운영 스키마 비교
- **테스트 DB**: `payments` 테이블에 migration 컬럼 이미 존재
  - `total_count`, `start_date`, `end_date`, `idempotency_key`, `uq_idempotency`
- **운영 DB**: 직접 확인 필요. `migration-production.sql` 실행 전 반드시 STEP 0(컬럼 존재 확인) 선행
- `migration-production.sql`을 그대로 실행하면 Duplicate column 에러 발생 가능

---

## 테스트 결과 요약

| 테스트 파일 | 결과 |
|------------|------|
| `docs/integration-test-checkin.ts` | 14/14 통과 |
| `docs/integration-test-cancel-refund.ts` | 6/6 통과 |
| `docs/integration-test-attendance-reregistration.ts` | 5/5 통과 |
| TypeScript `tsc --noEmit` | 오류 없음 |
| Next.js `next build` | 빌드 성공 |
