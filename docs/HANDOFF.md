# 긴급 수정 배포 핸드오프

**배포일**: 2026-11-10  
**배포 브랜치**: `hotfix/minimal-fix` (커밋 `da724d5`)  
**기준 커밋**: `5e116f00` (운영 HEAD 기준)  
**운영 서버**: `/home/ubuntu/strongboxing-erp`, pm2 프로세스 `strongboxing-erp`

---

## 배포된 수정

### Bug 1 — 4자리 초과 입장번호 실패
| 파일 | 변경 |
|------|------|
| `app/kiosk/page.tsx` | 키패드 최대 입력 `4 → 8`자리 |
| `app/api/check-in/route.ts` | 코드 검증 `^\d{4}$` → `^\d{1,8}$` |
| `app/api/members/add/route.ts` | 코드 검증 `^\d{4}$` → `^\d{1,8}$` |

**검증 결과**: 운영에서 긴 입장번호 입퇴장 정상 동작 확인 ✅

### Bug 2 — 회원 재등록 화면 일일권 저장 실패
| 파일 | 변경 |
|------|------|
| `app/api/payments/add/route.ts` | DAILY pass_type 처리 블록 추가 (members 불변, payments + day_passes INSERT) |
| `app/api/check-in/route.ts` | 오늘 PENDING day_pass 있으면 DAILY 체크인 처리 |
| `app/api/attendance/delete/route.ts` | DAILY 출석 취소 시 day_pass PENDING 복원 |
| `app/api/day-passes/route.ts` | 신규: 일일권 조회 API |
| `app/api/day-passes/cancel/route.ts` | 신규: 일일권 취소 API |
| `app/members/page.tsx` | 재등록 폼 — DAILY 상품 선택 시 이용일 입력 필드 표시 |

**검증 결과**: 운영에서 일일권 저장 정상 동작 확인 ✅

---

## 실행한 DB 변경 (운영 strongboxing DB)

```sql
-- payments.pass_type에 DAILY 추가
ALTER TABLE payments
  MODIFY COLUMN pass_type ENUM('COUNT','PERIOD','DAILY') NULL;

-- day_passes 테이블 생성
CREATE TABLE IF NOT EXISTS day_passes (
  pass_id       BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  payment_id    BIGINT UNSIGNED NOT NULL,
  member_id     BIGINT UNSIGNED NOT NULL,
  branch_name   VARCHAR(100) NOT NULL,
  use_date      DATE NOT NULL,
  status        ENUM('PENDING','USED','CANCELLED') NOT NULL DEFAULT 'PENDING',
  used_at       DATETIME NULL,
  attendance_id BIGINT UNSIGNED NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (pass_id),
  INDEX idx_dp_member (member_id),
  INDEX idx_dp_payment (payment_id),
  INDEX idx_dp_usedate (use_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 일일권 상품 마스터 option_value 설정 (option_id 30, 31)
UPDATE settings_options SET option_value = 'DAILY' WHERE option_id IN (30, 31);
```

---

## 일일권 흐름 검증 현황

| 항목 | 상태 | 비고 |
|------|------|------|
| 일일권 저장(payments + day_passes INSERT) | ✅ 운영 확인 | 운영에서 직접 확인 |
| 일일권 체크인(PENDING → USED) | ✅ 운영 확인 | 운영에서 직접 확인 |
| day-passes 조회 API | ✅ mock 통과 | DB 미검증 |
| day-passes 취소 API(지점 권한 포함) | ✅ mock 통과 | DB 미검증 |
| DAILY 출석 취소 → day_pass PENDING 복원 | ✅ mock 통과 | DB 미검증, 운영 테스트 미실시 |
| DAILY 출석 취소 → 지난 날짜 CANCELLED 처리 | ✅ mock 통과 | DB 미검증 |
| COUNT 출석 취소 (시작일 당일, 단일 패스) | ✅ mock 통과 | DB 미검증 |
| COUNT 출석 취소 (시작일 당일, 당일 재결제) | ✅ mock 통과 | DB 미검증 |

---

## 확인하지 않은 항목

- DAILY 체크인 후 출석 취소 → day_pass PENDING 복원 흐름 (attendance/delete DAILY 복원 로직은 배포됐으나 실제 케이스 테스트 미완)
- `/api/day-passes` 조회 API 및 `/api/day-passes/cancel` 취소 API — 배포됐으나 UI 연동 없음, 직접 호출 테스트 미실시
- 8자리 입장번호 신규 등록(members/add) 실제 운영 테스트 미실시 (체크인만 확인)

---

## 배포하지 않은 나머지 개선 작업

다음 항목들은 `main` 브랜치 또는 별도 feature 브랜치에 존재하며 이번 배포에서 제외됐습니다.

| 항목 | 위치 | 비고 |
|------|------|------|
| 비회원 결제 간소화 (이름·연락처 선택, 지점 고정) | `main` 미병합 | 별도 배포 필요 |
| 직원 지점 접근 권한 (`canAccessBranch`) | `main` 미병합 | |
| 키오스크 기기 인증 (`REQUIRE_KIOSK_TOKEN`) | `main` 미병합 | **운영 키오스크 등록 전까지 활성화 금지** |
| 한글 저장 검증 | `main` 미병합 | |
| CRM 개선, 월간 매출 개선 등 기타 기능 | `main` 미병합 | |
| `withMemberChange` / `taggedQuery` 감사 로그 체계 | `main` 미병합 | |

