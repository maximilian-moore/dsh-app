import type { IncomingMessage, ServerResponse } from 'node:http';
import { requestAuthority, mintDshSessionCookie, hasValidDshCookie, loadDshSigningSecret } from '../auth.js';
import type { BridgeConfig } from '../types.js';

export function handleAuthRequest(
  req: IncomingMessage,
  res: ServerResponse,
  config?: BridgeConfig
): boolean {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return true;
  }

  const secret = Buffer.isBuffer(config?.dshSecret)
    ? config.dshSecret
    : typeof config?.dshSecret === 'string'
    ? Buffer.from(config.dshSecret, 'utf8')
    : loadDshSigningSecret(config?.credentialsPath);

  const authority = requestAuthority(req);

  if (!authority || !secret) {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      status: 'unavailable',
      authenticated: false,
      message: !authority ? 'No host authority header' : 'DSH signing secret not found'
    }));
    return true;
  }

  const alreadyValid = hasValidDshCookie(req, secret);
  const { cookieName, headerValue, maxAgeSeconds } = mintDshSessionCookie(
    authority,
    secret,
    config?.cookieMaxAgeDays ?? 30
  );

  res.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Set-Cookie': headerValue
  });

  res.end(JSON.stringify({
    status: 'ok',
    authenticated: true,
    alreadyValid,
    authority,
    cookieName,
    maxAgeSeconds
  }));
  return true;
}
