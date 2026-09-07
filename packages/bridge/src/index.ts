import type { Context } from '@deepseek-ai/cordis';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { BridgeConfig } from './types.js';
import { handleHealthRequest } from './routes/health.js';
import { handleStaticRequest, resolveDefaultClientDir } from './routes/static.js';
import { handleSessionsRequest } from './routes/sessions.js';
import { handleModelsRequest } from './routes/models.js';
import { handleWorkspacesRequest } from './routes/workspaces.js';
import { handleAuthRequest } from './routes/auth.js';
import { requestAuthority, mintDshSessionCookie, hasValidDshCookie, loadDshSigningSecret } from './auth.js';

export * from './types.js';
export * from './auth.js';
export { handleHealthRequest } from './routes/health.js';
export { handleStaticRequest, resolveDefaultClientDir } from './routes/static.js';
export { handleSessionsRequest } from './routes/sessions.js';
export { handleModelsRequest } from './routes/models.js';
export { handleWorkspacesRequest } from './routes/workspaces.js';
export { handleAuthRequest } from './routes/auth.js';

export const name = 'dsh-remote-bridge';
export const inject = ['webServer'];

export function createBridgeHandler(
  ctxOrConfig?: Context | BridgeConfig,
  maybeConfig?: BridgeConfig
) {
  let ctx: Context | undefined;
  let config: BridgeConfig | undefined;

  if (
    ctxOrConfig &&
    ('clientDistPath' in ctxOrConfig ||
      'dshSecret' in ctxOrConfig ||
      'allowedWorkspaceRoots' in ctxOrConfig ||
      'credentialsPath' in ctxOrConfig)
  ) {
    config = ctxOrConfig as BridgeConfig;
    ctx = undefined;
  } else {
    ctx = ctxOrConfig as Context | undefined;
    config = maybeConfig;
  }

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

    // 2. Auth endpoint (SameSite=Lax cookie minting for PWA WebAPK)
    if (pathname === '/mobile/api/auth') {
      if (handleAuthRequest(req, res, config)) {
        return;
      }
    }

    // 3. Sessions listing
    if (pathname === '/mobile/api/sessions') {
      if (await handleSessionsRequest(req, res, ctx)) {
        return;
      }
    }

    // 4. Models listing
    if (pathname === '/mobile/api/models') {
      if (handleModelsRequest(req, res)) {
        return;
      }
    }

    // 5. Workspaces listing
    if (pathname === '/mobile/api/workspaces') {
      if (handleWorkspacesRequest(req, res, config)) {
        return;
      }
    }

    // 6. Static PWA asset serving (including /mobile/dsh-mobile-enhancer.css & .js)
    // On navigation to entry HTML (/mobile or /mobile/), ensure a valid SameSite=Lax cookie is attached
    let extraHeaders: Record<string, string> | undefined;
    if (pathname === '/mobile' || pathname === '/mobile/' || pathname === '/mobile/index.html') {
      const secret = Buffer.isBuffer(config?.dshSecret)
        ? config.dshSecret
        : typeof config?.dshSecret === 'string'
        ? Buffer.from(config.dshSecret, 'utf8')
        : loadDshSigningSecret(config?.credentialsPath);

      const authority = requestAuthority(req);
      if (secret && authority && !hasValidDshCookie(req, secret)) {
        const { headerValue } = mintDshSessionCookie(
          authority,
          secret,
          config?.cookieMaxAgeDays ?? 30
        );
        extraHeaders = { 'Set-Cookie': headerValue };
      }
    }

    if (handleStaticRequest(req, res, clientDir, extraHeaders)) {
      return;
    }

    // 6. Fallback for unhandled /mobile/api routes
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
  const handler = createBridgeHandler(ctx, config);

  // @ts-expect-error Cordis context carries webServer at runtime
  const webServer = ctx.webServer;
  if (!webServer || typeof webServer.register !== 'function') {
    throw new Error('dsh-remote-bridge requires webServer service on Cordis context');
  }

  // 1. Register prefix route under /mobile on the host webServer
  const disposeRoute = webServer.register({
    kind: 'prefix',
    path: '/mobile',
    handler
  });

  // 2. Register tapIndex transform on the official DSH Web App index.html
  let disposeTap = () => {};
  if (typeof webServer.tapIndex === 'function') {
    disposeTap = webServer.tapIndex((html: string) => {
      // Ensure responsive viewport meta tag
      let modified = html.replace(
        /<meta name="viewport"[^>]*>/i,
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content" />'
      );

      // Inject mobile drawer styles and hamburger script with dynamic cache-busting query
      const cacheBust = Date.now();
      const injection = `
    <!-- DSH Remote Mobile Enhancer -->
    <link rel="stylesheet" href="/mobile/dsh-mobile-enhancer.css?t=${cacheBust}" />
    <script type="module" src="/mobile/dsh-mobile-enhancer.js?t=${cacheBust}"></script>
      `;

      if (modified.includes('</head>')) {
        modified = modified.replace('</head>', `${injection}\n</head>`);
      } else {
        modified += injection;
      }

      return modified;
    });
  }

  // 3. Transparent auto-authentication on root GET / requests
  let disposeAuth = () => {};
  const ctxAny = ctx as any;
  const hookConnection = (connection: any) => {
    if (!connection || typeof connection.authorizeIndex !== 'function') return;
    const originalFn = connection.authorizeIndex;

    connection.authorizeIndex = function (req: any, res: any) {
      // If already authenticated by cookie, proceed normally
      if (typeof connection.browserAuth?.isAuthenticated === 'function' && connection.browserAuth.isAuthenticated(req)) {
        return originalFn.call(connection, req, res);
      }

      const url = new URL(req.url ?? '/', 'http://dsh.invalid');
      // If token query is present, let native token exchange proceed
      if (url.searchParams.has('token')) {
        return originalFn.call(connection, req, res);
      }

      // If GET / without cookie, auto-mint SameSite=Lax cookie and 303 redirect
      if (req.method === 'GET' && url.pathname === '/') {
        const secret = connection.browserAuth?.secret || loadDshSigningSecret(config?.credentialsPath);
        const authority = requestAuthority(req);

        if (secret && authority) {
          const maxAgeDays = config?.cookieMaxAgeDays ?? 30;
          const { headerValue } = mintDshSessionCookie(authority, secret, maxAgeDays);

          res.writeHead(303, {
            'cache-control': 'no-store',
            'location': '/',
            'referrer-policy': 'no-referrer',
            'set-cookie': headerValue
          });
          res.end();
          return false;
        }
      }

      return originalFn.call(connection, req, res);
    };

    disposeAuth = () => {
      connection.authorizeIndex = originalFn;
    };
  };

  if (typeof ctxAny.inject === 'function') {
    ctxAny.inject(['connection'], (innerCtx: any) => {
      hookConnection(innerCtx.connection);
    });
  } else if (ctxAny.connection) {
    hookConnection(ctxAny.connection);
  }

  return () => {
    disposeRoute();
    disposeTap();
    disposeAuth();
  };
}

export default {
  name,
  inject,
  apply,
  createBridgeHandler
};
