#!/usr/bin/env bash
# rollback.sh — STRONG ERP 롤백 스크립트
# 사용법: bash rollback.sh
#
# 동작:
#   - Nginx에서 현재 운영 포트를 읽고 반대 포트(3002/3003)로 전환
#   - 대상 포트의 PM2 프로세스 존재·실행·HTTP 응답을 확인
#   - PM2 이름이 아닌 포트·릴리스 경로·빌드 기록으로 대상 확인
#   - 프로세스 없으면 .build-info로 경로·커밋 복원 후 재생성

set -euo pipefail

NGINX_SITE="/etc/nginx/sites-enabled/strong-erp"
PORT_A=3002
PORT_B=3003

echo "================================================"
echo " STRONG ERP 롤백 시작"
echo " $(date '+%Y-%m-%d %H:%M:%S')"
echo "================================================"

# ── [0] 현재 운영 포트 확인 ──────────────────────────────
echo ""
echo "[0] 현재 운영 상태 확인"

NGINX_CONF=$(readlink -f "$NGINX_SITE")
echo "    Nginx 실제 파일: $NGINX_CONF"

PROXY_COUNT=$(grep -c "proxy_pass" "$NGINX_CONF" || true)
if [ "$PROXY_COUNT" -ne 1 ]; then
  echo "[ERROR] proxy_pass가 ${PROXY_COUNT}개 — 수동 확인 필요" >&2
  exit 1
fi
ACTIVE_PORT=$(grep -oP 'proxy_pass http://127\.0\.0\.1:\K[0-9]+' "$NGINX_CONF")
echo "    현재 운영 포트: $ACTIVE_PORT"

if [ "$ACTIVE_PORT" = "$PORT_A" ]; then
  ROLLBACK_PORT=$PORT_B
else
  ROLLBACK_PORT=$PORT_A
fi
echo "    롤백 대상 포트: $ROLLBACK_PORT"

# ── [1] 롤백 대상 프로세스 확인 ─────────────────────────
echo ""
echo "[1] 롤백 대상 프로세스 확인 (포트 $ROLLBACK_PORT)"

