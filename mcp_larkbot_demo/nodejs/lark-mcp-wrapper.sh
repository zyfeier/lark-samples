#!/bin/bash
# 从 .env 加载环境变量（如果存在）
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -f "$SCRIPT_DIR/.env" ]; then
  set -a; source "$SCRIPT_DIR/.env"; set +a
fi

TOKENS_FILE="${TOKENS_FILE:-$SCRIPT_DIR/.tokens.json}"
TOKEN=$(python3 -c "import json; print(list(json.load(open('${TOKENS_FILE}')).values())[0]['accessToken'])" 2>/dev/null)

if [ -z "$TOKEN" ]; then
  echo '{"error":"No token found"}' >&2
  exit 1
fi

exec npx -y @larksuiteoapi/lark-mcp mcp \
  -a "${APP_ID:?请设置 APP_ID 环境变量}" \
  -s "${APP_SECRET:?请设置 APP_SECRET 环境变量}" \
  -d "${LARK_DOMAIN:-https://open.feishu.cn}" \
  -t preset.base.default \
  -l zh \
  -u "$TOKEN" \
  --token-mode user_access_token
