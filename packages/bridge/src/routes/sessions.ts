import type { IncomingMessage, ServerResponse } from 'node:http';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import { homedir } from 'node:os';
import type { Context } from '@deepseek-ai/cordis';

export interface SessionSummary {
  id: string;
  title: string;
  cwd?: string;
  workspaceName?: string;
  createdAt: number;
  updatedAt?: number;
  live?: boolean;
}

export function decodeWorkspaceDirName(dirName: string): string {
  if (dirName.startsWith('--') && dirName.endsWith('--')) {
    const inner = dirName.slice(2, -2);
    return '/' + inner.replace(/-/g, '/');
  }
  return dirName;
}

export function listSessionsFromDisk(): SessionSummary[] {
  const sessionsRoot = join(homedir(), '.dsh/sessions');
  if (!existsSync(sessionsRoot)) {
    return [];
  }

  const results: SessionSummary[] = [];

  try {
    const projectDirs = readdirSync(sessionsRoot);
    for (const pDir of projectDirs) {
      if (pDir.startsWith('.')) continue;
      const projectPath = join(sessionsRoot, pDir);
      try {
        if (!statSync(projectPath).isDirectory()) continue;
        const sessionDirs = readdirSync(projectPath);
        for (const sDir of sessionDirs) {
          if (!sDir.startsWith('session-')) continue;
          const sessionPath = join(projectPath, sDir);
          try {
            const stat = statSync(sessionPath);
            const decodedCwd = decodeWorkspaceDirName(pDir);
            const wsName = basename(decodedCwd) || 'Default';

            const shortId = sDir.replace('session-', '').slice(0, 8);
            const title = `Session in ${wsName} (${shortId})`;

            results.push({
              id: sDir,
              title,
              cwd: decodedCwd,
              workspaceName: wsName,
              createdAt: Math.floor(stat.birthtimeMs || stat.mtimeMs),
              updatedAt: Math.floor(stat.mtimeMs),
              live: false
            });
          } catch {
            // Ignore single session stat error
          }
        }
      } catch {
        // Ignore single project dir error
      }
    }
  } catch {
    // Ignore root read error
  }

  results.sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
  return results;
}

export async function getSessions(ctx?: Context): Promise<SessionSummary[]> {
  try {
    const diskSessions = listSessionsFromDisk();
    if (diskSessions.length > 0) {
      return diskSessions;
    }
  } catch (err) {
    console.warn('[dsh-remote-bridge] disk scan error:', err);
  }

  return [];
}

export async function handleSessionsRequest(
  req: IncomingMessage,
  res: ServerResponse,
  ctx?: Context
): Promise<boolean> {
  const url = req.url || '';
  const pathname = url.split('?')[0];

  if (pathname === '/mobile/api/sessions' && req.method === 'GET') {
    try {
      const sessions = await getSessions(ctx);
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-cache'
      });
      res.end(JSON.stringify({ sessions }));
    } catch (err) {
      console.error('[dsh-remote-bridge] Error in handleSessionsRequest:', err);
      const fallbackSessions = listSessionsFromDisk();
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-cache'
      });
      res.end(JSON.stringify({ sessions: fallbackSessions }));
    }
    return true;
  }
  return false;
}
