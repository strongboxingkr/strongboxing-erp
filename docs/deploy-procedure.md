# ERP 배포 절차 (da724d5 → 5c7a897)

## 개요

| 항목 | 값 |
|------|-----|
| 운영 경로 | `/home/ubuntu/strongboxing-erp` |
| PM2 프로세스 | `strongboxing-erp` |
| 이전 운영 커밋 | `da724d5` |
| 배포 목표 커밋 | `5c7a897` |
| 커밋 수 | 44개 |

---

## 사전 필수 확인 (배포 전)

### 1. 운영 서버 환경 확인

```bash
cd /home/ubuntu/strongboxing-erp
git log --oneline -1          # 현재 커밋이 da724d5인지 확인
node --version                # Node.js 버전 확인 (로컬: v24.15.0)
npm list next 2>/dev/null | grep next    # Next.js 버전 확인 (로컬: 16.2.6)
pm2 describe strongboxing-erp | grep status  # 프로세스 상태 확인
```

**중요**: 로컬(Node 24 + Next.js 16.2.6)에서 `next build`가 `InvariantError: workStore` 오류로 실패.  
이것은 Next.js 16 Turbopack 버그("This is a bug in Next.js"로 명시)이며 운영 서버 환경과 다를 수 있음.  
운영 서버에서 먼저 테스트 빌드를 실행하여 성공 여부를 확인해야 한다.

### 2. 주요 변경 내용 (da724d5 이후 44개 커밋)

| 영역 | 내용 | 커밋 |
|------|------|------|
| **인증** | x-user-* 헤더 제거 → erp_session 쿠키 기반 | c8a7d03 |
| **인증** | 50개 API 경로 미인증 보호 | 6b2e419, 47807e9 |
| **체크인** | 횟수 차감 원자성, KST 날짜 수정 | 3f7f065, 13071c6 |
| **체크인** | 출석번호 최대 8자리 지원, 지점별 중복 차단 | e3abfc8 |
| **결제** | 취소 GENERAL/PASS 구분, renew 트랜잭션화 | 376cde7 |
| **일일권** | 등록·체크인·취소 로직, 비회원 결제 간소화 | 12e2596, 74d9a2f |
| **라커** | 중복 배정 방지, 트랜잭션, 재등록 원자화 | 038792b, b8d37ea |
| **환불** | LIKE 버그 수정, 중복 초과 방지, pre-flight | f793e1c |
| **환불** | terminate_pass 항상 거부, 출처불명 환불 감지, 이중 경로 누계 | 68b14fc |
| **키오스크** | 기기 토큰 검증 강화, rate limiting | e16e38d, b74fee4 |
| **DB** | charset utf8mb4 명시 (한글 깨짐 수정) | 52c2d56 |
| **빌드** | /hq/ai-content 경로 등록, import 오류 안내 | 5c7a897 |

### 3. 스키마 변경 없음

이 배포에 포함된 커밋은 **스키마(DDL) 변경 없음**.  
단, 다음 컬럼이 없으면 체크인·일일권 기능이 오류를 낼 수 있으므로 확인:

```bash
mysql -u root -p strongboxing -e "
  SHOW COLUMNS FROM members LIKE 'checkin_code';
  SHOW COLUMNS FROM payments LIKE 'pass_type';
  SHOW TABLES LIKE 'day_passes';
  SHOW TABLES LIKE 'kiosk_devices';
  SHOW TABLES LIKE 'member_holds';
  SHOW TABLES LIKE 'member_histories';
"
```

기존 운영 DB에서 모두 존재해야 정상. 없으면 담당자에게 먼저 마이그레이션 SQL을 확인해야 한다.

---

## 배포 절차

### Step 1 — 현재 상태 백업

```bash
cd /home/ubuntu/strongboxing-erp
git log --oneline -1          # 현재 커밋 메모
pm2 save                      # 현재 프로세스 목록 저장
```

### Step 2 — 코드 업데이트

```bash
git pull origin main
git log --oneline -5          # 5c7a897이 HEAD인지 확인
```

### Step 3 — 의존성 설치

```bash
npm ci --legacy-peer-deps
```

