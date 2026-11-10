# 스트롱복싱 ERP 전체 구조 감사 보고서

> 작성 기준: 코드 정적 분석 (실제 DB 직접 접근 불가)
> 확인된 사실 / 추정 / 제안을 각 항목에 명시

---

## 1. 현재 구조 요약

| 항목 | 내용 |
|------|------|
| 프레임워크 | Next.js App Router (app/ 디렉토리 기반) |
| DB | MySQL (pool 기반, lib/db.ts) |
| 인증 | JWT (lib/auth.ts, localStorage 저장) |
| 권한 | ADMIN, OWNER, DIRECTOR, STAFF, KIOSK |
| 지점 | 철산점, 목동점, 개봉점, 신정점, 영등포점 |
| 주요 기능 영역 | 회원관리, 결제, 출석, SMS, 예약, CRM, 재무, 락커, HQ관리 |

---

## 2. DB 구조 분석

### 2-1. 중요 주의사항

`docs/db-schema.sql`은 초기 설계 스키마로, **실제 운영 DB와 큰 차이**가 있다.
코드에서 확인된 실제 테이블/컬럼이 초기 스키마에 없는 경우가 다수 존재한다.

**초기 스키마 vs 실제 사용 주요 차이:**

| 항목 | 초기 스키마 | 실제 코드 사용 |
|------|-----------|--------------|
| users.role | ENUM('OWNER','STAFF','KIOSK') | ADMIN, OWNER, DIRECTOR, STAFF, KIOSK |
| members 연결 | branch_id FK | branch_name 문자열 직접 사용 |
| users 연결 | branch_id FK | branch_name 문자열 직접 사용 |
| naver_reservations | 없음 | 실제 사용 중 |
| lockers | 없음 | 실제 사용 중 |
| locker_zones | 없음 | 실제 사용 중 |
| sms_logs | 없음 | 실제 사용 중 |
| sms_auto_rules | 없음 | 실제 사용 중 |
| settings_options | 없음 | 실제 사용 중 (BRANCH, PASS_PRODUCT, PRODUCT 등) |
| payments.history_type | 없음 | RENEWAL, REFUND 등 사용 중 |

---

### 2-2. 테이블 목록 (코드 기반 확인)

