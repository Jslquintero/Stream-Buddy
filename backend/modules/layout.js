import path from 'node:path';
import { LocalToolModule } from './local-tool.js';
export function createLayoutModule(context) {
  const script = path.resolve(context.root, '..', 'layout', 'xp-studio', 'server.ps1');
  return new LocalToolModule({ ...context, id: 'layout', name: 'Layout Studio', url: 'http://localhost:8787', command: 'powershell.exe', args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, '-NoBrowser'], requiredFile: script });
}
