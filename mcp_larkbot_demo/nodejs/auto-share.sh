#!/bin/bash
# 自动分享多维表格权限
# 用法: ./auto-share.sh <app_token>
# 需要设置环境变量: APP_ID, APP_SECRET, TARGET_OPEN_ID

# 从 .env 加载环境变量（如果存在）
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -f "$SCRIPT_DIR/.env" ]; then
  set -a; source "$SCRIPT_DIR/.env"; set +a
fi

APP_TOKEN="$1"

if [ -z "$APP_TOKEN" ]; then
  echo "错误: 请提供 app_token 参数"
  exit 1
fi

: "${APP_ID:?请设置 APP_ID 环境变量}"
: "${APP_SECRET:?请设置 APP_SECRET 环境变量}"
: "${TARGET_OPEN_ID:?请设置 TARGET_OPEN_ID 环境变量}"

# 获取 tenant_access_token
TOKEN=$(curl -s -X POST 'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal' \
  -H 'Content-Type: application/json' \
  -d "{\"app_id\":\"$APP_ID\",\"app_secret\":\"$APP_SECRET\"}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['tenant_access_token'])")

# 分享权限
RESULT=$(curl -s -X POST "https://open.feishu.cn/open-apis/drive/v1/permissions/${APP_TOKEN}/members?type=bitable" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"member_type\":\"openid\",\"member_id\":\"$TARGET_OPEN_ID\",\"perm\":\"full_access\"}")

echo "权限分享结果: $RESULT"
