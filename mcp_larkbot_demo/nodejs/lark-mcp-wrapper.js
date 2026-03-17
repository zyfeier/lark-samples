#!/usr/bin/env node
/**
 * Lark MCP Wrapper - 自动刷新 user_access_token 并启动 MCP Server
 * 
 * 工作原理：
 * 1. 从 token 文件读取 refresh_token
 * 2. 自动刷新获取新的 access_token
 * 3. 用新 token 启动 lark-mcp 进程
 * 4. 透传 stdin/stdout 实现 MCP stdio 协议
 * 
 * 首次使用需要先运行 get-token.ts 获取初始 token
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// 配置
const CONFIG = {
  appId: process.env.LARK_APP_ID || process.env.APP_ID || '',
  appSecret: process.env.LARK_APP_SECRET || process.env.APP_SECRET || '',
  domain: process.env.LARK_DOMAIN || 'https://open.feishu.cn',
  tools: process.env.LARK_TOOLS || 'preset.base.default',
  lang: process.env.LARK_LANG || 'zh',
  tokenFile: path.join(__dirname, '.user-token.json'),
};

/**
 * 从文件加载 token
 */
function loadToken() {
  try {
    if (fs.existsSync(CONFIG.tokenFile)) {
      return JSON.parse(fs.readFileSync(CONFIG.tokenFile, 'utf-8'));
    }
  } catch (e) {
    process.stderr.write(`[wrapper] 读取 token 文件失败: ${e.message}\n`);
  }
  return null;
}

/**
 * 保存 token 到文件
 */
function saveToken(tokenData) {
  fs.writeFileSync(CONFIG.tokenFile, JSON.stringify(tokenData, null, 2), 'utf-8');
}

/**
 * 用 refresh_token 刷新 access_token
 */
async function refreshAccessToken(refreshToken) {
  const res = await fetch(`${CONFIG.domain}/open-apis/authen/v2/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      client_id: CONFIG.appId,
      client_secret: CONFIG.appSecret,
      refresh_token: refreshToken,
    }),
  });
  return await res.json();
}

/**
 * 获取有效的 access_token（自动刷新）
 */
async function getValidAccessToken() {
  const saved = loadToken();

  if (!saved || !saved.refreshToken) {
    process.stderr.write('[wrapper] 没有找到 token，请先运行 get-token.ts 完成首次授权\n');
    process.stderr.write(`[wrapper] 命令: cd ${__dirname} && npx ts-node get-token.ts\n`);
    process.exit(1);
  }

  // 检查 access_token 是否还有效（预留 5 分钟缓冲）
  if (saved.accessToken && saved.expiresAt && saved.expiresAt > Date.now() + 5 * 60 * 1000) {
    process.stderr.write('[wrapper] access_token 仍然有效，直接使用\n');
    return saved.accessToken;
  }

  // 需要刷新
  process.stderr.write('[wrapper] access_token 已过期，正在刷新...\n');
  const data = await refreshAccessToken(saved.refreshToken);

  if (data.access_token) {
    const newToken = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };
    saveToken(newToken);
    process.stderr.write('[wrapper] token 刷新成功\n');
    return data.access_token;
  } else {
    process.stderr.write(`[wrapper] token 刷新失败: ${JSON.stringify(data)}\n`);
    process.stderr.write('[wrapper] 请重新运行 get-token.ts 完成授权\n');
    process.exit(1);
  }
}

/**
 * 启动 lark-mcp 进程并透传 stdio
 */
function startMCPServer(accessToken) {
  const args = [
    '-y',
    '@larksuiteoapi/lark-mcp',
    'mcp',
    '-a', CONFIG.appId,
    '-s', CONFIG.appSecret,
    '-d', CONFIG.domain,
    '-t', CONFIG.tools,
    '-l', CONFIG.lang,
    '--token-mode', 'user_access_token',
    '-u', accessToken,
  ];

  const child = spawn('npx', args, {
    stdio: ['pipe', 'pipe', 'inherit'], // stdin/stdout pipe, stderr inherit
  });

  // 透传 stdin -> child
  process.stdin.pipe(child.stdin);
  // 透传 child stdout -> stdout
  child.stdout.pipe(process.stdout);

  child.on('exit', (code) => {
    process.exit(code || 0);
  });

  process.on('SIGTERM', () => child.kill('SIGTERM'));
  process.on('SIGINT', () => child.kill('SIGINT'));
}

// 主流程
(async () => {
  try {
    const accessToken = await getValidAccessToken();
    startMCPServer(accessToken);
  } catch (e) {
    process.stderr.write(`[wrapper] 启动失败: ${e.message}\n`);
    process.exit(1);
  }
})();