> `npm install`이 아닌 `npm ci`를 사용 — `package-lock.json` 기준으로 재현 가능하게 설치.  
> 실패 시: `npm ci` 출력 확인 후 의존성 충돌 해결. **재시작 하지 말 것.**

### Step 4 — 프로덕션 빌드

```bash
npm run build 2>&1 | tee /tmp/erp-build-$(date +%Y%m%d-%H%M).log
echo "빌드 종료 코드: $?"
```

> **빌드 성공 확인 필수** — 실패하면 재시작 하지 말 것.  
> 로컬에서 `InvariantError: workStore` 오류가 발생한 경로가 있음:
> - `/hq/ai-content` (5c7a897에서 페이지 파일 추가, force-dynamic 설정)
> - `/_not-found`
>
> 운영 서버에서도 같은 오류가 나오면 아래 "빌드 실패 대응" 절차를 따른다.

#### 빌드 실패 대응

빌드 로그에서 오류 경로 확인:

```bash
grep -E "Error occurred|InvariantError|Export encountered" /tmp/erp-build-*.log
```

`InvariantError: workStore` 오류가 `/hq/*` 경로에서 반복된다면:
1. 로컬에 보고한 뒤 `hq/layout.tsx` 또는 개별 경로에 `export const dynamic = "force-dynamic"` 추가 후 커밋
2. 재빌드

다른 오류라면: 오류 내용과 로그 파일을 공유하여 진단.

**빌드가 실패한 상태에서 `pm2 restart`를 실행하면 이전 `.next` 디렉토리로 계속 서비스됨.**  
의도적인 경우에만 허용. 그렇지 않으면 Step 5로 가지 말 것.

### Step 5 — 재시작

```bash
pm2 restart strongboxing-erp
pm2 save
```

### Step 6 — 동작 확인

```bash
pm2 logs strongboxing-erp --lines 30   # 시작 직후 오류 없는지 확인
```

브라우저/키오스크에서 체크인 1회 테스트.

---

## 롤백 절차

### 코드 롤백 (데이터 보존)

```bash
cd /home/ubuntu/strongboxing-erp

# 현재 커밋 메모
git log --oneline -1

# 이전 커밋으로 복구
git reset --hard da724d5

# 의존성 재설치
npm ci --legacy-peer-deps

# 빌드
npm run build 2>&1 | tee /tmp/erp-rollback-$(date +%Y%m%d-%H%M).log
echo "빌드 종료 코드: $?"

# 빌드 성공 시 재시작
pm2 restart strongboxing-erp && pm2 save
```

> **데이터베이스 변경 없음** — 코드 롤백만으로 복구 가능.  
> 출석번호 8자리 사용 중인 회원이 있다면 `da724d5`의 4자리 제한 코드로 체크인 불가 (DB 행은 보존됨).

---

## 환경별 빌드 오류 비교

| 환경 | Node.js | Next.js | next build |
|------|---------|---------|------------|
| 로컬(Windows) | v24.15.0 | 16.2.6 (latest) | ❌ InvariantError workStore |
| 운영(Ubuntu) | 미확인 | 미확인 | 확인 필요 |

`package.json`에 `"next": "latest"`가 고정되어 있어 `npm install` 시점에 따라 버전이 달라질 수 있음.  
배포 후 버전을 고정하는 것을 권장:

```bash
# 운영 서버에서 현재 설치된 버전 고정
npm pkg set dependencies.next="$(npm list next --depth=0 2>/dev/null | grep next@ | sed 's/.*next@//')"
git add package.json && git commit -m "chore: next 버전 고정"
```

---

## 남은 필수 조건

배포 전 확인해야 하는 항목:

1. **운영 서버 `next build` 성공 여부 확인**  
   로컬에서 빌드 실패(workStore 오류). 운영 서버 Node.js 버전이 다르면 성공할 수 있음.  
   `ssh ubuntu@<서버> "cd /home/ubuntu/strongboxing-erp && node --version && npm list next"`

2. **DB 컬럼·테이블 확인** (위 Step 3에 명시한 `SHOW COLUMNS/TABLES` 실행)

3. **PM2 프로세스명 확인**  
   `pm2 describe strongboxing-erp`가 현재도 정상 응답하는지 확인.

4. **환경 변수(.env)** 변경 없음 — 기존 `.env.local` 그대로 사용.