| 테이블 | 역할 | PK | 주요 컬럼 | 사용 화면/API | 문제점 |
|--------|------|-----|-----------|--------------|--------|
| **members** | 회원 정보 | member_id | branch_name, name, phone, checkin_code, pass_type, remaining_count, start_date, end_date, status, locker_no, join_date | /members, /member-detail, check-in | branch_id FK 없음(문자열). locker_no는 lockers.member_name과 별도 관리 |
| **payments** | 결제 이력 | payment_id | member_id, branch_name, payment_date, payment_method, product_name, pass_type, start_date, end_date, total_count, amount, final_amount, history_type, operator_name | /payments, /member-detail | start_date/end_date 중복 저장(members에도 있음). 초기 스키마에 없는 컬럼 다수 |
| **attendance** | 출입/출석 기록 | attendance_id | member_id, branch_name, member_name, checkin_time, result, pass_type, used_count | /check-in, /attendance-live | 초기 스키마는 branch_id FK였으나 실제는 branch_name 문자열 |
| **member_histories** | 회원 변경 이력 | history_id | member_id, member_name, action_type, action_memo, old_value(JSON), new_value(JSON), created_by | 모든 회원 조작에서 기록 | JSON 블롭 저장으로 쿼리 어려움 |
| **member_holds** | 휴회 기록 | hold_id | member_id, hold_start, hold_end, reason, released_at, released_by | /members, check-in | 휴회 해제 시 end_date 자동 계산 로직이 check-in에 있음(체크인 시점에 자동 해제) |
| **member_notes** | 회원 상담 메모 | note_id | member_id, note_type, content | /member-detail | — |
| **member_files** | 회원 첨부파일 | file_id | member_id, file_type, file_path, memo | /member-detail | — |
| **lockers** | 락커 배정 현황 | locker_id | branch_name, locker_zone, locker_no, member_id, member_name, gender, start_date, end_date | /lockers | member_name을 직접 저장(비정규화). member_id가 없어도 배정 가능 |
| **locker_zones** | 락커 구역 설정 | zone_id | branch_name, zone_name, start_no, end_no, sort_order, cols | /lockers | — |
| **naver_reservations** | 예약 통합 테이블 | reservation_id | branch_name, customer_name, phone, reservation_date, reservation_time, status, reservation_product, source_email_id, is_read | /naver-calendar, /naver-reservations, /homepage-reservations | 네이버/홈페이지/카카오 예약을 모두 이 테이블에 저장. 출처 구분은 memo 내용으로만 판단 |
| **sms_logs** | 문자 발송 이력 | log_id | branch_name, target_type, receiver_phone, message, send_status, provider, created_at | /sms | — |
| **sms_auto_rules** | 자동문자 규칙 | rule_id | rule_type, branch_name, message, use_yn, days, count_threshold | /sms | branch_name IS NULL = 전역, 값 있음 = 지점 오버라이드. UNIQUE KEY(rule_type, branch_name) |
| **settings_options** | 설정값 저장 | option_id | option_type, option_name, option_value, count_value, duration_months, use_yn | 전 화면 | BRANCH, PASS_PRODUCT, PRODUCT 등 여러 타입 혼합. PASS_PRODUCT는 count_value=0 문제 있음(별도 항목 참조) |
| **users** | 계정 | user_id | login_id, password_hash, name, role, branch_name, use_yn | /users, /login | 초기 스키마 role ENUM과 실제 role 불일치 |
| **crm_leads** | 상담 CRM | — | branch_name, customer_name, phone, status, next_contact_date | /crm, /crm-alerts | 초기 스키마에 crm_logs였으나 실제는 crm_leads |
| **calendar_events** | 일정/예약 등록 | event_id | branch_name, title, start_datetime, end_datetime | /calendar | — |
| **expenses** | 지출 | expense_id | branch_name, category, title, amount, expense_date | /finance | — |
| **daily_closings** | 일일마감 | — | branch_name, closing_date | /daily-closing | — |
| **notices** | 공지사항 | — | title, content | /notice | — |
| **kakao_templates** | 카카오 메시지 템플릿 | — | — | /kakao-templates | — |
| **lessons** | 수업 일정 | — | — | /lessons | — |
| **member_payments** | (별도 조회용 뷰 또는 테이블) | — | — | /api/member-payments | payments 테이블과 관계 불명확. 추정: 동일 테이블 다른 엔드포인트 |
| **hq_* 테이블들** | 본사 관련 | — | marketing_reports, assets, branches(hq용), content_projects 등 | /hq/* | — |

---

### 2-3. FK 현황

**코드에서 실제 FK 없이 문자열로 연결하는 관계:**

| 연결 | 방식 | 문제 |
|------|------|------|
| members ↔ lockers | branch_name 문자열 + locker_no 숫자 | 락커 삭제 시 연결 깨짐. 같은 번호 다른 구역 구분 불가 |
| payments → members | member_id 숫자 (FK 없음) | 회원 삭제 시 고아 레코드 가능 |
| attendance → members | member_id 숫자 (FK 없음) | 동상 |
| users → branch | branch_name 문자열 | 지점명 변경 시 불일치 |

**[확인됨]** `lockers.assign` API: member_id가 있으면 `members.locker_no`도 업데이트. `lockers.release` API: member_id로 `members.locker_no = NULL` 처리. **단, 락커 관리 화면에서 member_name만 입력하고 member_id 없이 배정하면 members 테이블은 업데이트되지 않는다.**

---

## 3. 데이터 흐름 점검

### 3-1. 신규 회원 등록

```
화면: /members (MembersPage) → 등록 폼
API: POST /api/members/add
테이블: members INSERT + member_histories INSERT(REGISTER)
```

**라커 연결**: 등록 폼에 `locker_no` 필드 있음. 그러나 `members.locker_no`만 저장되고, `lockers` 테이블에는 별도로 배정되지 않는다.  
**[문제-확인됨]** 회원 등록 시 `locker_no`를 입력해도 `lockers` 테이블에 행이 생성되지 않는다. 락커 관리 화면과 회원 정보 화면에서 보이는 락커 번호가 다를 수 있다.

**결제 연결**: 등록 후 `payment_amount > 0`이면 `/api/payments/add` 별도 호출. 단, 이 흐름은 `members/page.tsx:336-365`에서만 처리되며 `/api/members/add` 자체에는 없다. 중간에 실패하면 회원은 등록됐지만 결제 없는 상태 발생 가능.

### 3-2. 회원권 연장/재등록

**경로 1: /members 내 연장 버튼**
```
members/page.tsx openExtend() → POST /api/payments/add
→ payments INSERT + members UPDATE(product_name, start_date, end_date, remaining_count)
```

**경로 2: /members 내 재등록 버튼**
```
members/page.tsx saveRereg() → POST /api/members/[id]/renew
→ payments INSERT + members UPDATE + member_histories INSERT(RENEWAL)
```

**[문제-확인됨]** 두 경로가 다른 API를 사용해 동작이 다르다:
- `/api/payments/add`: `settings_options`에서 상품 조회 후 count_value/duration_months 계산
- `/api/members/[id]/renew`: 프론트가 보낸 total_count 그대로 저장

**이전 이력 보존**: payments 테이블에 history_type="RENEWAL"로 행 추가 + member_histories 기록. 기존 payments 행은 보존됨 ✓

### 3-3. 결제 등록/수정/취소/환불

| 작업 | API | 동작 |
|------|-----|------|
| 등록(신규) | POST /api/payments/add | payments + members 업데이트 |
| 등록(재등록) | POST /api/members/[id]/renew | payments + members 업데이트 |
| 수정 | PATCH /api/payments/[id] | payments UPDATE only |
| 취소 | POST /api/payments/cancel | memo에 '[취소]' 추가, final_amount=0, 마지막 결제이면 members.status=EXPIRED |
| 환불 | POST /api/member-refund | payments INSERT(history_type=REFUND, final_amount=-금액) + member_histories |

**[문제-추정]** 취소 처리가 `UPDATE payments SET memo = CONCAT('[취소]', ...)` 방식. 별도 status 컬럼 없어 취소 여부를 memo 문자열로 판단해야 한다.

### 3-4. 라커 배정/변경/해제

```
배정: POST /api/lockers/assign
→ lockers UPSERT (ON DUPLICATE KEY UPDATE)
→ member_id 있으면 members.locker_no 업데이트

해제: POST /api/lockers/release
→ lockers UPDATE (member_id=NULL, member_name=NULL, ...)
→ member_id 있었으면 members.locker_no=NULL 업데이트
```

**[문제-확인됨]** 중복 배정 방지 없음. 같은 `(branch_name, locker_zone, locker_no)` 조합에 ON DUPLICATE KEY UPDATE이므로 덮어씌워짐. 이전 배정자의 locker_no는 초기화되지 않는다.

### 3-5. 휴회/복귀

```
휴회 등록: POST /api/member-holds
→ member_holds INSERT + members.status='REST'
※ end_date 연장 없음 (휴회 등록만)

복귀: POST /api/member-holds/release
→ member_holds.released_at=NOW() + members.status='ACTIVE'
※ end_date 자동 연장 없음

체크인 시 자동 복귀: app/api/check-in/route.ts:123-178
→ 체크인 코드 입력 시 REST 상태 감지 → 휴회 기간 계산 → end_date 자동 연장 후 ACTIVE
```

**[문제-확인됨]** 휴회 등록 시 end_date가 연장되지 않는다. 연장은 오직 체크인 시점에만 발생한다. 수동 복귀(`/api/member-holds/release`) 시에는 end_date 연장이 없어 체크인 없이 복귀하면 종료일이 짧아질 수 있다.

---

## 4. 날짜 기준 정리

### 4-1. members 테이블 날짜 컬럼

| 컬럼 | 의미 | 계산 방법 |
|------|------|-----------|
| join_date | 회원 가입일 | 등록 시 start_date와 동일하게 설정 (members/add: `join_date || start_date`) |
| start_date | 현재 회원권 시작일 | 등록/재등록 시 프론트에서 직접 입력 |
| end_date | 현재 회원권 종료일 | 계산 방식 여러 곳에 분산 (아래 참조) |

### 4-2. 종료일 계산 방식 비교

| 위치 | 계산 방식 | 차이 |
|------|-----------|------|
| `members/page.tsx:7-11` | `start_date + months * 30 - 1일` | 30일 × 개월수, 시작일 포함 |
| `app/api/payments/add/route.ts:10-12` | `start_date + months * 30 - 1일` | 동일 |
| `app/members/page.tsx:447` | `end_date + 개월 추가` | 연장 시 현재 end_date 기준으로 추가 (만료 전 연장 가능) |
| `app/api/bulk-extend/route.ts:40` | `DATE_ADD(end_date, INTERVAL days DAY)` | DB 함수, 일 단위 |

**[확인됨]** 월 계산이 30일 고정 방식 (`30일 × 개월 - 1`). 실제 달력 월 계산 아님. 1개월 등록 시 30일 이용.

### 4-3. payments 테이블 날짜

| 컬럼 | 의미 |
|------|------|
| payment_date | 결제일 |
| start_date | 해당 결제의 회원권 시작일 |
| end_date | 해당 결제의 회원권 종료일 |

**[문제-추정]** members와 payments 양쪽에 start_date, end_date가 있어 최신 회원권 기간의 원본이 어느 테이블인지 불명확. 현재는 등록/재등록 시 payments에 저장하고 members도 UPDATE하는 패턴.

### 4-4. 운영 질문 (결정 필요)

- 오늘 결제하고 다음 주부터 시작하는 회원: start_date를 미래로 지정 가능하나, status='ACTIVE'로 저장되어 현재 체크인도 허용됨
- 만료 전 연장: `/members` 연장 버튼에서 현재 end_date > today이면 end_date 기준으로 추가 (`autoStart = end_date if > today else today`)

---

## 5. 기능 전체 목록

### 5-1. 회원 관련

| 기능명 | 경로 | 권한 | API | 구현 상태 | 중복/문제 |
|--------|------|------|-----|-----------|-----------|
| 회원관리 | /members | 모두 | /api/members/*, /api/members/add, /api/members/update, /api/members/[id] | 완성 | 등록+결제 미원자화 |
| 회원 상세 (PC) | /member-detail | 모두 | /api/members/detail, /api/member-detail/[id] | 완성 | URL에 member_id 쿼리파람 |
| 회원 상세 (모바일) | /mobile-member-detail | 모두 | /api/member-detail/[id] | 완성 | PC/모바일 중복 화면 |
| 회원 알림 | /member-alerts | 모두 | /api/member-alerts | 완성 | — |
| 회원권 만료 | /member-expiring | 모두 | /api/members/expiring | 완성 | — |
| 재등록 관리 | /renewal | 모두 | /api/member-alerts, /api/sms/send | 주의: 재등록 SMS 발송용. 실제 재등록 처리는 /members에서 | 명칭과 기능 불일치 |
| 락커 관리 | /lockers | 모두(관장 이상) | /api/lockers, /api/lockers/assign, /api/lockers/release, /api/locker-zones | 완성 | 회원 등록 시 연동 안됨 |
| 기간 일괄 연장 | /bulk-extend | 모두 | /api/bulk-extend | 완성 | — |

### 5-2. 예약/상담 관련

| 기능명 | 경로 | API | 구현 상태 | 비고 |
|--------|------|-----|-----------|------|
| 예약 등록 | /calendar | /api/calendar-events/add, /api/public-calendar-events | 완성 | 내부 일정 등록 |
| 예약 캘린더 | /naver-calendar | /api/naver-reservations | 완성 | **파일명/컴포넌트명이 'Naver'지만 실제 통합 캘린더** |
| 네이버 예약 | /naver-reservations | /api/naver-reservations | 완성 | 목록 뷰 |
| 홈페이지 예약 관리 | /homepage-reservations | /api/naver-reservations (동일!) | 완성 | **같은 API, 같은 테이블** |
| 상담 CRM | /crm | /api/crm | 완성 | — |
| 재연락 상담 | /crm-alerts | /api/crm-alerts | 완성 | — |

### 5-3. 결제/재무

| 기능명 | 경로 | API | 구현 상태 |
|--------|------|-----|-----------|
| 결제관리 | /payments | /api/payments | 완성 |
| 월별매출 | /monthly-sales | /api/sales/monthly | 완성 |
| 재무 | /finance | /api/expenses, /api/finance/summary | 완성 |
| 재무 요약 | /finance-summary | /api/finance/summary | 완성 |
| 일일 마감 | /daily-closing | /api/daily-closing, /api/closings/daily | 완성 |

### 5-4. 문자/알림

| 기능명 | 경로 | API | 구현 상태 |
|--------|------|-----|-----------|
| 문자관리 | /sms | /api/sms/send, /api/sms/auto-rules | 완성 |
| 공지사항 | /notice | /api/notices | 완성 |
| 알림센터 | /alerts-center | /api/alerts-center | 완성 |

### 5-5. 설정/계정

| 기능명 | 경로 | API | 구현 상태 |
|--------|------|-----|-----------|
| 계정관리 | /users | /api/users, /api/users/approve | 완성 |
| 권한관리 | /permissions | /api/permissions | 완성 |
| 설정관리 | /settings | /api/settings | 완성 |

### 5-6. 대시보드/분석

| 기능명 | 경로 | API | 구현 상태 |
|--------|------|-----|-----------|
| 대시보드 (어드민) | /dashboard | /api/dashboard | 완성 |
| 관장 대시보드 | /director-dashboard | /api/dashboard/summary | 완성 |
| 대표 모바일 | /mobile-owner | — | 완성 |
| 관장 모바일 | /mobile-branch | — | 완성 |

### 5-7. 메뉴에 없거나 접근 제한된 화면

| 경로 | 상태 |
|------|------|
| /test-checkin | 개발/테스트용. 메뉴 없음 |
| /check-in | 출석 체크인 (키오스크 화면). 메뉴 없음 |
| /kiosk | 키오스크 전용. 메뉴 없음 |
| /public-calendar | 공개 캘린더. 별도 layout |
| /schedule-calendar | 일정 캘린더 (내부용) |
| /attendance-live | 실시간 출석 현황 |
| /attendance-monitor | 출석 모니터 |
| /mobile-attendance | 모바일 출석 |
| /mobile-members | 모바일 회원 목록 |
| /mobile-crm | 모바일 CRM |
| /mobile-payments | 모바일 결제 |
| /mobile-monthly-sales | 모바일 월별매출 |
| /sales-report | 매출 리포트 |
| /marketing | 마케팅 |
| /targets | 목표 관리 |

---

## 6. 예약 캘린더 구조 점검

### 6-1. 명칭 혼재 현황

| 위치 | 현재 명칭 | 비고 |
|------|-----------|------|
| 메뉴 항목 | "예약 캘린더" | AppShell.tsx:32 |
| 페이지 URL | /naver-calendar | — |
| 페이지 파일 | app/naver-calendar/page.tsx | — |
| 컴포넌트명 | NaverCalendarPage | — |
| 메뉴의 별도 항목 | "네이버 예약" (/naver-reservations) | — |
| 메뉴의 별도 항목 | "홈페이지 예약 관리" (/homepage-reservations) | — |
| 싱크 API | /api/naver-reservations/sync | Gmail에서 네이버/홈페이지/카카오 예약 수집 |

### 6-2. 예약 경로별 데이터 흐름

| 경로 | 수집 방식 | 저장 테이블 | 고유 식별자 | 캘린더 표시 | 문제 |
|------|-----------|------------|------------|------------|------|
| 네이버 예약 | Gmail 이메일 파싱 (GET /api/naver-reservations/sync) | naver_reservations | source_email_id + reservation_no | /naver-calendar | — |
| 홈페이지 예약 | Gmail 이메일 파싱 (동일 sync API, 제목으로 구분) | naver_reservations (동일!) | source_email_id + reservation_no | /naver-calendar | 같은 테이블 |
| 카카오 예약 | Gmail 이메일 파싱 (동일 sync API) | naver_reservations (동일!) | source_email_id | /naver-calendar | 같은 테이블 |
| 관리자 직접 등록 | POST /api/calendar-events/add | calendar_events (별도 테이블) | event_id | /calendar (/public-calendar) | **다른 테이블, 다른 화면** |

**[문제-확인됨]** `naver_reservations`와 `calendar_events`는 별개 테이블이며 각각 다른 화면에서 보여준다. 통합 캘린더가 아니라 사실상 두 개의 분리된 화면이 존재한다.

### 6-3. 화면 중복 문제

**[문제-확인됨]** `/naver-reservations`(네이버 예약 화면)와 `/homepage-reservations`(홈페이지 예약 관리 화면)가 **완전히 같은 API** (`/api/naver-reservations`)를 사용한다. `homepage-reservations/page.tsx:86`에서 `/api/naver-reservations` 호출. getSourceInfo() 함수가 memo 내용의 "출처: 홈페이지 예약" 텍스트로 출처 구분.

이 두 화면은 거의 동일한 코드로 같은 데이터를 보여주는 중복 화면이다.

### 6-4. 예약 → 회원 전환

```
/naver-reservations 화면 → "회원 등록" 버튼
→ POST /api/naver-reservations/[id]/convert-member
→ members INSERT + naver_reservations.status='회원등록완료'
```

중복 회원 방지: 없음. 이름+전화번호가 같아도 새 회원이 생성된다.

### 6-5. 명칭 변경 시 영향 범위

`/naver-calendar` → `/reservation-calendar` 또는 `/calendar-reservations`로 변경 시:

| 영향 항목 | 위치 |
|-----------|------|
| 파일/디렉토리 | app/naver-calendar/ |
| 컴포넌트명 | NaverCalendarPage |
| 메뉴 링크 | AppShell.tsx:32 |
| 내부 링크 | 검색 필요 |

---

## 7. 발견한 문제점 목록

### 확인된 문제 (코드에서 직접 확인)

> 상태 기준 커밋: `f793e1c` (2026-11-10)

| # | 문제 | 위치 | 심각도 | **상태** |
|---|------|------|--------|---------|
| P1 | **회원 등록 시 라커 정보가 lockers 테이블에 저장되지 않음** | app/api/members/add/route.ts (locker_no 저장 없음), app/api/lockers/assign/route.ts | 높음 | ✅ 완료 `b8d37ea` — lockers INSERT 같은 트랜잭션에서 처리 |
| P2 | **락커 중복 배정 방지 없음** (새 배정 시 이전 사용자 locker_no 초기화 안 됨) | app/api/lockers/assign/route.ts:11-23 | 높음 | ✅ 완료 `038792b` — FOR UPDATE + 중복 거부. ⚠️ 단, 이전 배정자 members.locker_no 초기화는 lockers/release를 별도 호출해야 함 |
| P3 | **휴회 복귀 시 end_date 연장 없음** (체크인 시에만 자동 연장) | app/api/member-holds/release/route.ts | 중간 | ✅ 완료 — `computeReleaseEnd()` 사용, 수동 복귀 시에도 잔여 기간 반영 |
| P4 | **/renewal 페이지가 SMS 발송만 하는 화면** (재등록 처리 UI 없음). 명칭 오해 가능 | app/renewal/page.tsx | 낮음 | 🔍 미수정 — 기능 오류 없음, 명칭 문제만 |
| P5 | **회원 등록과 결제 등록이 비원자적** (members/add 성공 후 payments/add 실패 가능) | app/members/page.tsx:330-365 | 높음 | ⚠️ 부분 완료 `b8d37ea` — members INSERT 자체는 트랜잭션. 그러나 화면에서 결제 API를 별도 호출하는 구조는 유지됨. 완전한 원자화는 미래 작업 |
| P6 | **homepage-reservations가 naver-reservations와 동일 API 사용** (중복 화면) | app/homepage-reservations/page.tsx:86 | 낮음 | 🔍 미수정 — 의도적 중복 화면으로 판단, 기능 오류 없음 |
| P7 | **결제 취소가 memo 문자열로만 표시** (status 컬럼 없음) | app/api/payments/cancel/route.ts:18 | 중간 | 🔍 미수정 — 스키마 변경 필요, 이번 배포 범위 외 |
| P8 | **members.status 자동 보정 로직이 프론트에 있음** (EXPIRED인데 end_date > today이면 ACTIVE로) | app/members/page.tsx:311-313 | 낮음 | 🔍 미수정 — 화면 표시 보정용, DB 직접 오염 없음 |
| P9 | **users 초기 스키마 role ENUM과 실제 role 불일치** | docs/db-schema.sql:16, 실제 코드 | 중간 | 🔍 미수정 — 스키마 문서 불일치, 운영 동작에 영향 없음 |
| P10 | **members.total_count 초기 등록 시 계산 방식이 세 곳에 분산** | members/page.tsx:286-290, payments/add:71-74, members/[id]/renew | 중간 | 🔍 미수정 — 세 곳이 동일 공식 사용 중, 즉각 오류 없음 |
| P11 | **관장(DIRECTOR)이 락커 배정 시 member_id 없이 member_name만 입력** → members.locker_no 연동 불가 | lockers/page.tsx:68-91 | 중간 | 🔍 미수정 — lockers/assign에서 member_id 없으면 members 업데이트 안 함(코드 L52 조건부) |

