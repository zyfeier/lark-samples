/**
 * MCP客户端服务
 * 支持多种 MCP 服务器：飞书Bitable(stdio)、飞书文档(SSE)、JIRA(HTTP)、Markitdown(stdio)
 */

import { experimental_createMCPClient as createMCPClient } from 'ai';
// @ts-ignore
import { Experimental_StdioMCPTransport as StdioMCPTransport } from 'ai/mcp-stdio';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { config } from '../config';

/** MCP 客户端类型 */
export type MCPClient = Awaited<ReturnType<typeof createMCPClient>>;

export class MCPClientService {

  /**
   * 飞书 Bitable MCP (stdio) — 多维表格操作
   */
  static async createLarkBitableMCPClient(accessToken?: string): Promise<MCPClient> {
    let command = 'npx';
    let args = [
      '-y', '@larksuiteoapi/lark-mcp', 'mcp',
      '-a', config.lark.appId,
      '-s', config.lark.appSecret,
      '-d', config.lark.domain,
      '-t', 'preset.base.default',
    ];

    if (process.platform === 'win32') {
      args = ['/c', command, ...args];
      command = 'cmd.exe';
    }

    if (accessToken) {
      args.push('-u', accessToken, '--token-mode', 'user_access_token');
    }

    return createMCPClient({
      transport: new StdioMCPTransport({ command, args }),
    });
  }

  /**
   * 飞书文档 MCP (HTTP Streamable) — 文档读写、搜索、评论、知识库
   */
  static async createFeishuDocMCPClient(): Promise<MCPClient> {
    const url = new URL(config.mcp.feishuMcp.url);
    const transport = new StreamableHTTPClientTransport(url);
    return createMCPClient({
      transport: transport as any,
    });
  }

  /**
   * JIRA MCP (HTTP Streamable) — issue 查询/创建/更新
   */
  static async createJiraMCPClient(): Promise<MCPClient> {
    const url = new URL(config.mcp.jira.url);
    const transport = new StreamableHTTPClientTransport(url, {
      requestInit: {
        headers: config.mcp.jira.headers,
      },
    });
    return createMCPClient({
      transport: transport as any, // MCP SDK Transport 兼容 ai 的 MCPTransport
    });
  }

  /**
   * Markitdown MCP (stdio) — PDF/网页转 Markdown
   */
  static async createMarkitdownMCPClient(): Promise<MCPClient> {
    return createMCPClient({
      transport: new StdioMCPTransport({
        command: 'uvx',
        args: ['--with', 'markitdown[pdf]', 'markitdown-mcp'],
      }),
    });
  }

  /**
   * 创建所有不需要用户认证的全局 MCP 客户端
   * 单个失败不影响其他
   */
  static async createGlobalMCPClients(): Promise<MCPClient[]> {
    const clients: MCPClient[] = [];

    const tasks = [
      { name: 'feishu-doc', fn: () => this.createFeishuDocMCPClient() },
      { name: 'jira', fn: () => this.createJiraMCPClient() },
      { name: 'markitdown', fn: () => this.createMarkitdownMCPClient() },
    ];

    const results = await Promise.allSettled(tasks.map(t => t.fn()));

    results.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        clients.push(result.value);
        console.log(`[MCP] ✅ ${tasks[i].name} 客户端创建成功`);
      } else {
        console.error(`[MCP] ❌ ${tasks[i].name} 客户端创建失败:`, result.reason?.message || result.reason);
      }
    });

    return clients;
  }
}
