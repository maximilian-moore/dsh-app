import type { IncomingMessage, ServerResponse } from 'node:http';
import { existsSync, statSync, createReadStream } from 'node:fs';
import { resolve, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

export function resolveDefaultClientDir(): string {
  // Resolved relative to this module in both development (src) and production (dist)
  const currentDir = fileURLToPath(new URL('.', import.meta.url));
  // In src/routes/ or dist/routes/, client is ../../../client/public
  const candidate1 = resolve(currentDir, '../../../client/public');
  if (existsSync(candidate1)) {
    return candidate1;
  }
  const candidate2 = resolve(currentDir, '../../../../packages/client/public');
  if (existsSync(candidate2)) {
    return candidate2;
  }
  return candidate1;
}

export function handleStaticRequest(
  req: IncomingMessage,
  res: ServerResponse,
  clientDir: string
): boolean {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return false;
  }

  const rawUrl = req.url || '';
  const pathname = rawUrl.split('?')[0];

  if (!pathname.startsWith('/mobile')) {
    return false;
  }

  // Do not handle API routes here
  if (pathname.startsWith('/mobile/api/')) {
    return false;
  }

  // Strip leading /mobile
  let relativePath = pathname.slice('/mobile'.length);
  if (relativePath === '' || relativePath === '/') {
    relativePath = '/index.html';
  }

  // Normalize and guard against directory traversal
  const safeRelativePath = normalize(relativePath).replace(/^(\.\.[\/\\])+/, '');
  const absoluteFilePath = resolve(clientDir, '.' + safeRelativePath);

  // Path containment check
  const resolvedClientDir = resolve(clientDir);
  if (!absoluteFilePath.startsWith(resolvedClientDir)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('403 Forbidden: Invalid Path');
    return true;
  }

  let targetPath = absoluteFilePath;
  let isIndexFallback = false;

  if (!existsSync(targetPath) || !statSync(targetPath).isFile()) {
    // If requesting a path without file extension (e.g. /mobile/session/123), SPA fallback to index.html
    const hasExtension = safeRelativePath.includes('.');
    if (!hasExtension) {
      targetPath = join(resolvedClientDir, 'index.html');
      isIndexFallback = true;
    }
  }

  if (!existsSync(targetPath) || !statSync(targetPath).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
    return true;
  }

  const ext = targetPath.slice(targetPath.lastIndexOf('.')).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  const headers: Record<string, string> = {
    'Content-Type': contentType
  };

  // Special headers for Service Worker and manifest
  if (targetPath.endsWith('sw.js')) {
    headers['Service-Worker-Allowed'] = '/mobile/';
    headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
  } else if (isIndexFallback || targetPath.endsWith('index.html')) {
    headers['Cache-Control'] = 'no-cache';
  } else {
    headers['Cache-Control'] = 'public, max-age=3600';
  }

  const stat = statSync(targetPath);
  headers['Content-Length'] = stat.size.toString();

  res.writeHead(200, headers);

  if (req.method === 'HEAD') {
    res.end();
    return true;
  }

  const stream = createReadStream(targetPath);
  stream.on('error', () => {
    if (!res.headersSent) {
      res.writeHead(500);
      res.end('Internal Server Error');
    }
  });
  stream.pipe(res);

  return true;
}