### 추정 문제 (추가 확인 필요)

| # | 추정 | 근거 | 확인 방법 | **상태** |
|---|------|------|-----------|---------|
| A1 | settings_options.count_value가 0으로 세팅되어 있어 COUNT 타입 상품의 횟수가 0으로 등록될 수 있음 | 이전 대화에서 count_value=0 확인됨 | DB에서 SELECT * FROM settings_options WHERE option_type='PASS_PRODUCT' | ⚠️ 미확인 — 운영 DB 직접 확인 필요 |
| A2 | calendar_events와 naver_reservations가 통합되지 않아 예약 캘린더가 불완전 | 두 화면의 API 분석 | 화면 직접 확인 | 🔍 의도적 분리 — 두 화면이 의도적으로 다른 용도 사용 중 |
| A3 | 초기 스키마 db-schema.sql과 실제 DB 테이블 구조 대폭 불일치 | db-schema.sql 분석 | 실제 DB SHOW CREATE TABLE 비교 | ⚠️ 미확인 — 운영 DB 직접 확인 필요. 초기 스키마는 참고용으로만 사용할 것 |

---

## 8. 권장 데이터 구조 및 화면 구성 제안

### 8-1. 라커 연동 개선

```
회원 등록 시 locker_no 입력 → lockers 테이블에도 자동 INSERT/UPDATE
(branch_name + locker_no 조합으로 upsert)
```