# PM2에서 대상 포트를 사용하는 프로세스 찾기
ROLLBACK_PM2=$(pm2 jlist 2>/dev/null \
  | python3 -c "
import sys,json
procs=json.load(sys.stdin)
for p in procs:
    args=' '.join(str(a) for a in (p.get('pm2_env',{}).get('args') or []))
    if ' ${ROLLBACK_PORT}' in args:
        print(p.get('name','?'))
" 2>/dev/null || echo "")

ROLLBACK_CWD=$(pm2 jlist 2>/dev/null \
  | python3 -c "
import sys,json
procs=json.load(sys.stdin)
for p in procs:
    args=' '.join(str(a) for a in (p.get('pm2_env',{}).get('args') or []))
    if ' ${ROLLBACK_PORT}' in args:
        print(p.get('pm2_env',{}).get('pm_cwd','?'))
" 2>/dev/null || echo "")

ROLLBACK_STATUS=$(pm2 jlist 2>/dev/null \
  | python3 -c "
import sys,json
procs=json.load(sys.stdin)
for p in procs:
    args=' '.join(str(a) for a in (p.get('pm2_env',{}).get('args') or []))
    if ' ${ROLLBACK_PORT}' in args:
        print(p.get('pm2_env',{}).get('status','?'))
" 2>/dev/null || echo "")

if [ -z "$ROLLBACK_PM2" ]; then
  echo "    포트 ${ROLLBACK_PORT}에 PM2 프로세스 없음"
  echo ""
  echo "    .build-info 파일로 이전 버전 경로를 탐색합니다..."

  # /home/ubuntu/erp-release-* 폴더에서 .build-info 확인
  FOUND_DIR=""
  for dir in /home/ubuntu/erp-release-*/; do
    if [ -f "${dir}.build-info" ] && [ -f "${dir}.next/BUILD_ID" ]; then
      echo "    후보: $dir"
      cat "${dir}.build-info" | sed 's/^/      /'
      FOUND_DIR="$dir"
    fi
  done

  if [ -z "$FOUND_DIR" ]; then
    echo "[ERROR] 복구 가능한 릴리스 폴더 없음. 수동 복구 필요." >&2
    exit 1
  fi

  echo ""
  echo "    위 목록 중 복구할 경로를 확인하고 아래 명령으로 프로세스를 재생성하세요:"
  echo ""
  echo "      RESTORE_DIR=<복구할_경로>"
  echo "      cd \$RESTORE_DIR"
  echo "      pm2 start npm --name \"erp-${ROLLBACK_PORT}\" -- start -- -H 127.0.0.1 -p ${ROLLBACK_PORT}"
  echo "      bash scripts/rollback.sh   # 재실행"
  exit 0
fi

echo "    PM2 이름: $ROLLBACK_PM2"
echo "    실행 경로: $ROLLBACK_CWD"
echo "    상태: $ROLLBACK_STATUS"

# .build-info 출력 (있으면)
if [ -f "${ROLLBACK_CWD}/.build-info" ]; then
  echo "    빌드 기록:"
  cat "${ROLLBACK_CWD}/.build-info" | sed 's/^/      /'
else
  echo "    .build-info 없음 (클론 경로·커밋 수동 확인 권장)"
fi

# BUILD_ID 확인
ROLLBACK_BUILD_ID=$(cat "${ROLLBACK_CWD}/.next/BUILD_ID" 2>/dev/null || echo "없음")
echo "    BUILD_ID: $ROLLBACK_BUILD_ID"

# ── [2] 프로세스 기동 확인 ───────────────────────────────
echo ""
echo "[2] 롤백 대상 HTTP 응답 확인"

if [ "$ROLLBACK_STATUS" != "online" ]; then
  echo "    프로세스가 online 상태가 아님 ($ROLLBACK_STATUS). 시작..."
  pm2 start "$ROLLBACK_PM2"
  sleep 10
fi

HTTP_ROLLBACK=$(curl -s -o /dev/null -w "%{http_code}" \
  "http://127.0.0.1:${ROLLBACK_PORT}" || true)
echo "    포트 ${ROLLBACK_PORT} HTTP 응답: $HTTP_ROLLBACK"

if [[ "$HTTP_ROLLBACK" != "200" && "$HTTP_ROLLBACK" != "307" && "$HTTP_ROLLBACK" != "302" ]]; then
  echo "[ERROR] 롤백 대상 응답 이상 ($HTTP_ROLLBACK). 중단." >&2
  echo "    로그 확인: pm2 logs $ROLLBACK_PM2 --lines 30 --nostream" >&2
  exit 1
fi
echo "    응답 정상 ✓"

# ── [3] Nginx 설정 백업 ──────────────────────────────────
echo ""
echo "[3] Nginx 설정 백업"
BACKUP="/home/ubuntu/nginx-rollback-$(date +%Y%m%d%H%M).conf"
sudo cp "$NGINX_CONF" "$BACKUP"
echo "    백업: $BACKUP"

# ── [4] proxy_pass 변경 ──────────────────────────────────
echo ""
echo "[4] proxy_pass 변경: ${ACTIVE_PORT} → ${ROLLBACK_PORT}"

sudo cp "$NGINX_CONF" "${NGINX_CONF}.tmp"
sudo sed "s|proxy_pass http://127\.0\.0\.1:${ACTIVE_PORT};|proxy_pass http://127.0.0.1:${ROLLBACK_PORT};|" \
  "${NGINX_CONF}.tmp" | sudo tee "$NGINX_CONF" > /dev/null
sudo rm "${NGINX_CONF}.tmp"

echo "    변경 후:"
grep "proxy_pass" "$NGINX_CONF"

CHANGED_PORT=$(grep -oP 'proxy_pass http://127\.0\.0\.1:\K[0-9]+' "$NGINX_CONF")
if [ "$CHANGED_PORT" != "$ROLLBACK_PORT" ]; then
  echo "[ERROR] proxy_pass 변경 실패. 백업 복원." >&2
  sudo cp "$BACKUP" "$NGINX_CONF"
  exit 1
fi

# ── [5] nginx -t + reload ─────────────────────────────────
echo ""
echo "[5] nginx 검사 및 적용"

if ! sudo nginx -t 2>&1; then
  echo "[ERROR] nginx -t 실패. 백업 복원." >&2
  sudo cp "$BACKUP" "$NGINX_CONF"
  sudo nginx -t && sudo nginx -s reload
  exit 1
fi

sudo nginx -s reload || {
  echo "[ERROR] nginx reload 실패. 백업 복원." >&2
  sudo cp "$BACKUP" "$NGINX_CONF"
  sudo nginx -s reload
  exit 1
}

# ── [6] 외부 응답 확인 ──────────────────────────────────
echo ""
echo "[6] 외부 응답 확인"
sleep 2
HTTP_EXT=$(curl -s -o /dev/null -w "%{http_code}" https://erp.strongboxing.kr || true)
echo "    https://erp.strongboxing.kr → $HTTP_EXT"

if [[ "$HTTP_EXT" != "200" && "$HTTP_EXT" != "307" && "$HTTP_EXT" != "302" ]]; then
  echo "[WARN] 외부 응답 이상 ($HTTP_EXT). 백업 복원." >&2
  sudo cp "$BACKUP" "$NGINX_CONF"
  sudo nginx -s reload
  exit 1
fi

echo ""
pm2 list

echo ""
echo "================================================"
echo " 롤백 완료: 포트 ${ACTIVE_PORT} → ${ROLLBACK_PORT}"
echo " 이전 운영(포트 ${ACTIVE_PORT})은 유지 중"
echo " 안정 확인 후 중지: pm2 stop erp-${ACTIVE_PORT}"
echo "================================================"
