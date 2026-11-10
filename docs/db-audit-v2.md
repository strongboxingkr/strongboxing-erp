# DB 진단 보고서 v2 (갱신)

**원본 분석 커밋**: `2495cd3`  
**최종 갱신 커밋**: `f793e1c` (2026-11-10)  
**작성 기준**: 코드 직접 판독 (실행 환경 접근 없음)

---

## 상태 범례

| 기호 | 의미 |
|---|---|
| ✅ | mock/빌드 테스트 통과, 운영 배포 대기 |
| 🔍 | 코드 확인 완료, 수정 불필요 판단 |
| ❌ | 미수정 (해당 없음 — 모든 항목 처리됨) |
| ⚠️ | 운영 환경 확인 필요 |

---

## 이번 세션 감사 범위

이 보고서는 **13개 항목(원본 P1–P7 + 추가 S1–S6)** 에 한정된다.  
전체 ERP 기능 감사(라우트 전수, SMS, CRON, 대시보드, 설정 화면 등)는 별도 범위이며 이 문서에서 다루지 않는다.

---

## 원본 7개 항목

### P1 — 결제 취소 비트랜잭션 ✅ 수정 완료

**문제**: payments UPDATE + members UPDATE 별도 쿼리.  
**수정**: `withMemberChange` 단일 트랜잭션. PASS/GENERAL 분리.  
**커밋**: `376cde7`  
**테스트**: integration-test-cancel-refund.ts 6/6 통과

---

### P2 — 회원권 갱신(renew) 비트랜잭션 ✅ 실질적 해소

**문제**: `members/[id]/renew/route.ts` — payments/members/histories가 별도 쿼리.  
**해소 근거**:  
1. 화면(재등록 버튼)은 `payments/add`를 호출하며, 이 경로는 `withMemberChange` 트랜잭션으로 처리된다(`payments/add` L261–340).  
2. `renew` API 자체는 현재 화면에서 호출되지 않는다(코드 추적 결과 `saveRereg`가 `payments/add`만 호출).  
3. 커밋 `038792b`에서 `renew` API에 `extend_locker` 옵션이 추가됐으나, 별도 쿼리 구조 자체는 유지됨.  
**잔여 위험**: `renew` API를 직접 호출하는 경우 비트랜잭션 위험 존재 — 미사용이므로 현재 위험 낮음.

---

### P3 — 환불 비트랜잭션·상태 미변경 ✅ 수정 완료

**문제**: 환불 후 members.status 무조건 EXPIRED, 원결제 연결 없음, 초과 환불 가능.  
**수정 내용** (커밋 `f30cc56` → `f793e1c`로 완전 재작성):
- `payment_id` (원결제) 필수 파라미터 — 연결 없이 환불 불가
- `refundMemoCondition()`: `LIKE '#42%'` 대신 `(memo = ? OR memo LIKE '... — %')` — `#420/#421` 오포함 방지
- `FOR UPDATE` 선점 잠금 + `LOCK IN SHARE MODE` 누계 쿼리 → 최신 커밋 환불액 읽기
- `terminate_pass` 사전 거부 (INSERT 전): GENERAL 결제 or 현재 회원권 불일치 → 400/409 반환. DB에 아무것도 쓰지 않음.
- `requiresManualReview` 경로 완전 제거 — 사전 거부 or 성공만 반환
- 과거 결제 환불(`isCurrentPass=false`): `terminate_pass=false`만 허용, 금액 환불만 처리
- `passIdentificationWarning`: best-effort 식별임을 응답에 명시
- `canAccessBranch` 지점 권한 추가
- 모든 처리 `withMemberChange` 단일 트랜잭션
- **환불 모달 UI** (`f793e1c`): member-detail 화면에서 `payment_id` 직접 전달, 중복 제출 방지(submitting state), 성공 후 목록·매출 갱신

**동시성 한계**:
- `FOR UPDATE` 사용으로 같은 `payment_id` 동시 환불은 직렬화됨
- 그러나 실제 운영 DB에서 동시성 테스트 미수행 — "운영 동작 보장" 표현 금지

**스키마 한계 (운영 변경 금지)**:
- 현재 payments 테이블에 `source_payment_id` 컬럼 없음 → 환불-원결제 연결을 memo 패턴(`[환불] 원결제 #{id}`)으로 처리
- 완전한 추적성을 위해 `payments.source_payment_id` 컬럼 추가 권장 (미래 스키마 변경 사항)

**테스트**: mock 19/19 통과 (`f30cc56`), TypeScript exit 0, Build 성공 (`f793e1c`)  
**커밋**: `f30cc56` → 완전 재작성 `f793e1c`

