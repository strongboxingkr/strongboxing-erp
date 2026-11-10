# ERP 배포 기록 및 절차

## 2026-11-10 배포 기록

| 항목 | 값 |
|------|-----|
| 운영 경로 | `/home/ubuntu/strongboxing-erp` |
| PM2 프로세스 | `strongboxing-erp` (online 확인) |
| 이전 커밋 | `da724d5` |
| 배포 커밋 | `7a4f74a` (로컬/origin main HEAD) |
| 릴리스 폴더 | `/home/ubuntu/erp-release-7a4f74a` |
| 배포 방식 | 릴리스 폴더 빌드 → rsync 전환 |
| 검증 | 로그인·회원 조회·키오스크 기본 동작 확인 |

### 배포 중 추가 변경 (Git 미반영 → `deploy/post-7a4f74a` 브랜치에 커밋)

| 파일 | 변경 내용 |
|------|-----------|
| `package.json` | `next: "latest"` → `"16.4.6"` 고정 |
| `package-lock.json` | 릴리스 서버에서 npm install 결과 (로컬 미보유) |
| `app/api/check-in/route.ts` | 비회원 pass_code 조회·충돌 검사·비회원 체크인 블록 제거 |

### DB 변경

| 항목 | 내용 |
|------|------|
| 신규 테이블 | `erp_sessions` (DDL: `migrations/001_erp_sessions.sql`) |
| 기존 데이터 | 회원·결제·출석 행 수정/삭제 없음 |
| 백업 위치 | `/home/ubuntu/erp-backups/` (최신: `latest-app-backup.txt`) |

### 운영 환경 확인

| 항목 | 확인 결과 |
|------|-----------|
| `member_files` | 존재, 사용 컬럼 확인 |
| `payments.idempotency_key` | UNIQUE 확인 |
| `payments.pass_type` | DAILY 포함 확인 |
| `attendance.pass_type` | VARCHAR(20) |
| `day_passes` | pass_code/guest_name/guest_phone **없음** (비회원 체크인 경로 제거 근거) |
| `kiosk_devices` | **없음** (REQUIRE_KIOSK_TOKEN=UNSET, 토큰 미전송 시 미조회) |
| `REQUIRE_KIOSK_TOKEN` | 운영 환경파일·PM2 모두 UNSET (활성화 금지) |

### 잔여 문제

| 항목 | 상태 |
|------|------|
| npm audit high 10건 | `npm audit --omit=dev` 확인, critical 0. 후속 작업으로 대응 |
| `package-lock.json` | 릴리스 서버에서 복사 후 `deploy/post-7a4f74a`에 추가 커밋 필요 |
| `next-env.d.ts` | 생성 파일이나 git 추적 중. 별도 정리 가능 (`.gitignore` 추가) |
| 비회원 출석 누락 대응 | 정책·구현 미확정, 후속 작업 |

---

## 다음 배포 절차 (개요)

---

## 배포 원칙

- **운영 폴더를 직접 건드리지 않는다.** 의존성 설치와 빌드는 별도 릴리스 폴더에서 완료한 뒤 전환한다.
- **빌드 실패 시 재시작 금지.** 기존 `.next` 디렉토리로 계속 서비스된다.
- **데이터·스키마 변경 없음.** 코드 롤백만으로 복귀 가능하다.

---

## 사전 필수 확인 (배포 전)

### 1. 운영 서버 환경 확인

```bash
cd /home/ubuntu/strongboxing-erp
git log --oneline -1          # 현재 커밋이 da724d5인지 확인
node --version                # Node.js 버전 기록
npm list next 2>/dev/null | grep next    # Next.js 버전 확인
pm2 describe strongboxing-erp | grep status  # 프로세스 상태 확인
```

> **빌드 호환성**: `package.json` 빌드 스크립트의 `NODE_OPTIONS='...'` 싱글쿼트는 Linux bash에서는 정상 동작한다. Windows에서 CMD/PowerShell로 실행하면 오류가 나지만 운영 서버(Ubuntu)에서는 무관하다.

### 2. DB 컬럼·테이블 확인

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

## 배포 절차 (별도 릴리스 폴더 사용)

### Step 1 — 현재 상태 백업

```bash
# 현재 커밋과 PM2 상태 기록
cd /home/ubuntu/strongboxing-erp
git log --oneline -1
pm2 save
```

### Step 2 — 별도 릴리스 폴더에서 빌드

```bash
# 목표 커밋을 고정한 릴리스 폴더 생성
COMMIT=<배포할 커밋 해시>
RELEASE_DIR=/home/ubuntu/erp-release-${COMMIT:0:7}

# 운영 저장소를 그대로 클론 (로컬 복사)
git clone /home/ubuntu/strongboxing-erp $RELEASE_DIR
cd $RELEASE_DIR
git checkout $COMMIT

# .env.local 복사 (운영 환경 변수)
cp /home/ubuntu/strongboxing-erp/.env.local .env.local

# 의존성 설치
npm ci

# 프로덕션 빌드
npm run build 2>&1 | tee /tmp/erp-build-$(date +%Y%m%d-%H%M).log
echo "빌드 종료 코드: $?"
```

> **빌드 실패 시**: 릴리스 폴더를 삭제하고 종료. 운영 서비스는 그대로 유지된다.
>
> ```bash
> rm -rf $RELEASE_DIR
> ```

### Step 3 — 빌드 성공 확인 후 전환

