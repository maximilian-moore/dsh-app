import type { IncomingMessage, ServerResponse } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

export interface ModelOption {
  id: string;
  name: string;
  provider: string;
  isDefault?: boolean;
}

export function getAvailableModels(): { defaultModel: string; models: ModelOption[] } {
  const settingsPath = join(homedir(), '.dsh/settings.yaml');
  const fallback = {
    defaultModel: 'deepseek-v4-flash',
    models: [
      { id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash', provider: 'deepseek-official', isDefault: true },
      { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro', provider: 'deepseek-official' },
      { id: 'deepseek-v4-flash-vision-exp', name: 'DeepSeek V4 Vision', provider: 'deepseek-official' }
    ]
  };

  if (!existsSync(settingsPath)) {
    return fallback;
  }

  try {
    const content = readFileSync(settingsPath, 'utf8');
    const models: ModelOption[] = [];
    let defaultModel = 'deepseek-v4-flash';

    // Parse default model
    const defaultMatch = content.match(/agent-default-model:[\s\S]*?model:\s*([^\s\n]+)/);
    if (defaultMatch && defaultMatch[1]) {
      defaultModel = defaultMatch[1];
    }

    // Default DeepSeek models
    models.push({ id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash', provider: 'deepseek-official' });
    models.push({ id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro', provider: 'deepseek-official' });
    models.push({ id: 'deepseek-v4-flash-vision-exp', name: 'DeepSeek V4 Vision', provider: 'deepseek-official' });

    // Local LMS models
    const lmsMatches = [...content.matchAll(/- id:\s*([^\s\n]+)[\s\S]*?name:\s*([^\n\r]+)/g)];
    for (const match of lmsMatches) {
      const id = match[1];
      const name = match[2].trim();
      if (id && !models.some(m => m.id === id)) {
        models.push({ id, name, provider: 'local-lms' });
      }
    }

    return {
      defaultModel,
      models: models.map(m => ({ ...m, isDefault: m.id === defaultModel }))
    };
  } catch {
    return fallback;
  }
}

export function handleModelsRequest(req: IncomingMessage, res: ServerResponse): boolean {
  const url = req.url || '';
  const pathname = url.split('?')[0];

  if (pathname === '/mobile/api/models' && req.method === 'GET') {
    const data = getAvailableModels();
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-cache'
    });
    res.end(JSON.stringify(data));
    return true;
  }
  return false;
}