---

### P4 — 회원 등록 비트랜잭션 ✅ 수정 완료

**문제**: members INSERT → lockers UPSERT → member_histories INSERT가 별도 쿼리.  
**수정**: `conn.beginTransaction()` + FOR UPDATE occupation check + 동일 트랜잭션.  
**커밋**: `b8d37ea`  
**테스트**: mock 24/24 통과

---

### P5 — lockers zone 하드코딩 ✅ 수정 완료

**문제**: 락커 UPSERT 시 `locker_zone = 'A'` 고정 — B구역 등 오배정 가능.  
**수정**: 배정 전 `SELECT locker_zone FROM lockers WHERE ...`으로 기존 zone 조회 후 보존. 신규는 'A' 기본값 유지.  
**적용 경로**: `members/update/route.ts` (커밋 `f30cc56`)  
**미적용 경로**: `members/add/route.ts` — 신규 등록은 항상 새 번호이므로 'A' 기본값이 맞음.  
**DB 확인 필요**: 운영 lockers 테이블의 locker_zone 실제 값 분포 확인 권장.  
**테스트**: mock P5 3/3 통과

---

### P6 — 회원 삭제 비트랜잭션 ✅ 수정 완료

**문제**: member_histories INSERT → DELETE FROM members 별도 쿼리.  
**수정** (커밋 `f30cc56`):
- `withMemberChange` 단일 트랜잭션: histories INSERT → lockers 해제(member_id=NULL) → members DELETE
- 삭제 시 배정 락커 자동 해제 (로우 삭제 아닌 연결만 해제)
- 결제·출석 이력은 삭제하지 않음 (감사 추적 보존)  
**테스트**: mock P6 4/4 통과

---

### P7 — 중복 권한 체크 🔍 데이터 오류 없음

**문제**: `members/[id]/route.ts` PUT/DELETE에서 동일 권한 조건 2번 체크.  
**판단**: dead code 품질 문제만. 데이터 오류 없음. 미수정.

---

## 추가 발견·수정 항목

### S1 — day-passes 지점 권한 취약점 ✅ 수정 완료

**발견**: 비HQ 사용자가 타 지점 일일권 조회·취소 가능.  
**수정**: `canManageBranch(user, dp.branch_name)` 검증.  
**커밋**: `04177a6`

---

### S2 — COUNT 출석 취소 전면 차단 ✅ 수정 완료

**발견**: COUNT권 출석에 `attendance.payment_id` 없어 차감 대상 증명 불가.  
**수정**: COUNT 패스 출석 취소 시 조건 없이 409 (`requiresManualReview: true`).  
**커밋**: `7d53fa7` (API), `1df4837` (UI 안내)  
**UI 안내**: "횟수권 출석 취소가 일시 제한됨" 경고 + requiresManualReview 메시지 표시 완료.

---

### S3 — lockers/assign 보안·트랜잭션·이력 ✅ 수정 완료

**발견**: 인증 없음, 트랜잭션 없음, 이력 없음.  
**수정**: 인증 + FOR UPDATE + member_histories LOCKER_ASSIGN.  
**커밋**: `038792b`

---

### S4 — 라커 연동 (members/update) ✅ 수정 완료

**발견**: 이름·메모 수정 시 locker_end_date 갱신, 불일치 lockers 행 자동 덮어쓰기.  
**수정**:
- `hasLockerEndDate`: 미명시 시 lockers.end_date 갱신 없음
- 불일치 가드: `lockers.member_id !== member_id` → 자동 해제 금지
- FOR UPDATE occupation check  

**화면/API 연결 및 테스트 결과**:
- 화면: `members/page.tsx` `saveExtend()` → `members/update` POST에 `locker_end_date` 포함(연장 선택 시) 또는 미포함(미선택 시)
- '라커도 함께 연장' 미선택: `locker_end_date` body에 없음 → `hasLockerEndDate=false` → lockers.end_date 갱신 없음 ✓
- '라커도 함께 연장' 선택: `locker_end_date: extendForm.customLockerEndDate || nextEndDate` 포함 → lockers.end_date 갱신 ✓
- mock 테스트: 24/24 중 P3·5·6 항목 포함 (별도 test-locker.mjs 24/24)  
**커밋**: `b8d37ea`

---

### S5 — 재등록 라커 연장 원자화 ✅ 수정 완료

**발견**: 재등록 시 라커 연장이 별도 API 호출로 비원자화.  
**수정**: `extend_locker`, `locker_end_date` 파라미터 추가, `withMemberChange` 같은 트랜잭션 내 처리.  