### 8-2. 결제 취소 개선

```
payments 테이블에 status ENUM('ACTIVE','CANCELLED','REFUNDED') 추가
```

### 8-3. 예약 캘린더 명칭 통일 제안

| 현재 | 제안 |
|------|------|
| /naver-calendar | /reservation-calendar |
| NaverCalendarPage 컴포넌트 | ReservationCalendarPage |
| "예약 캘린더" 메뉴 | 유지 |
| /naver-reservations | /reservations |
| /homepage-reservations | 제거 또는 /reservations에 필터 탭으로 통합 |

### 8-4. 회원 상세 화면 개선

현재 PC(/member-detail)와 모바일(/mobile-member-detail)이 별도 화면. 하나로 통합하거나 반응형으로.

---

## 9. 운영자가 결정해야 하는 질문

| # | 질문 | 현재 동작 |
|---|------|-----------|
| Q1 | 월 계산: 30일 고정 vs 실제 달력 월? | 30일 고정 (members/page.tsx:9) |
| Q2 | 라커 기간이 회원권 기간과 독립적으로 관리되어야 하는가? | 현재 lockers 테이블에 별도 start_date/end_date 있음 |
| Q3 | 오늘 결제하고 다음 주 시작 시 현재 체크인 허용 여부? | start_date 미래이어도 status='ACTIVE'면 체크인 가능 |
| Q4 | 휴회 복귀 시 end_date 자동 연장 허용 여부? | 현재 체크인 시만 자동 연장 |
| Q5 | 같은 이름+전화번호로 중복 회원 허용 여부? | 현재 중복 체크 없음 (checkin_code만 중복 체크) |
| Q6 | 만료일 포함 여부: `end_date` 당일에 운동 가능한가? | check-in 코드에서 end_date >= today 조건 필요, 현재 확인 필요 |
| Q7 | 결제 취소 후 회원 상태를 어떻게 처리해야 하는가? | 현재 마지막 결제 취소 시 EXPIRED, 나머지는 그대로 |
| Q8 | 카카오 예약이 현재 활성화되어 있는가? | sync API에 카카오 파싱 로직 있음 |

