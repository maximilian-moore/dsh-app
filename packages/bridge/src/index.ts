import type { Context } from '@deepseek-ai/cordis';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { BridgeConfig } from './types.js';
import { handleHealthRequest } from './routes/health.js';
import { handleStaticRequest, resolveDefaultClientDir } from './routes/static.js';

export * from './types.js';
export { handleHealthRequest } from './routes/health.js';
export { handleStaticRequest, resolveDefaultClientDir } from './routes/static.js';

export const name = 'dsh-remote-bridge';
export const inject = ['webServer'];

export function createBridgeHandler(config?: BridgeConfig) {
  const clientDir = config?.clientDistPath || resolveDefaultClientDir();

  return async function bridgeHttpHandler(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = req.url || '';
    const pathname = url.split('?')[0];

    // 1. Health check endpoint
    if (pathname === '/mobile/api/health') {
      if (handleHealthRequest(req, res)) {
        return;
      }
    }

    // 2. Static PWA asset serving
    if (handleStaticRequest(req, res, clientDir)) {
      return;
    }

    // 3. Fallback for unhandled /mobile/api routes (will be implemented in next checkpoints)
    if (pathname.startsWith('/mobile/api/')) {
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Endpoint not implemented', path: pathname }));
      return;
    }

    // Unhandled /mobile route
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
  };
}

export function apply(ctx: Context, config?: BridgeConfig): () => void {
  const handler = createBridgeHandler(config);

  // Register prefix route under /mobile on the host webServer
  // @ts-expect-error Cordis context carries webServer at runtime
  const webServer = ctx.webServer;
  if (!webServer || typeof webServer.register !== 'function') {
    throw new Error('dsh-remote-bridge requires webServer service on Cordis context');
  }

  const disposer = webServer.register({
    kind: 'prefix',
    path: '/mobile',
    handler
  });

  return disposer;
}

export default {
  name,
  inject,
  apply,
  createBridgeHandler
};
