# STRONG ERP DB 구조 진단 보고서

> **작성일**: 2026-11-08  
> **범위**: 읽기 전용 코드 경로 분석 (운영 데이터·스키마 변경 없음)  
> **대상**: `app/api/` 전체 149개 라우트 파일

---

## 1. 테이블 목록

코드 경로에서 확인된 테이블 목록입니다.

| 테이블 | 역할 |
|---|---|
| `members` | 회원 현재 상태 (1행 = 1회원권) |
| `payments` | 결제 원장 (append-only 의도, 실제는 수정·삭제 가능) |
| `member_histories` | 변경 이력 JSON 스냅샷 |
| `attendance` | 출석 체크인 로그 |
| `member_holds` | 일시정지(홀드) 기록 |
| `lockers` | 락커 현재 배정 상태 |
| `locker_zones` | 락커 구역 메타 |
| `daily_closings` | 일일 마감 스냅샷 |
| `sms_logs` | SMS 발송 이력 |
| `sms_auto_rules` | 자동 문자 발송 규칙 |
| `naver_reservations` | 네이버 예약 연동 |
| `crm_leads` | CRM 잠재고객 |
| `staff` | 직원 계정 |
| `branches` | 지점 |
| `products` | 상품 |
| `expenses` | 지출 |
| `coupons` | 쿠폰 |
| `notifications` | 알림 |

---

## 2. 핵심 테이블 구조 (코드 추론)

### 2-1. `members`

회원의 **현재 회원권 상태**를 단일 행에 저장합니다. 재등록 시 덮어쓰기됩니다.

```
member_id       PK
branch_name
name, phone, phone_last4, checkin_code
product_name    현재 상품명
pass_type       'COUNT' | 'PERIOD'  (일부 코드는 'DATE' 사용 — 불일치 존재)
remaining_count 횟수권 잔여
start_date, end_date
status          'ACTIVE' | 'EXPIRED' | 'REST' | 'DELETED'
locker_no
member_no, gender, birth_date, staff_name, memo
```

> **설계 한계**: 과거 회원권 이력을 `members`에서 직접 조회할 수 없습니다. `payments` + `member_histories`로만 추적 가능합니다.

### 2-2. `payments`

```
payment_id      PK
member_id       FK → members (NULL 허용: 비회원 결제)
branch_name
payment_date
payment_method
product_name
pass_type
amount, discount_amount, refund_amount, final_amount
history_type    'REGISTER' | 'RENEWAL' | 'REFUND' | NULL
total_count     횟수권 총 횟수
start_date, end_date
memo
```

### 2-3. `attendance`

```
attendance_id   PK
member_id
branch_name, member_name
pass_type, used_count
result          'SUCCESS' | 'FAIL' | ...
created_at
```

> `payment_id` 컬럼 없음 — 어떤 결제와 연결된 출석인지 역추적 불가

### 2-4. `member_holds`

```
hold_id         PK
member_id
hold_start, hold_end
reason
```

---

## 3. 주요 데이터 흐름

### 3-1. 회원 등록 (`POST /api/members`)

1. `members` INSERT
2. 락커 번호 있으면 `lockers` UPSERT
3. `member_histories` INSERT (action: REGISTER)

**트랜잭션 없음** — 3번 실패 시 이력 누락, 롤백 없음

### 3-2. 갱신 (`POST /api/members/[id]/renew`)

1. `payments` INSERT (history_type: RENEWAL)
2. `members` UPDATE (product_name, start_date, end_date, pass_type, remaining_count 덮어쓰기)
3. `member_histories` INSERT (action: RENEWAL)

**트랜잭션 없음** — 1번 성공 후 2번 실패 → payments에 결제 기록은 있으나 회원권 갱신 미반영

### 3-3. 체크인 (`POST /api/check-in`)

1. 오늘 중복 체크인 방지 쿼리
2. 횟수권: `members.remaining_count - 1` UPDATE
3. `attendance` INSERT
4. `member_histories` INSERT

**트랜잭션 없음** — 2번 성공 후 3번 실패 → 횟수 차감됐으나 출석 기록 없음

**자동 홀드 해제**: status='REST'이고 hold_end < 오늘이면 자동으로 end_date 연장 후 ACTIVE 전환 — 명시적 해제 API 없이 체크인 시점에 처리됨

### 3-4. 일시정지 (`POST /api/member-holds`)

1. `member_holds` INSERT
2. `members.status = 'REST'` UPDATE

end_date 연장은 하지 않음 — 다음 체크인 시점에 자동 처리됨

### 3-5. 환불 (`POST /api/member-refund`)

1. `payments` INSERT (final_amount = -refund_amount, history_type: REFUND)

원본 payment_id 연결 없음 — 어떤 결제를 환불한 것인지 역추적 불가

members.status 또는 end_date 변경 없음

### 3-6. 결제 취소 (`POST /api/payments/cancel`)

1. 원본 payments 행 UPDATE: `memo = '[취소] ' + 기존memo`, `refund_amount = final_amount`, `final_amount = 0`
2. 해당 회원의 양수 payments가 없으면 `members.status = 'EXPIRED'`

**원본 금액 파괴적 수정** — amount, discount_amount는 그대로지만 final_amount가 0이 되어 원래 결제금액 복원 어려움

---

## 4. 무결성 이슈 목록

### 🔴 심각