---

## 10. 우선순위별 수정 계획

| 우선순위 | 항목 | 작업 | 위험도 |
|----------|------|------|--------|
| 1 (즉시) | P1: 회원 등록 시 lockers 테이블 연동 | /api/members/add에 로직 추가 | 낮음 |
| 1 (즉시) | A1: settings_options.count_value 확인 및 수정 | DB 직접 확인 후 올바른 값 입력 | 낮음 |
| 2 (단기) | P2: 락커 중복 배정 방지 | /api/lockers/assign에 이전 배정자 locker_no 초기화 추가 | 낮음 |
| 2 (단기) | P5: 회원 등록+결제 원자화 | /api/members/add에 결제 로직 통합 또는 트랜잭션 | 중간 |
| 3 (중기) | P6: homepage-reservations 중복 화면 제거 | naver-reservations에 출처 필터 탭 추가 후 제거 | 낮음 |
| 3 (중기) | 예약 캘린더 명칭 통일 | URL/파일/컴포넌트 이름 변경 | 중간 |
| 4 (장기) | P7: 결제 취소 status 컬럼 추가 | DB ALTER + 코드 수정 | 중간 |
| 4 (장기) | 초기 스키마와 실제 DB 일치화 | 실제 DB SHOW CREATE TABLE 후 schema 문서 업데이트 | 낮음 |

