/**
 * 快速获取 user_access_token 的工具
 * 启动后访问 http://localhost:3000 完成 OAuth 授权
 * 授权成功后会打印 access_token 并自动写入 MCP 配置
 */
import express from 'express';
import { config } from './src/config';
import fs from 'fs';
import path from 'path';

const app = express();
const PORT = config.port;

const callbackPath = '/callback';
const host = process.env.CALLBACK_HOST || `http://localhost:${PORT}`;
const callbackUrl = `${host}${callbackPath}`;

// 构建授权 URL
const authorizeUrl = new URL(`${config.lark.domain}/open-apis/authen/v1/authorize`);
authorizeUrl.searchParams.append('client_id', config.lark.appId);
authorizeUrl.searchParams.append('redirect_uri', callbackUrl);
if (config.lark.scope.length > 0) {
  authorizeUrl.searchParams.append('scope', config.lark.scope.join(' '));
}

// 首页 - 引导用户授权
app.get('/', (_req, res) => {
  res.send(`
    <h2>飞书 OAuth 授权</h2>
    <p>点击下方链接完成授权，获取 user_access_token：</p>
    <a href="${authorizeUrl.toString()}" style="font-size:18px;">👉 点击授权登录</a>
  `);
});

// OAuth 回调
app.get(callbackPath, async (req, res) => {
  const code = req.query.code as string;
  if (!code) {
    res.status(400).send('缺少授权码');
    return;
  }

  try {
    const tokenRes = await fetch(`${config.lark.domain}/open-apis/authen/v2/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: config.lark.appId,
        client_secret: config.lark.appSecret,
        code,
        redirect_uri: callbackUrl,
      }),
    });
    const data = await tokenRes.json() as any;

    if (!data.access_token) {
      console.error('获取 token 失败:', data);
      res.status(500).send(`获取 token 失败: ${JSON.stringify(data)}`);
      return;
    }

    const accessToken = data.access_token;
    const refreshToken = data.refresh_token;
    const expiresIn = data.expires_in;

    console.log('\n========================================');
    console.log('✅ 获取 user_access_token 成功！');
    console.log('========================================');
    console.log(`access_token: ${accessToken}`);
    console.log(`refresh_token: ${refreshToken}`);
    console.log(`expires_in: ${expiresIn}s`);
    console.log('========================================\n');

    // 自动更新 lark-mcp-config.json
    const configPath = path.join(__dirname, 'lark-mcp-config.json');
    const mcpConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    mcpConfig.userAccessToken = accessToken;
    mcpConfig.tokenMode = 'user_access_token';
    fs.writeFileSync(configPath, JSON.stringify(mcpConfig, null, 2), 'utf-8');
    console.log('✅ 已更新 lark-mcp-config.json');

    // 保存 tokens（两个文件都写）
    const tokenData = {
      accessToken,
      refreshToken,
      expiresAt: Date.now() + expiresIn * 1000,
    };

    // 写入 .user-token.json（wrapper 脚本使用）
    const userTokenPath = path.join(__dirname, '.user-token.json');
    fs.writeFileSync(userTokenPath, JSON.stringify(tokenData, null, 2), 'utf-8');
    console.log('✅ 已更新 .user-token.json');

    // 写入 .tokens.json（兼容 mcp_larkbot_demo）
    const tokensPath = path.join(__dirname, '.tokens.json');
    const tokens: any = {};
    tokens['current'] = tokenData;
    fs.writeFileSync(tokensPath, JSON.stringify(tokens, null, 2), 'utf-8');
    console.log('✅ 已更新 .tokens.json');

    res.send(`
      <h2>✅ 授权成功！</h2>
      <p>access_token 已获取并保存。</p>
      <p>你可以关闭此页面，回到终端查看 token。</p>
      <p>然后按 Ctrl+C 停止此服务。</p>
      <hr>
      <p><small>token 有效期: ${expiresIn}s (约 ${Math.round(expiresIn / 3600)} 小时)</small></p>
    `);
  } catch (error) {
    console.error('OAuth 回调处理失败:', error);
    res.status(500).send('处理失败');
  }
});

app.listen(PORT, () => {
  console.log(`\n🚀 OAuth 授权服务已启动: http://localhost:${PORT}`);
  console.log(`📋 回调地址: ${callbackUrl}`);
  console.log(`\n请在浏览器中打开: http://localhost:${PORT}\n`);
});
