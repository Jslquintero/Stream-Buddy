import path from 'node:path';
import { createImageAssets } from '../banners/assets.js';

export function socialAssets(dataDir) {
  return createImageAssets(path.join(dataDir, 'social-assets'), '/social-assets');
}
