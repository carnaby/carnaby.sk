import type { Db } from '@carnaby/db';
import { All, Controller, Inject, Post, Req, Res } from '@nestjs/common';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Request, Response } from 'express';
import type { Auth } from '../auth/auth';
import { appUrl } from '../auth/auth';
import { AUTH } from '../auth/auth.module';
import { DB } from '../db/db.module';
import { authenticateMcpRequest } from './mcp-auth';
import { createCarnabyMcpServer } from './server';

function jsonRpcError(res: Response, status: number, message: string): void {
  res.status(status).json({ jsonrpc: '2.0', error: { code: -32000, message }, id: null });
}

/**
 * Remote MCP endpoint (Streamable HTTP, stateless): `https://carnaby.sk/api/mcp`.
 *
 * Every POST builds a fresh server + transport -- there is no per-client session state to keep,
 * which keeps it correct behind restarts and multiple replicas. Responses are plain JSON (no SSE
 * stream), which also survives the Next.js rewrite proxy in front of this api untouched.
 */
@Controller('api/mcp')
export class McpController {
  constructor(@Inject(DB) private readonly db: Db, @Inject(AUTH) private readonly auth: Auth) {}

  @Post()
  async handle(@Req() req: Request, @Res() res: Response): Promise<void> {
    const result = await authenticateMcpRequest(this.auth, this.db, req.headers);
    if (!result.ok) {
      if (result.status === 401) {
        // Tells MCP clients where to start the OAuth flow (RFC 9728). The path is served by
        // better-auth; Next rewrites the root /.well-known/* paths to it.
        res.setHeader('WWW-Authenticate', `Bearer resource_metadata="${appUrl()}/.well-known/oauth-protected-resource"`);
        res.setHeader('Access-Control-Expose-Headers', 'WWW-Authenticate');
      }
      jsonRpcError(res, result.status, result.message);
      return;
    }

    const server = createCarnabyMcpServer(this.db, result.actor);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => {
      void transport.close();
      void server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error('MCP request failed:', error);
      if (!res.headersSent) jsonRpcError(res, 500, 'Internal server error');
    }
  }

  /** Stateless server: no SSE stream to open (GET) and no session to end (DELETE). */
  @All()
  methodNotAllowed(@Res() res: Response): void {
    res.setHeader('Allow', 'POST');
    jsonRpcError(res, 405, 'Method not allowed');
  }
}
