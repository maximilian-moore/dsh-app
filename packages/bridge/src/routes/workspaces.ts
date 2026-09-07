import type { IncomingMessage, ServerResponse } from 'node:http';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import { homedir } from 'node:os';
import type { BridgeConfig } from '../types.js';

export interface WorkspaceItem {
  path: string;
  name: string;
  isCurrent?: boolean;
}

export function listWorkspaces(config?: BridgeConfig): { current: string; workspaces: WorkspaceItem[] } {
  const defaultRoots = config?.allowedWorkspaceRoots || [
    join(homedir(), 'Documents/DevProjects'),
    join(homedir(), 'DevProjects')
  ];

  const currentCwd = process.cwd();
  const workspaces: WorkspaceItem[] = [];
  const seenPaths = new Set<string>();

  // Always include current process cwd
  workspaces.push({
    path: currentCwd,
    name: basename(currentCwd),
    isCurrent: true
  });
  seenPaths.add(currentCwd);

  for (const root of defaultRoots) {
    const resolvedRoot = root.replace(/^~(?=$|\/|\\)/, homedir());
    if (existsSync(resolvedRoot) && statSync(resolvedRoot).isDirectory()) {
      if (!seenPaths.has(resolvedRoot)) {
        workspaces.push({
          path: resolvedRoot,
          name: basename(resolvedRoot),
          isCurrent: resolvedRoot === currentCwd
        });
        seenPaths.add(resolvedRoot);
      }

      try {
        const entries = readdirSync(resolvedRoot);
        for (const entry of entries) {
          if (entry.startsWith('.')) continue;
          const fullPath = join(resolvedRoot, entry);
          try {
            if (statSync(fullPath).isDirectory() && !seenPaths.has(fullPath)) {
              workspaces.push({
                path: fullPath,
                name: entry,
                isCurrent: fullPath === currentCwd
              });
              seenPaths.add(fullPath);
            }
          } catch {
            // Ignore permission or stat errors
          }
        }
      } catch {
        // Ignore directory read error
      }
    }
  }

  return {
    current: currentCwd,
    workspaces
  };
}

export function handleWorkspacesRequest(
  req: IncomingMessage,
  res: ServerResponse,
  config?: BridgeConfig
): boolean {
  const url = req.url || '';
  const pathname = url.split('?')[0];

  if (pathname === '/mobile/api/workspaces' && req.method === 'GET') {
    const data = listWorkspaces(config);
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-cache'
    });
    res.end(JSON.stringify(data));
    return true;
  }
  return false;
}
