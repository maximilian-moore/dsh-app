import type { IncomingMessage, ServerResponse } from 'node:http';

export function handleHealthRequest(req: IncomingMessage, res: ServerResponse): boolean {
  const url = req.url || '';
  const pathname = url.split('?')[0];

  if (pathname === '/mobile/api/health' && (req.method === 'GET' || req.method === 'HEAD')) {
    const payload = JSON.stringify({
      status: 'ok',
      service: 'dsh-remote-bridge',
      version: '0.1.0',
      timestamp: new Date().toISOString()
    });

    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    });
    if (req.method !== 'HEAD') {
      res.end(payload);
    } else {
      res.end();
    }
    return true;
  }
  return false;
}
