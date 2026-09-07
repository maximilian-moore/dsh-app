import { describe, it, expect, vi } from 'vitest';
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { EventEmitter } from 'node:events';
import { createBridgeHandler, apply, name, inject } from '../src/index.js';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const clientDir = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../client/public');

// Helper to simulate HTTP requests against the handler
async function simulateRequest(
  handler: (req: IncomingMessage, res: ServerResponse) => Promise<void>,
  options: { method?: string; url: string; headers?: Record<string, string> }
): Promise<{ statusCode: number; headers: Record<string, string>; body: string }> {
  return new Promise((resolvePromise, reject) => {
    let statusCode = 200;
    const headers: Record<string, string> = {};
    let body = '';

    const req = new EventEmitter() as unknown as IncomingMessage;
    req.method = options.method || 'GET';
    req.url = options.url;
    req.headers = options.headers || {};

    const res = new EventEmitter() as unknown as ServerResponse;
    res.writeHead = vi.fn((code: number, hdrs?: Record<string, string>) => {
      statusCode = code;
      if (hdrs) {
        for (const [k, v] of Object.entries(hdrs)) {
          headers[k.toLowerCase()] = v;
        }
      }
      return res;
    });

    res.setHeader = vi.fn((name: string, value: string) => {
      headers[name.toLowerCase()] = value;
      return res;
    });

    res.write = vi.fn((chunk: string | Buffer) => {
      body += chunk.toString();
      return true;
    });

    res.end = vi.fn((chunk?: string | Buffer) => {
      if (chunk) {
        body += chunk.toString();
      }
      resolvePromise({ statusCode, headers, body });
      return res;
    });

    handler(req, res).catch(reject);
  });
}

