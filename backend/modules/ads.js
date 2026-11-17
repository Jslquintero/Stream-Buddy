import path from 'node:path';
import { LocalToolModule } from './local-tool.js';
export function createAdsModule(context) {
  const exe = path.resolve(context.root, '..', 'AdQueueWeb', 'dist', 'AdQueueWeb.exe');
  return new LocalToolModule({ ...context, id: 'ads', name: 'AdQueue', url: 'http://127.0.0.1:17843', healthPath: '/api/ping', command: exe, args: ['--no-browser'], requiredFile: exe });
}
