# ERP 배포 절차

## 개요

| 항목 | 값 |
|------|-----|
| 운영 경로 | `/home/ubuntu/strongboxing-erp` |
| PM2 프로세스 | `strongboxing-erp` |
| 이전 운영 커밋 | `da724d5` |
| 배포 목표 커밋 | (최종 커밋 확정 후 기재) |

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

# 운영 폴더에 새 코드 적용 (서비스 중단 없이 파일 덮어쓰기)
rsync -a --exclude='.env.local' --exclude='node_modules/.cache' \
  $RELEASE_DIR/ /home/ubuntu/strongboxing-erp/

# 재시작
pm2 restart strongboxing-erp
pm2 save
```

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

rsync -a --exclude='.env.local' --exclude='node_modules/.cache' \
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

1. **빌드 성공 여부 미확인** — 로컬(Node 24, Windows)에서 `NODE_OPTIONS` 싱글쿼트 문제로 빌드 불가. 운영 서버(Ubuntu bash)에서는 정상 동작 예상이나 실제 빌드 실행으로 확인 필요.
2. **DB 컬럼·테이블 확인** — 위 사전 확인 절차의 `SHOW COLUMNS/TABLES` 실행 결과 확인.