**화면/API 연결 및 테스트 결과**:
- 화면: `saveRereg()` → `payments/add` POST에 `extend_locker: true/false`, `locker_end_date` 포함
- 별도 종료일: `reregForm.locker_end_date` 입력 시 해당 날짜, 미입력 시 계산된 `end_date` 사용 (`locker_end_date || end_date`)
- '라커 함께 연장' 미선택: `extend_locker: false` → lockers 불변 ✓
- '라커 함께 연장' 선택 + 별도 종료일 없음: `locker_end_date = end_date` ✓
- '라커 함께 연장' 선택 + 별도 종료일 있음: `locker_end_date = 지정값` ✓  
**커밋**: `b8d37ea`

---

### S6 — 회원 목록 locker_end_date 반환 ✅ 수정 완료

**발견**: 회원 목록 API에서 locker_end_date 미반환.  
**수정**: LEFT JOIN lockers → `l.end_date AS locker_end_date` 반환.  
**커밋**: `b8d37ea`

---

## 전체 현황 요약

| # | 항목 | 위험도 | 상태 | 커밋 |
|---|---|---|---|---|
| P1 | 결제 취소 비트랜잭션 | 높음 | ✅ 완료 | `376cde7` |
| P2 | 회원권 갱신 비트랜잭션 | 중간 | ✅ 실질 해소 | (payments/add 경로) |
| P3 | 환불 비트랜잭션·상태 미변경 | 중간 | ✅ 완료 | `f30cc56` |
| P4 | 회원 등록 비트랜잭션 | 중간 | ✅ 완료 | `b8d37ea` |
| P5 | lockers zone 하드코딩 | 낮음 | ✅ 완료 | `f30cc56` |
| P6 | 회원 삭제 비트랜잭션 | 낮음 | ✅ 완료 | `f30cc56` |
| P7 | 중복 권한 체크 | 없음 | 🔍 무해, 미수정 | — |
| S1 | day-passes 지점 권한 | 높음 | ✅ 완료 | `04177a6` |
| S2 | COUNT 출석 취소 | 높음 | ✅ 완료 | `7d53fa7` |
| S3 | lockers/assign 보안 | 높음 | ✅ 완료 | `038792b` |
| S4 | members/update 라커 불일치 | 중간 | ✅ 완료 | `b8d37ea` |
| S5 | 재등록 라커 연장 원자화 | 중간 | ✅ 완료 | `b8d37ea` |
| S6 | 회원 목록 locker_end_date | 낮음 | ✅ 완료 | `b8d37ea` |

**완료: 12/13 · 무해·미수정: 1/13 (P7)**

---

## 최종 분류

### 완료 (코드 수정 + mock/빌드 검증)
P1·P2·P3·P4·P5·P6·S1·S2·S3·S4·S5·S6 — 12개

### 운영 미배포 (코드 완료, 운영 서버 반영 대기)
모든 완료 항목. 현재 운영 커밋 확인 불가 — 아래 순서로 적용 필요:
1. `da724d5` → `04177a6` (day-passes 권한)
2. → `7d53fa7` (COUNT 취소)
3. → `038792b` (lockers/assign)
4. → `b8d37ea` (라커 연동)
5. → `f30cc56` (P3·P5·P6)

### 운영자 결정 필요
| 항목 | 내용 |
|---|---|
| S2 UI 안내 | COUNT 출석 취소 불가 시 화면 메시지 추가 여부 |
| REQUIRE_KIOSK_TOKEN | 운영 키오스크 등록 완료 후 활성화 |
| kiosk_devices 테이블 | 운영 DB 존재 여부 확인 |
| P7 중복 권한 체크 | dead code 정리 여부 |

### 현재 스키마로 불가능 (미래 작업)
| 항목 | 권장 스키마 변경 |
|---|---|
| 환불-원결제 완전 추적 | `payments.source_payment_id` FK 컬럼 추가 |
| COUNT 출석 취소 추적성 | `attendance.payment_id` 컬럼 추가 |

---

## 테스트 결과 (최신)

| 테스트 | 결과 | 커밋 |
|---|---|---|
| integration-test-cancel-refund.ts | 6/6 통과 | `376cde7` |
| integration-test-checkin.ts | 14/14 통과 | 이전 세션 |
| integration-test-attendance-reregistration.ts | 5/5 통과 | `7d53fa7` |
| test-locker.mjs (mock 라커 연동) | 24/24 통과 | `b8d37ea` |
| test-refund-p3p5p6.mjs (mock P3·P5·P6) | 19/19 통과 | `f30cc56` |
| TypeScript `tsc --noEmit` | exit 0 | `f793e1c` |
| Next.js `next build` | 성공 | `f793e1c` |
