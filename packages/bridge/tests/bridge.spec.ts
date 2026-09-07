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
  options: { method?: string; url: string }
): Promise<{ statusCode: number; headers: Record<string, string>; body: string }> {
  return new Promise((resolvePromise, reject) => {
    let statusCode = 200;
    const headers: Record<string, string> = {};
    let body = '';

    const req = new EventEmitter() as unknown as IncomingMessage;
    req.method = options.method || 'GET';
    req.url = options.url;
    req.headers = {};

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
    expect(disposer).toBe(mockDisposer);
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

    it('blocks directory traversal attempts', async () => {
      const res = await simulateRequest(handler, { url: '/mobile/../../package.json' });
      expect([403, 404]).toContain(res.statusCode);
      expect(res.body).not.toContain('dsh-remote-monorepo');
    });
  });
});