| # | 위치 | 내용 |
|---|---|---|
| I-01 | 전체 API | **트랜잭션 없음** — 149개 라우트 전체에 `BEGIN/COMMIT` 없음. 멀티 쿼리 도중 오류 시 부분 저장 발생 |
| I-02 | `payments/cancel` | **원본 결제 금액 파괴적 수정** — final_amount를 0으로 덮어씀. 원복 불가 |
| I-03 | `payments/delete` | **hard DELETE** — 결제 기록 영구 삭제, 소프트 삭제 없음 |
| I-04 | `members` DELETE(`[id]/route.ts`) | **hard DELETE** — 연결된 payments, attendance 고아 레코드 발생 가능 |

### 🟠 주의

| # | 위치 | 내용 |
|---|---|---|
| I-05 | `member-refund` | 환불 행에 원본 payment_id 없음 — 어떤 결제 환불인지 연결 불가 |
| I-06 | `attendance` | payment_id 없음 — 출석이 어떤 회원권 기간에 속하는지 연결 불가 |
| I-07 | `lockers` | 락커 배정 이력 없음 — 현재 배정 상태만 존재, 과거 사용자 조회 불가 |
| I-08 | `daily_closings` | 스냅샷 테이블 — 이후 payments 수정/삭제 시 stale 데이터가 됨 |
| I-09 | `members/bulk-extend` | `pass_type = 'DATE'` 하드코딩 — 다른 코드의 `'PERIOD'`와 불일치 |
| I-10 | 회원 삭제 경로 충돌 | `DELETE /api/members/[id]` → hard DELETE, `POST /api/members/delete` → `status='DELETED'` soft DELETE — 두 경로가 동시 존재 |

### 🟡 참고

| # | 위치 | 내용 |
|---|---|---|
| I-11 | `finance/summary` | `SUM(amount)` 사용 — `sales/monthly`, `finance/stats`는 `SUM(final_amount)` 사용. 집계 기준 불일치 |
| I-12 | KST 날짜 처리 | 대부분 `new Date().toISOString().slice(0,10)` (UTC 기준) — `Date.now() + 9h` 오프셋 처리와 혼재 |
| I-13 | `members/import` | 엑셀 임포트 시 `member_histories` 미기록, `payments` 미생성 |
| I-14 | `add-guest/route.ts` | 비회원 결제 시 `pass_type='PERIOD'` 하드코딩 — 비회원 결제 타입 구분 불가 |

---

## 5. pass_type 불일치 상세

`pass_type` 컬럼에 사용되는 값이 코드 위치에 따라 다릅니다.

| 값 | 사용 위치 |
|---|---|
| `'PERIOD'` | `payments/add`, `renew`, `add-guest`, check-in |
| `'DATE'` | `members/bulk-extend`, `member-alerts`, `sms/targets` |
| `'COUNT'` | 전체 (일관성 있음) |

**영향**: bulk-extend로 연장된 회원의 pass_type이 'DATE'로 저장되면, 'PERIOD' 조건으로 필터하는 쿼리에서 누락됩니다.

---

## 6. 권장 개선 방향

> 아래는 진단 결과 기반 권고사항입니다. 실제 작업은 별도 세션에서 진행하세요.

### 단기 (데이터 무결성)

1. **pass_type 통일**: `'DATE'` → `'PERIOD'`로 일괄 수정 (코드 3곳 + 기존 DB 데이터)
2. **환불 테이블 연결**: `payments` 환불 행에 `original_payment_id` 컬럼 추가
3. **결제 소프트 삭제**: `payments.deleted_at` 컬럼 추가, hard DELETE 차단

### 중기 (트랜잭션)

4. **핵심 멀티쿼리에 트랜잭션 추가**: renew, check-in, member-delete 최소 3개 경로부터 적용
5. **회원 삭제 경로 통일**: hard DELETE 경로 제거, soft DELETE만 유지

### 장기 (스키마)

6. **membership_passes 테이블 분리**: `members`에서 회원권 정보를 별도 테이블로 분리하여 이력 추적 가능하게
7. **attendance.payment_id 추가**: 출석-결제 연결
8. **locker_assignments 이력 테이블 추가**

---

## 7. 검증 쿼리 (읽기 전용)

아래 쿼리로 주요 이슈를 확인할 수 있습니다.

```sql
-- 접속
-- mysql -u root -p strongboxing

-- pass_type 값 분포
SELECT pass_type, COUNT(*) FROM members GROUP BY pass_type;
SELECT pass_type, COUNT(*) FROM payments GROUP BY pass_type;

-- 환불 행 (원본 연결 없음 확인)
SELECT payment_id, member_id, final_amount, history_type FROM payments WHERE history_type = 'REFUND' LIMIT 10;

-- final_amount=0인 결제 (취소된 것들)
SELECT payment_id, member_id, amount, final_amount, memo FROM payments WHERE final_amount = 0 LIMIT 10;

-- hard DELETE된 회원에 남은 고아 payments
SELECT p.payment_id, p.member_id FROM payments p LEFT JOIN members m ON p.member_id = m.member_id WHERE m.member_id IS NULL AND p.member_id IS NOT NULL LIMIT 10;

-- daily_closings 최신 vs payments 집계 비교
SELECT branch_name, closing_date, total_sales FROM daily_closings ORDER BY closing_date DESC LIMIT 5;
```

---

*이 보고서는 코드 정적 분석으로 작성되었습니다. 운영 데이터·스키마는 변경하지 않았습니다.*
