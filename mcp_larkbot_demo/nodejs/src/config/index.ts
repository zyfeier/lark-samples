/**
 * 应用程序配置文件
 * Application configuration file
 *
 * 功能说明:
 * - 管理环境变量配置
 * - 配置飞书/Lark应用信息
 * - 配置AI模型参数
 * - 设置服务器端口
 *
 * Features:
 * - Manage environment variable configuration
 * - Configure Lark application information
 * - Configure AI model parameters
 * - Set server port
 */

import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import dotenv from 'dotenv';

// 加载环境变量配置文件
// Load environment variables from .env file
dotenv.config();

/**
 * 应用程序主配置对象
 * Main application configuration object
 */
export const config = {
  /**
   * 飞书/Lark应用配置
   * Lark application configuration
   */
  lark: {
    // 请求域名
    // Request domain
    domain: process.env.LARK_DOMAIN || 'https://open.feishu.cn',
    // 飞书/Lark应用ID，从环境变量获取
    // Feishu/Lark App ID from environment variables
    appId: process.env.APP_ID || '',

    // 飞书/Lark应用密钥，从环境变量获取
    // Feishu/Lark  App Secret from environment variables
    appSecret: process.env.APP_SECRET || '',

    // OAuth回调路径，用户授权后的重定向地址
    // OAuth callback path for user authorization redirect
    callbackPath: '/callback',

    // OAuth授权范围
    // OAuth authorization scopes
    scope: [
      "offline_access",
      "base:app:create",
      "base:field:read",
      "base:record:create",
      "base:record:retrieve",
      "base:record:update",
      "base:table:create",
      "contact:user.id:readonly",
      "docs:document.media:upload",
      "docs:document:import",
      "docs:permission.member:create",
      "docx:document:create",
      "docx:document:readonly",
      "im:chat.members:read",
      "im:chat:read",
      "search:docs:read",
      "wiki:wiki:readonly",
      "base:table:read",
      "bitable:app",
      "bitable:app:readonly",
      "im:message:readonly"
    ],
  },

  /**
   * AI代理配置
   * AI agent configuration
   */
  agent: {
    // 最大执行步数，防止无限循环
    // Maximum execution steps to prevent infinite loops
    maxStep: 10,

    // AI模型配置
    // AI model configuration
    model: createOpenAICompatible({
      // AI服务的基础URL
      // Base URL for AI service
      baseURL: process.env.OPENAI_BASE_URL || '',

      // AI模型名称
      // AI model name
      name: process.env.OPENAI_MODEL || '',

      // AI服务的API密钥
      // API key for AI service
      apiKey: process.env.OPENAI_API_KEY || '',

      // 请求头配置，某些AI服务需要特殊的API密钥头
      // Request headers configuration, some AI services require special API key headers
      headers: { 'api-key': process.env.OPENAI_API_KEY || '' },
    }).chatModel(process.env.OPENAI_MODEL || ''),
  },

  /**
   * MCP 服务器配置
   */
  mcp: {
    feishuMcp: {
      url: process.env.FEISHU_MCP_URL || '',
    },
    jira: {
      url: process.env.JIRA_MCP_URL || '',
      headers: {
        'X-Atlassian-Jira-Url': process.env.JIRA_URL || '',
        'X-Atlassian-Username': process.env.JIRA_USERNAME || '',
        'X-Atlassian-Jira-Personal-Token': process.env.JIRA_TOKEN || '',
      },
    },
  },

  /**
   * 服务器端口配置
   */
  port: parseInt(process.env.PORT || '3000'),
};
