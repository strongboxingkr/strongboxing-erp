#!/usr/bin/env bash
# deploy.sh — STRONG ERP 배포 스크립트
# 사용법: bash deploy.sh <배포할_전체_커밋_해시>
#
# 전제:
#   - 홈페이지(strongboxing → 3000), DB, 업로드 원본은 변경하지 않음
#   - ERP Nginx 설정 파일: /etc/nginx/sites-enabled/strong-erp
#   - 운영 포트는 3002/3003 교대. PM2 이름은 포트 고정: erp-3002, erp-3003
#   - 업로드 원본: /home/ubuntu/strongboxing-erp/public/uploads
#   - 환경 파일 원본: /home/ubuntu/strongboxing-erp-current/.env.production 등

set -euo pipefail

# ── 인수 확인 ────────────────────────────────────────────
DEPLOY_COMMIT="${1:-}"
if [ -z "$DEPLOY_COMMIT" ]; then
  echo "[ERROR] 사용법: bash deploy.sh <전체_커밋_해시>" >&2
  exit 1
fi
SHORT="${DEPLOY_COMMIT:0:7}"
RELEASE_DIR="/home/ubuntu/erp-release-${SHORT}"
UPLOAD_ORIGIN="/home/ubuntu/strongboxing-erp/public/uploads"
CURRENT_LINK="/home/ubuntu/strongboxing-erp-current"
NGINX_SITE="/etc/nginx/sites-enabled/strong-erp"
REPO_URL="https://github.com/strongboxingkr/strongboxing-erp.git"
PORT_A=3002
PORT_B=3003

echo "================================================"
echo " STRONG ERP 배포 시작: ${SHORT}"
echo " $(date '+%Y-%m-%d %H:%M:%S')"
echo "================================================"

# ── [0] 현재 운영 상태 기록 ──────────────────────────────
echo ""
echo "[0] 배포 전 운영 상태 확인"

# Nginx 실제 파일 경로 확인
NGINX_CONF=$(readlink -f "$NGINX_SITE")
echo "    Nginx 실제 파일: $NGINX_CONF"

# 현재 운영 포트 (proxy_pass에서 추출)
PROXY_COUNT=$(grep -c "proxy_pass" "$NGINX_CONF" || true)
if [ "$PROXY_COUNT" -ne 1 ]; then
  echo "[ERROR] proxy_pass가 ${PROXY_COUNT}개 — 수동 확인 필요" >&2
  exit 1
fi
ACTIVE_PORT=$(grep -oP 'proxy_pass http://127\.0\.0\.1:\K[0-9]+' "$NGINX_CONF")
echo "    현재 운영 포트: $ACTIVE_PORT"

# 운영 포트에 실제로 응답하는지 확인
HTTP_ACTIVE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${ACTIVE_PORT}" || true)
echo "    운영 포트 HTTP 응답: $HTTP_ACTIVE"
if [[ "$HTTP_ACTIVE" != "200" && "$HTTP_ACTIVE" != "307" && "$HTTP_ACTIVE" != "302" ]]; then
  echo "[ERROR] 운영 포트 ${ACTIVE_PORT} 응답 이상 (${HTTP_ACTIVE}). 중단." >&2
  exit 1
fi

# 대기 포트 결정
if [ "$ACTIVE_PORT" = "$PORT_A" ]; then
  STANDBY_PORT=$PORT_B
else
  STANDBY_PORT=$PORT_A
fi
STANDBY_PM2="erp-${STANDBY_PORT}"
echo "    신규 배포 포트: $STANDBY_PORT (PM2: $STANDBY_PM2)"

