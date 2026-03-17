/**
 * 用户上下文服务
 * 管理用户对话历史、认证状态、多个 MCP 客户端连接
 */

import { CoreMessage } from 'ai';
import { MCPClientService, MCPClient } from './mcp';

export interface AuthToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

export interface UserContext {
  coreMessages: CoreMessage[];
  mcpClients: MCPClient[];
  authToken?: AuthToken;
  globalMcpInitialized: boolean;
}

export class ContextService {
  private userContext: UserContext;
  private static contextServices = new Map<string, ContextService>();

  constructor() {
    this.userContext = {
      coreMessages: [],
      mcpClients: [],
      globalMcpInitialized: false,
    };
  }

  static getUserContextService(userId: string) {
    if (this.contextServices.has(userId)) {
      return this.contextServices.get(userId)!;
    }
    const contextService = new ContextService();
    this.contextServices.set(userId, contextService);
    return contextService;
  }

  get isLogin() {
    return Boolean(this.getContext().authToken);
  }

  waitLogin(timeout: number = 5 * 60 * 1000) {
    let time = 0;
    return new Promise(resolve => {
      const checker = () => {
        if (this.isLogin) { resolve(true); return; }
        if (time > timeout) { resolve(false); return; }
        time += 1000;
        setTimeout(checker, 1000);
      };
      checker();
    });
  }

  addMessage(coreMessages: CoreMessage[]) {
    this.userContext.coreMessages.push(...coreMessages);
  }

  cleanMessage() {
    this.userContext.coreMessages = [];
  }

  getContext() {
    return this.userContext;
  }

  async addAuthToken(authToken: AuthToken) {
    this.userContext.authToken = authToken;
    await this.createBitableMcpClient();
  }

  /**
   * 初始化全局 MCP 客户端（飞书文档、JIRA、Markitdown）
   * 不需要用户认证，只需创建一次
   */
  async initGlobalMcpClients() {
    if (this.userContext.globalMcpInitialized) return;

    console.log('[Context] 初始化全局 MCP 客户端...');
    const globalClients = await MCPClientService.createGlobalMCPClients();
    this.userContext.mcpClients.push(...globalClients);
    this.userContext.globalMcpInitialized = true;
    console.log(`[Context] 全局 MCP 客户端就绪，共 ${globalClients.length} 个`);
  }

  /**
   * 创建 Bitable MCP 客户端（可带用户 token）
   */
  async createBitableMcpClient() {
    try {
      const mcpClient = await MCPClientService.createLarkBitableMCPClient(
        this.userContext.authToken?.accessToken
      );
      this.userContext.mcpClients.push(mcpClient);
      console.log('[Context] ✅ Bitable MCP 客户端创建成功');
    } catch (e: any) {
      console.error('[Context] ❌ Bitable MCP 客户端创建失败:', e?.message || e);
    }
  }

  /**
   * 确保获取有效的用户上下文，自动初始化所有 MCP 客户端
   */
  async mustGetContext() {
    await this.initGlobalMcpClients();

    // globalMcpInitialized 为 true 但 bitable 还没创建时，需要创建
    // 用一个单独的标记来跟踪 bitable 是否已创建
    if (!this._bitableInitialized) {
      await this.createBitableMcpClient();
      this._bitableInitialized = true;
    }

    return this.getContext();
  }

  private _bitableInitialized = false;
}
