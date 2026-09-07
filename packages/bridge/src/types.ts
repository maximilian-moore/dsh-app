import type { IncomingMessage, ServerResponse } from 'node:http';

export interface BridgeConfig {
  allowedWorkspaceRoots?: string[];
  vapidKeysPath?: string;
  clientDistPath?: string;
  cookieMaxAgeDays?: number;
}

export interface WebRoute {
  kind: 'exact' | 'prefix';
  path: string;
  handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>;
}

export interface WebServerService {
  host: '127.0.0.1' | '0.0.0.0';
  port: number;
  register(route: WebRoute): () => void;
}