describe('dsh-remote-bridge plugin', () => {
  it('exports valid Cordis plugin metadata', () => {
    expect(name).toBe('dsh-remote-bridge');
    expect(inject).toContain('webServer');
  });

  it('registers prefix route on webServer when applied', () => {
    const mockDisposer = vi.fn();
    const mockRegister = vi.fn().mockReturnValue(mockDisposer);
    const mockCtx = {
      webServer: {
        host: '127.0.0.1' as const,
        port: 3080,
        register: mockRegister
      }
    };

    const disposer = apply(mockCtx as any);
    expect(mockRegister).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'prefix',
        path: '/mobile'
      })
    );
    expect(typeof disposer).toBe('function');
    disposer();
    expect(mockDisposer).toHaveBeenCalled();
  });

  it('hooks connection.authorizeIndex to auto-mint SameSite=Lax cookie on root requests', () => {
    const mockSecret = Buffer.from('01234567890123456789012345678901');
    const mockOriginalAuthorize = vi.fn().mockReturnValue(false);
    const mockConnection = {
      authorizeIndex: mockOriginalAuthorize,
      browserAuth: {
        isAuthenticated: vi.fn().mockReturnValue(false),
        secret: mockSecret,
        maxAgeMilliseconds: 30 * 86400 * 1000
      }
    };
    const mockRegister = vi.fn().mockReturnValue(vi.fn());
    const mockCtx = {
      webServer: { host: '127.0.0.1' as const, port: 3080, register: mockRegister },
      connection: mockConnection
    };

    const disposer = apply(mockCtx as any, { dshSecret: mockSecret });
    expect(mockConnection.authorizeIndex).not.toBe(mockOriginalAuthorize);

    const mockReq = {
      method: 'GET',
      url: '/',
      headers: { host: 'tailnet.ts.net' }
    };
    const writeHeadSpy = vi.fn();
    const endSpy = vi.fn();
    const mockRes = { writeHead: writeHeadSpy, end: endSpy };

    const allowed = mockConnection.authorizeIndex(mockReq, mockRes);
    expect(allowed).toBe(false);
    expect(writeHeadSpy).toHaveBeenCalledWith(303, expect.objectContaining({
      location: '/',
      'set-cookie': expect.stringContaining('SameSite=Lax')
    }));
    expect(endSpy).toHaveBeenCalled();

    disposer();
    expect(mockConnection.authorizeIndex).toBe(mockOriginalAuthorize);
  });

  it('injects dynamic cache-busting query in tapIndex transform', () => {
    let tapCallback: ((html: string) => string) | undefined;
    const mockCtx = {
      webServer: {
        host: '127.0.0.1' as const,
        port: 3080,
        register: vi.fn().mockReturnValue(vi.fn()),
        tapIndex: vi.fn((cb) => {
          tapCallback = cb;
          return vi.fn();
        })
      }
    };

    apply(mockCtx as any);
    expect(tapCallback).toBeDefined();
    const outputHtml = tapCallback!('<html><head></head><body></body></html>');
    expect(outputHtml).toMatch(/dsh-mobile-enhancer\.css\?t=\d+/);
    expect(outputHtml).toMatch(/dsh-mobile-enhancer\.js\?t=\d+/);
  });

  describe('HTTP endpoints', () => {
    const handler = createBridgeHandler({ clientDistPath: clientDir });

    it('answers GET /mobile/api/health with status ok', async () => {
      const response = await simulateRequest(handler, { url: '/mobile/api/health' });
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');

      const data = JSON.parse(response.body);
      expect(data.status).toBe('ok');
      expect(data.service).toBe('dsh-remote-bridge');
      expect(data.version).toBe('0.1.0');
    });

    it('serves index.html at /mobile/ and /mobile', async () => {
      const resSlash = await simulateRequest(handler, { url: '/mobile/' });
      expect(resSlash.statusCode).toBe(200);
      expect(resSlash.headers['content-type']).toContain('text/html');
      expect(resSlash.body).toContain('DSH Remote');

      const resNoSlash = await simulateRequest(handler, { url: '/mobile' });
      expect(resNoSlash.statusCode).toBe(200);
      expect(resNoSlash.headers['content-type']).toContain('text/html');
    });

    it('serves manifest.webmanifest with proper headers', async () => {
      const response = await simulateRequest(handler, { url: '/mobile/manifest.webmanifest' });
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/manifest+json');
      const manifest = JSON.parse(response.body);
      expect(manifest.name).toBe('DSH Remote');
      expect(manifest.display).toBe('standalone');
    });

    it('serves sw.js with Service-Worker-Allowed header', async () => {
      const response = await simulateRequest(handler, { url: '/mobile/sw.js' });
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/javascript');
      expect(response.headers['service-worker-allowed']).toBe('/mobile/');
    });

    it('serves style.css and app.js', async () => {
      const cssRes = await simulateRequest(handler, { url: '/mobile/style.css' });
      expect(cssRes.statusCode).toBe(200);
      expect(cssRes.headers['content-type']).toContain('text/css');

      const jsRes = await simulateRequest(handler, { url: '/mobile/app.js' });
      expect(jsRes.statusCode).toBe(200);
      expect(jsRes.headers['content-type']).toContain('application/javascript');
    });

    it('serves dsh-mobile-enhancer.css with mobile settings dropdown and scroll fixes', async () => {
      const res = await simulateRequest(handler, { url: '/mobile/dsh-mobile-enhancer.css' });
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain('text/css');
      expect(res.body).toContain('dsh-mobile-settings-select');
      expect(res.body).toContain('touch-action: pan-y');
      expect(res.body).toContain('calc(100dvh - 56px)');
      expect(res.body).toContain('-webkit-overflow-scrolling: touch');
    });

    it('serves dsh-mobile-enhancer.js with settings section dropdown enhancer', async () => {
      const res = await simulateRequest(handler, { url: '/mobile/dsh-mobile-enhancer.js' });
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain('application/javascript');
      expect(res.body).toContain('setupSettingsMobileNav');
      expect(res.body).toContain('dsh-mobile-settings-select');
      expect(res.body).toContain('aria-current');
    });

    it('answers GET /mobile/api/models with available model options', async () => {
      const response = await simulateRequest(handler, { url: '/mobile/api/models' });
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');

      const data = JSON.parse(response.body);
      expect(data.defaultModel).toBeDefined();
      expect(Array.isArray(data.models)).toBe(true);
      expect(data.models.length).toBeGreaterThan(0);
      expect(data.models.some((m: any) => m.id.includes('deepseek'))).toBe(true);
    });

    it('answers GET /mobile/api/workspaces with workspace directories', async () => {
      const response = await simulateRequest(handler, { url: '/mobile/api/workspaces' });
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');

      const data = JSON.parse(response.body);
      expect(data.current).toBeDefined();
      expect(Array.isArray(data.workspaces)).toBe(true);
      expect(data.workspaces.length).toBeGreaterThan(0);
    });

    it('answers GET /mobile/api/sessions with sessions list', async () => {
      const response = await simulateRequest(handler, { url: '/mobile/api/sessions' });
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');

      const data = JSON.parse(response.body);
      expect(Array.isArray(data.sessions)).toBe(true);
    });

    it('blocks directory traversal attempts', async () => {
      const res = await simulateRequest(handler, { url: '/mobile/../../package.json' });
      expect([403, 404]).toContain(res.statusCode);
      expect(res.body).not.toContain('dsh-remote-monorepo');
    });

    describe('Authentication & SameSite=Lax cookie minting', () => {
      const mockSecret = Buffer.from('01234567890123456789012345678901'); // 32 bytes
      const authHandler = createBridgeHandler({
        clientDistPath: clientDir,
        dshSecret: mockSecret
      });

      it('answers GET /mobile/api/auth and mints SameSite=Lax cookie', async () => {
        const response = await simulateRequest(authHandler, {
          url: '/mobile/api/auth',
          headers: { host: 'test.tailnet.ts.net' }
        });
        expect(response.statusCode).toBe(200);
        expect(response.headers['content-type']).toContain('application/json');
        expect(response.headers['set-cookie']).toBeDefined();
        expect(response.headers['set-cookie']).toContain('SameSite=Lax');
        expect(response.headers['set-cookie']).toContain('HttpOnly');
        expect(response.headers['set-cookie']).toContain('Path=/');

        const data = JSON.parse(response.body);
        expect(data.status).toBe('ok');
        expect(data.authenticated).toBe(true);
        expect(data.cookieName).toMatch(/^dsh-auth-/);
      });

      it('automatically attaches SameSite=Lax cookie on /mobile/ index requests', async () => {
        const response = await simulateRequest(authHandler, {
          url: '/mobile/',
          headers: { host: 'test.tailnet.ts.net' }
        });
        expect(response.statusCode).toBe(200);
        expect(response.headers['set-cookie']).toBeDefined();
        expect(response.headers['set-cookie']).toContain('SameSite=Lax');
      });

      it('verifies signed cookie with hasValidDshCookie', async () => {
        const { mintDshSessionCookie, hasValidDshCookie } = await import('../src/auth.js');
        const authority = 'my-host.ts.net';
        const { cookieName, cookieValue } = mintDshSessionCookie(authority, mockSecret);

        const mockReqValid = {
          headers: {
            host: authority,
            cookie: `${cookieName}=${cookieValue}`
          }
        } as any;

        const mockReqInvalid = {
          headers: {
            host: authority,
            cookie: `${cookieName}=v1.tampered.signature`
          }
        } as any;

        expect(hasValidDshCookie(mockReqValid, mockSecret)).toBe(true);
        expect(hasValidDshCookie(mockReqInvalid, mockSecret)).toBe(false);
      });
    });
  });
});