```bash
# .next 디렉토리가 생성됐는지 확인
ls -la $RELEASE_DIR/.next/BUILD_ID
```

> **rsync는 무중단이 아니다.** 파일 전환 중 요청이 들어오면 일부 파일은 구버전, 일부는 신버전인 혼재 상태가 생긴다. `pm2 restart`로 재시작하면 짧은 중단(수 초)이 발생한다. 트래픽이 적은 시간에 진행할 것.

```bash
# 보존해야 할 경로를 절대 덮어쓰지 않도록 --exclude 명시
rsync -a \
  --exclude='.env.local' \
  --exclude='public/uploads/' \
  --exclude='node_modules/.cache' \
  $RELEASE_DIR/ /home/ubuntu/strongboxing-erp/

# 재시작 (짧은 중단 발생)
pm2 restart strongboxing-erp
pm2 save
```

**rsync --exclude 항목 설명:**

| 경로 | 이유 |
|------|------|
| `.env.local` | DB 접속 정보·API 키 등 운영 환경 변수. 릴리스 폴더에는 존재하지 않으므로 덮어쓰기 위험은 없으나 명시적으로 보호. |
| `public/uploads/` | `/api/member-files/upload`가 운영 중 `public/uploads/member-files/`에 파일을 저장함. 릴리스 폴더에는 이 파일들이 없으므로 rsync 시 삭제·초기화됨. **반드시 제외.** |
| `node_modules/.cache` | 빌드 캐시. 불필요하게 덮어쓰지 않음. |

### Step 4 — 동작 확인

```bash
pm2 logs strongboxing-erp --lines 30   # 시작 직후 오류 없는지 확인
```

브라우저/키오스크에서 체크인 1회 테스트.

---

## 롤백 절차 (데이터 보존)

빌드된 릴리스 폴더가 남아 있다면 이전 버전으로 즉시 복귀:

```bash
# 이전 릴리스 폴더로 복귀
PREV_COMMIT=da724d5
PREV_DIR=/home/ubuntu/erp-release-${PREV_COMMIT:0:7}

# 이전 릴리스 폴더가 없으면 현재 운영 커밋으로 재빌드
if [ ! -d $PREV_DIR ]; then
  git clone /home/ubuntu/strongboxing-erp $PREV_DIR
  cd $PREV_DIR && git checkout $PREV_COMMIT
  cp /home/ubuntu/strongboxing-erp/.env.local .env.local
  npm ci && npm run build
fi

rsync -a \
  --exclude='.env.local' \
  --exclude='public/uploads/' \
  --exclude='node_modules/.cache' \
  $PREV_DIR/ /home/ubuntu/strongboxing-erp/

pm2 restart strongboxing-erp && pm2 save
```

> **데이터베이스 변경 없음** — 코드 롤백만으로 복구 가능.
> 출석번호 8자리를 사용 중인 회원이 있다면 `da724d5`의 4자리 제한 코드로 체크인 불가 (DB 행은 보존됨).

---

## 주요 변경 내용 (da724d5 이후)

| 영역 | 내용 |
|------|------|
| **인증** | x-user-* 헤더 제거 → erp_session 쿠키 기반, 50개 API 경로 미인증 보호 |
| **체크인** | 횟수 차감 원자성, KST 날짜 수정, 출석번호 최대 8자리 지원, 지점별 중복 차단 |
| **결제** | 취소 GENERAL/PASS 구분, renew 트랜잭션화 |
| **일일권** | 등록·체크인·취소 로직, 비회원 결제 간소화 |
| **라커** | 중복 배정 방지, 트랜잭션, 재등록 원자화 |
| **환불** | LIKE 버그 수정, 중복 초과 방지, pre-flight, terminate_pass 항상 거부, 출처불명 환불 감지 |
| **키오스크** | 기기 토큰 검증 강화, rate limiting |
| **DB** | charset utf8mb4 명시 (한글 깨짐 수정) |
| **가져오기** | 출석번호 형식 검증 강화 (문자 포함 시 변환 없이 행 오류, 행 번호 표시) |

## 남은 배포 차단 사유

### 1. 빌드

`package.json scripts.build`에 `--webpack` 고정 완료.  
로컬(Windows) webpack 빌드 **성공 확인**. 운영 서버에서도 `npm run build`가 성공하는지 확인:

```bash
ssh ubuntu@<서버>
cd /home/ubuntu
git clone strongboxing-erp erp-release-test && cd erp-release-test
npm ci && npm run build
# 성공하면 삭제
cd .. && rm -rf erp-release-test
```

### 2. DB 컬럼·테이블 확인 (직접 실행)

```bash
mysql -u root -p strongboxing -e "
  SHOW COLUMNS FROM members LIKE 'checkin_code';
  SHOW COLUMNS FROM members LIKE 'pass_type';
  SHOW COLUMNS FROM payments LIKE 'pass_type';
  SHOW COLUMNS FROM payments LIKE 'history_type';
  SHOW TABLES LIKE 'day_passes';
  SHOW TABLES LIKE 'kiosk_devices';
  SHOW TABLES LIKE 'member_holds';
  SHOW TABLES LIKE 'member_histories';
  SHOW TABLES LIKE 'member_files';
"
```

모든 항목이 행을 반환해야 한다. 비어 있는 항목이 있으면 해당 기능이 오류를 낸다.

### 3. PM2 프로세스명 확인

```bash
pm2 describe strongboxing-erp
```