---

## 배포·롤백 절차

### 배포 (최종 검증 커밋 고정)

```bash
# 운영 서버에서 — 반드시 커밋 해시를 지정해 git pull로 후속 커밋이 포함되지 않도록 함
cd /home/ubuntu/strongboxing-erp
git fetch origin
git checkout 90909da        # 최종 검증 커밋 (fix: COUNT 출석 취소 — 시작일 당일 케이스 허용)
npm run build
pm2 restart strongboxing-erp
```

> **왜 커밋 해시를 고정하는가**: `git pull`은 그 시점의 최신 커밋까지 모두 가져오므로
> 검증되지 않은 후속 커밋이 배포될 수 있음. 커밋 해시 checkout은 정확히 검증한 상태만 배포.

### 배포 전 필수 확인 (운영 서버 접근 필요)

```bash
# 운영 .env REQUIRE_KIOSK_TOKEN 설정 여부 확인 (읽기 전용)
grep REQUIRE_KIOSK_TOKEN /home/ubuntu/strongboxing-erp/.env

# kiosk_devices 등록 여부 확인 (읽기 전용)
# mysql -u root -p strongboxing -e "SELECT device_id, branch_name, revoked_at FROM kiosk_devices LIMIT 10;"
```

- REQUIRE_KIOSK_TOKEN이 "true"로 설정돼 있으면 → 운영 키오스크가 등록됐는지 확인 후 배포
- 미설정이면 → 기존 키오스크 차단 없음, 안전

### 코드 롤백 (운영 DB 변경 없음)

```bash
# 운영 서버에서
cd /home/ubuntu/strongboxing-erp
git checkout 5e116f00
npm run build
pm2 restart strongboxing-erp
```

**코드 롤백 시 기존 DAILY 데이터 호환성:**
- `payments` 테이블의 DAILY 행은 그대로 조회 가능 (ENUM에 DAILY가 남아 있음)
- `day_passes` 테이블은 그대로 존재, 데이터 보존
- 단, 5e116f00 코드에는 DAILY 처리 로직이 없으므로 **신규 일일권 판매는 불가**
- 기존에 발급된 PENDING day_pass로 체크인 시 `EXPIRED` 또는 `NO_COUNT` 처리될 수 있음 → 현장 운영 중단 위험

### 코드 롤백 후 복구 전략

1. **신규 일일권 판매 중단**: ERP 상품 마스터에서 일일권 상품 `use_yn = 'N'` 처리
2. **기존 DAILY 데이터 보존**: DB 변경 없이 그대로 유지 (day_passes, payments DAILY 행)
3. **호환 코드 복구**: 최대한 빨리 `da724d5` 이후 커밋으로 재배포

### DB는 롤백하지 않는다

아래 명령은 **실행 금지** — 이미 생성된 일일권·결제·출석 기록이 삭제·손상된다:

```sql
-- ❌ 실행 금지
-- ALTER TABLE payments MODIFY COLUMN pass_type ENUM('COUNT','PERIOD') NULL;
-- DROP TABLE day_passes;
-- UPDATE settings_options SET option_value = NULL WHERE option_id IN (30, 31);
```

---

## 추가 수정 (main 브랜치, 배포 전)

### COUNT 출석 취소 로직 개선 (커밋 `90909da`)
| 파일 | 변경 |
|------|------|
| `app/api/attendance/delete/route.ts` | 시작일 당일 케이스 세분화 |

**기존 문제**: `checkinDate > memberStartDate` 조건이 시작일 당일 정상 출석까지 차단
**개선 로직**:
- `checkin > start_date`: 현재 패스 범위 내 → 허용
- `checkin < start_date`: 명확히 이전 패스 → 409
- `checkin == start_date`: payments WHERE pass_type='COUNT' AND start_date=checkin_date 조회
  - 1건(재등록 없음): 허용
  - 2건 이상(당일 재등록): 소속 패스 불명 → 409

### day-passes API 보안 강화 (커밋 `04177a6`)
| 파일 | 변경 |
|------|------|
| `app/api/day-passes/cancel/route.ts` | `canManageBranch` 추가 — DIRECTOR 타 지점 취소 차단 |
| `app/api/day-passes/route.ts` | `isHq` 기반 필터링 — 비HQ 타 지점 조회 차단 |

---

## 다음 진행 순서

1. **운영 배포**: 최종 커밋 `90909da` 기준 (아래 배포·롤백 절차 참조)
2. **DAILY 체크인 취소 흐름 운영 테스트**: 출석 취소 시 day_pass 복원 확인
3. **일일권 UI 완성**: `/day-passes` API를 활용한 회원 상세 페이지 일일권 현황 표시
4. **나머지 개선 작업 순차 배포**: 비회원 결제 → 직원 권한 → 키오스크 인증 순서 권장