# PM2에서 운영 포트를 쓰는 프로세스 cwd 확인
ACTIVE_PM2_CWD=$(pm2 jlist 2>/dev/null \
  | python3 -c "
import sys,json
procs=json.load(sys.stdin)
for p in procs:
    args=' '.join(str(a) for a in (p.get('pm2_env',{}).get('args') or []))
    if '-p ${ACTIVE_PORT}' in args or ' ${ACTIVE_PORT}' in args:
        print(p.get('pm2_env',{}).get('pm_cwd','?'))
" 2>/dev/null || echo "확인불가")
echo "    운영 프로세스 cwd: $ACTIVE_PM2_CWD"

# 대기 포트 기존 프로세스 확인
STANDBY_RUNNING=$(pm2 jlist 2>/dev/null \
  | python3 -c "
import sys,json
procs=json.load(sys.stdin)
for p in procs:
    args=' '.join(str(a) for a in (p.get('pm2_env',{}).get('args') or []))
    if '-p ${STANDBY_PORT}' in args or ' ${STANDBY_PORT}' in args:
        print(p.get('name','?'))
" 2>/dev/null || echo "")
if [ -n "$STANDBY_RUNNING" ]; then
  echo "    대기 포트 ${STANDBY_PORT}에 프로세스 존재: $STANDBY_RUNNING"
  echo "    → 중지·삭제 후 진행"
  pm2 stop "$STANDBY_RUNNING" 2>/dev/null || true
  pm2 delete "$STANDBY_RUNNING" 2>/dev/null || true
fi

# ── [1] 클론 ────────────────────────────────────────────
echo ""
echo "[1] 클론: $RELEASE_DIR"
if [ -d "$RELEASE_DIR" ]; then
  echo "    폴더 이미 존재. 커밋 확인..."
  EXISTING=$(git -C "$RELEASE_DIR" rev-parse HEAD 2>/dev/null || echo "unknown")
  if [ "$EXISTING" != "$DEPLOY_COMMIT" ]; then
    echo "[ERROR] 폴더가 존재하나 커밋 불일치: $EXISTING vs $DEPLOY_COMMIT" >&2
    exit 1
  fi
  echo "    커밋 일치. 클론 생략."
else
  git clone "$REPO_URL" "$RELEASE_DIR"
  git -C "$RELEASE_DIR" checkout "$DEPLOY_COMMIT"
fi

ACTUAL=$(git -C "$RELEASE_DIR" rev-parse HEAD)
if [ "$ACTUAL" != "$DEPLOY_COMMIT" ]; then
  echo "[ERROR] 커밋 불일치: $ACTUAL vs $DEPLOY_COMMIT" >&2
  exit 1
fi
echo "    커밋 확인: $ACTUAL ✓"

# ── [2] 의존성 설치 ──────────────────────────────────────
echo ""
echo "[2] npm ci"
cd "$RELEASE_DIR"
npm ci

# ── [3] 환경 파일 복사 ───────────────────────────────────
echo ""
echo "[3] 환경 파일 복사 (존재하는 파일만)"
ENV_SRC="${CURRENT_LINK}"
for f in .env .env.production .env.local; do
  if [ -f "${ENV_SRC}/${f}" ]; then
    cp "${ENV_SRC}/${f}" "${RELEASE_DIR}/${f}"
    chmod 600 "${RELEASE_DIR}/${f}"
    echo "    복사: ${f} ✓"
  else
    echo "    없음: ${f} (건너뜀)"
  fi
done
ls -la "${RELEASE_DIR}"/.env* 2>/dev/null || echo "    환경 파일 없음"

# ── [4] uploads 심볼릭 링크 ─────────────────────────────
echo ""
echo "[4] uploads 심볼릭 링크"
UPLOADS_DST="${RELEASE_DIR}/public/uploads"
if [ -L "$UPLOADS_DST" ]; then
  echo "    이미 링크 존재: $(readlink "$UPLOADS_DST")"
elif [ -d "$UPLOADS_DST" ]; then
  echo "[WARN] uploads가 실제 디렉토리로 존재. 내용 확인 후 수동 처리 필요." >&2
  exit 1
else
  ln -s "$UPLOAD_ORIGIN" "$UPLOADS_DST"
  echo "    생성: $UPLOADS_DST → $UPLOAD_ORIGIN ✓"
fi

# ── [5] 빌드 ────────────────────────────────────────────
echo ""
echo "[5] 빌드"
cd "$RELEASE_DIR"

# 빌드 전 커밋 기록
cat > .build-info <<EOF
deploy_commit: ${DEPLOY_COMMIT}
short: ${SHORT}
build_time: $(date '+%Y-%m-%d %H:%M:%S')
builder: $(whoami)
EOF

BUILD_EXIT=0
node --max-old-space-size=1536 \
  node_modules/next/dist/bin/next build --webpack || BUILD_EXIT=$?
echo "BUILD_EXIT:$BUILD_EXIT"

if [ $BUILD_EXIT -ne 0 ]; then
  echo "[ERROR] 빌드 실패 (exit $BUILD_EXIT). 중단." >&2
  exit 1
fi

BUILD_ID=$(cat .next/BUILD_ID 2>/dev/null || echo "")
if [ -z "$BUILD_ID" ]; then
  echo "[ERROR] BUILD_ID 없음. 중단." >&2
  exit 1
fi
echo "BUILD_ID: $BUILD_ID ✓"
echo "build_id: ${BUILD_ID}" >> .build-info
cat .build-info

# ── [6] 후보 프로세스 시작 ──────────────────────────────
echo ""
echo "[6] 프로세스 시작: $STANDBY_PM2 (포트 $STANDBY_PORT)"
cd "$RELEASE_DIR"
pm2 start npm --name "$STANDBY_PM2" -- start -- -H 127.0.0.1 -p "$STANDBY_PORT"

echo "    기동 대기 (10초)..."
sleep 10
pm2 logs "$STANDBY_PM2" --lines 20 --nostream

# HTTP 검증
HTTP_STANDBY=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${STANDBY_PORT}" || true)
HTTP_API=$(curl -s -o /dev/null -w "%{http_code}" \
  "http://127.0.0.1:${STANDBY_PORT}/api/settings?option_type=BRANCH" || true)
echo "    / 응답: $HTTP_STANDBY (기대: 200 또는 307)"
echo "    /api 응답: $HTTP_API (기대: 401)"

if [[ "$HTTP_STANDBY" != "200" && "$HTTP_STANDBY" != "307" && "$HTTP_STANDBY" != "302" ]]; then
  echo "[ERROR] 후보 포트 응답 이상 ($HTTP_STANDBY). Nginx 전환 중단." >&2
  pm2 stop "$STANDBY_PM2" 2>/dev/null || true
  exit 1
fi

# ── [7] Nginx 전환 ───────────────────────────────────────
echo ""
echo "[7] Nginx 전환: ${ACTIVE_PORT} → ${STANDBY_PORT}"

NGINX_CONF=$(readlink -f "$NGINX_SITE")
BACKUP="/home/ubuntu/nginx-backup-$(date +%Y%m%d%H%M).conf"
sudo cp "$NGINX_CONF" "$BACKUP"
echo "    백업: $BACKUP"

# 임시 파일로 치환 후 교체 (심볼릭 링크 대상 파일 직접 수정)
sudo cp "$NGINX_CONF" "${NGINX_CONF}.tmp"
sudo sed "s|proxy_pass http://127\.0\.0\.1:${ACTIVE_PORT};|proxy_pass http://127.0.0.1:${STANDBY_PORT};|" \
  "${NGINX_CONF}.tmp" | sudo tee "$NGINX_CONF" > /dev/null
sudo rm "${NGINX_CONF}.tmp"

echo "    변경 후 proxy_pass:"
grep "proxy_pass" "$NGINX_CONF"

# 문법 검사
if ! sudo nginx -t 2>&1; then
  echo "[ERROR] nginx -t 실패. 백업 복원." >&2
  sudo cp "$BACKUP" "$NGINX_CONF"
  sudo nginx -t && sudo nginx -s reload
  pm2 stop "$STANDBY_PM2" 2>/dev/null || true
  exit 1
fi

sudo nginx -s reload || {
  echo "[ERROR] nginx reload 실패. 백업 복원." >&2
  sudo cp "$BACKUP" "$NGINX_CONF"
  sudo nginx -s reload
  pm2 stop "$STANDBY_PM2" 2>/dev/null || true
  exit 1
}

# 외부 응답 확인
sleep 2
HTTP_EXT=$(curl -s -o /dev/null -w "%{http_code}" https://erp.strongboxing.kr || true)
echo "    외부 응답: $HTTP_EXT"
if [[ "$HTTP_EXT" != "200" && "$HTTP_EXT" != "307" && "$HTTP_EXT" != "302" ]]; then
  echo "[WARN] 외부 응답 이상 ($HTTP_EXT). Nginx 백업 복원 후 확인 필요." >&2
  sudo cp "$BACKUP" "$NGINX_CONF"
  sudo nginx -s reload
  pm2 stop "$STANDBY_PM2" 2>/dev/null || true
  exit 1
fi

# ── [8] 고정 링크·저장 ───────────────────────────────────
echo ""
echo "[8] 고정 링크 갱신 + PM2 저장"
ln -sfn "$RELEASE_DIR" "$CURRENT_LINK"
ls -la "$CURRENT_LINK"
pm2 save
echo "    PM2 저장 완료"

# ── [9] 배포 후 상태 기록 ────────────────────────────────
echo ""
echo "[9] 배포 후 상태"
echo "    운영 포트: $STANDBY_PORT"
echo "    운영 경로: $RELEASE_DIR"
echo "    운영 커밋: $DEPLOY_COMMIT"
echo "    BUILD_ID : $BUILD_ID"
echo "    고정 링크: $CURRENT_LINK → $(readlink $CURRENT_LINK)"
echo ""
pm2 list

echo ""
echo "================================================"
echo " 배포 완료: ${SHORT} → 포트 ${STANDBY_PORT}"
echo " 이전 버전(포트 ${ACTIVE_PORT})은 운영 안정 확인 후 수동 중지"
echo " 중지 명령: pm2 stop erp-${ACTIVE_PORT} && pm2 delete erp-${ACTIVE_PORT} && pm2 save"
echo "================================================"
