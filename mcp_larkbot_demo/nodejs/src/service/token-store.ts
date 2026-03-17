/**
 * Token 持久化存储服务
 * Token Persistence Store Service
 *
 * 功能说明:
 * - 将用户 OAuth Token 持久化到磁盘
 * - 服务重启后自动恢复登录状态
 * - 支持 Token 刷新
 */

import fs from 'fs';
import path from 'path';
import { AuthToken } from './context';
import { config } from '../config';

const TOKEN_FILE = path.join(__dirname, '../../.tokens.json');

interface StoredTokens {
  [userId: string]: AuthToken & { refreshToken: string };
}

/**
 * 从磁盘加载所有已保存的 Token
 */
function loadTokens(): StoredTokens {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      return JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('[TokenStore] 读取 token 文件失败:', e);
  }
  return {};
}

/**
 * 将 Token 写入磁盘
 */
function saveTokens(tokens: StoredTokens) {
  try {
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2), 'utf-8');
  } catch (e) {
    console.error('[TokenStore] 写入 token 文件失败:', e);
  }
}

/**
 * 保存用户 Token
 */
export function saveUserToken(userId: string, authToken: AuthToken) {
  const tokens = loadTokens();
  tokens[userId] = authToken as StoredTokens[string];
  saveTokens(tokens);
  console.log(`[TokenStore] 已保存用户 ${userId} 的 token`);
}

/**
 * 获取用户已保存的 Token
 */
export function getSavedToken(userId: string): AuthToken | undefined {
  const tokens = loadTokens();
  return tokens[userId];
}

/**
 * 使用 refresh_token 刷新 access_token
 */
export async function refreshAccessToken(userId: string): Promise<AuthToken | null> {
  const saved = getSavedToken(userId);
  if (!saved?.refreshToken) {
    console.log(`[TokenStore] 用户 ${userId} 无 refreshToken，需重新登录`);
    return null;
  }

  try {
    const res = await fetch(`${config.lark.domain}/open-apis/authen/v2/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        client_id: config.lark.appId,
        client_secret: config.lark.appSecret,
        refresh_token: saved.refreshToken,
      }),
    });
    const data = await res.json();

    if (data.access_token) {
      const newToken: AuthToken = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: Date.now() + data.expires_in * 1000,
      };
      saveUserToken(userId, newToken);
      console.log(`[TokenStore] 用户 ${userId} token 刷新成功`);
      return newToken;
    } else {
      console.error(`[TokenStore] 刷新失败:`, data);
      return null;
    }
  } catch (e) {
    console.error(`[TokenStore] 刷新请求异常:`, e);
    return null;
  }
}

/**
 * 删除用户 Token
 */
export function removeUserToken(userId: string) {
  const tokens = loadTokens();
  delete tokens[userId];
  saveTokens(tokens);
}
