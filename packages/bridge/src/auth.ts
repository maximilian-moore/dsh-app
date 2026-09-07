import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { IncomingMessage } from 'node:http';

const COOKIE_PREFIX = 'dsh-auth-';
const COOKIE_PAYLOAD_VERSION = 1;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]*$/;

export function encodeBase64Url(value: Buffer | string): string {
  const buf = Buffer.isBuffer(value) ? value : Buffer.from(value, 'utf8');
  return buf
    .toString('base64')
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/u, '');
}

export function decodeBase64Url(value: string): Buffer | undefined {
  if (!BASE64URL_PATTERN.test(value) || value.length % 4 === 1) return undefined;
  const padding = '='.repeat((4 - value.length % 4) % 4);
  const decoded = Buffer.from(value.replaceAll('-', '+').replaceAll('_', '/') + padding, 'base64');
  return encodeBase64Url(decoded) === value ? decoded : undefined;
}

export function loadDshSigningSecret(credentialsPath?: string): Buffer | undefined {
  const credPath = credentialsPath || join(homedir(), '.dsh', '.credentials.yaml');
  if (!existsSync(credPath)) return undefined;
  try {
    const content = readFileSync(credPath, 'utf8');
    const match = content.match(/client-connection\/browser-session:[\s\S]*?secret:\s*([A-Za-z0-9_-]+)/);
    if (!match || !match[1]) return undefined;
    const secretStr = match[1].trim();
    const decoded = decodeBase64Url(secretStr);
    if (!decoded || decoded.byteLength !== 32) return undefined;
    return decoded;
  } catch {
    return undefined;
  }
}

export function requestAuthority(req: IncomingMessage): string | undefined {
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  if (!host || Array.isArray(host)) return undefined;
  try {
    return new URL(`http://${host}`).host;
  } catch {
    return undefined;
  }
}

export function computeCookieName(authority: string): string {
  return COOKIE_PREFIX + encodeBase64Url(createHash('sha256').update(authority).digest());
}

export function mintDshSessionCookie(
  authority: string,
  secret: Buffer,
  maxAgeDays: number = 30
): { cookieName: string; cookieValue: string; headerValue: string; maxAgeSeconds: number } {
  const cookieName = computeCookieName(authority);
  const maxAgeSeconds = Math.round(maxAgeDays * 86400);
  const now = Date.now();
  const expiresAt = now + maxAgeSeconds * 1000;

  const payload = {
    version: COOKIE_PAYLOAD_VERSION,
    authority,
    issuedAt: now,
    expiresAt
  };

  const body = encodeBase64Url(Buffer.from(JSON.stringify(payload), 'utf8'));
  const sig = createHmac('sha256', secret).update(body).digest();
  const cookieValue = `v1.${body}.${encodeBase64Url(sig)}`;

  // Use SameSite=Lax so Chrome on Android doesn't withhold the cookie when launching the PWA WebAPK
  const headerValue = `${cookieName}=${cookieValue}; Max-Age=${maxAgeSeconds}; Path=/; Expires=${new Date(expiresAt).toUTCString()}; HttpOnly; SameSite=Lax`;

  return { cookieName, cookieValue, headerValue, maxAgeSeconds };
}

export function hasValidDshCookie(req: IncomingMessage, secret: Buffer): boolean {
  const authority = requestAuthority(req);
  if (!authority) return false;

  const expectedName = computeCookieName(authority);
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return false;

  let value: string | undefined;
  for (const segment of cookieHeader.split(';')) {
    const at = segment.indexOf('=');
    if (at === -1) continue;
    if (segment.slice(0, at).trim() === expectedName) {
      value = segment.slice(at + 1).trim();
      break;
    }
  }

  if (!value) return false;

  const parts = value.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1' || !parts[1] || !parts[2]) return false;

  const bodyBytes = decodeBase64Url(parts[1]);
  const actualSig = decodeBase64Url(parts[2]);
  if (!bodyBytes || !actualSig) return false;

  const expectedSig = createHmac('sha256', secret).update(parts[1]).digest();
  if (actualSig.byteLength !== expectedSig.byteLength || !timingSafeEqual(actualSig, expectedSig)) {
    return false;
  }

  try {
    const payload = JSON.parse(bodyBytes.toString('utf8'));
    if (
      payload.version !== COOKIE_PAYLOAD_VERSION ||
      payload.authority !== authority ||
      typeof payload.expiresAt !== 'number' ||
      payload.expiresAt <= Date.now()
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
