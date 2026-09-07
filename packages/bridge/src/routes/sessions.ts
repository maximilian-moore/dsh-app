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
    // @ts-expect-error Cordis context may carry sessionQuery
    const sessionQuery = ctx?.sessionQuery || (ctx as any)?.get?.('sessionQuery');

    if (sessionQuery && typeof sessionQuery.listSessions === 'function') {
      try {
        const records = await sessionQuery.listSessions();
        if (Array.isArray(records) && records.length > 0) {
          const summaries: SessionSummary[] = [];

          for (const record of records) {
            try {
              const header = record?.header || record;
              const id = header?.id || (typeof record === 'string' ? record : '');
              if (!id) continue;

              let title = '';
              try {
                if (typeof sessionQuery.readTitle === 'function') {
                  const titleSnapshot = await sessionQuery.readTitle(id);
                  if (titleSnapshot?.title) {
                    title = titleSnapshot.title;
                  }
                }
              } catch {
                // Ignore title read failure
              }

              const cwd = header?.cwd || '';
              const wsName = cwd ? basename(cwd) : 'Default';
              if (!title) {
                const shortId = id.replace('session-', '').slice(0, 8);
                title = `Session (${shortId})`;
              }

              summaries.push({
                id,
                title,
                cwd,
                workspaceName: wsName,
                createdAt: header?.createdAt || Date.now(),
                live: !!record?.live
              });
            } catch {
              // Ignore single record format issue
            }
          }

          if (summaries.length > 0) {
            summaries.sort((a, b) => b.createdAt - a.createdAt);
            return summaries;
          }
        }
      } catch (innerErr) {
        console.warn('[dsh-remote-bridge] sessionQuery.listSessions failed, falling back to disk:', innerErr);
      }
    }
  } catch (err) {
    console.warn('[dsh-remote-bridge] getSessions error:', err);
  }

  return listSessionsFromDisk();
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