---

## 11. 프로젝트 지침 (신규 개발 시 체크리스트)

다음 사항을 신규 기능 개발 전 항상 확인할 것:

1. **회원 관련 변경**: members, payments, member_histories 세 테이블 모두 영향 확인
2. **라커 변경**: lockers ↔ members.locker_no 양방향 동기화 확인
3. **예약 관련**: naver_reservations(예약 목록)과 calendar_events(내부 일정) 구분
4. **날짜 계산**: 30일 고정 방식 (`months * 30 - 1`) 사용 (members/page.tsx:7-11 참조)
5. **SMS 발송**: /api/sms/send(수동), /api/sms/auto-run(자동크론), /api/sms/auto-rules(설정) 구분
6. **권한 체크**: ADMIN/OWNER는 전 지점, DIRECTOR는 자신의 지점만
7. **결제 처리**: /api/payments/add(신규)와 /api/members/[id]/renew(재등록)의 동작 차이 확인
8. **예약 캘린더 수정 시**: naver-reservations(목록), naver-calendar(캘린더), homepage-reservations(홈페이지 예약), /api/naver-reservations/sync(Gmail 수집) 모두 영향 확인

---

*문서 작성 기준: 코드 정적 분석 / 실제 DB 접근 불가 / 추정 항목은 명시함*
