import fs from 'node:fs';
import path from 'node:path';
import { defaultBanners, migrateBanners, validateBanners, bannersOutputPath } from './config.js';
import { bannerAssets } from './assets.js';

export function createBannersModule({ dataDir, changed, log } = {}) {
  const file = path.join(dataDir, 'banners.json');
  const assets = bannerAssets(dataDir);
  let config = structuredClone(defaultBanners), revision = Date.now(), error = '';

  function read(target) {
    const data = JSON.parse(fs.readFileSync(target, 'utf8').replace(/^\uFEFF/, ''));
    config = validateBanners(migrateBanners(data));
  }

  try {
    read(file);
  } catch (e) {
    if (e.code !== 'ENOENT') error = 'No se pudo cargar Ad Banner Rotator: ' + e.message;
  }

  function persist(value) {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(file + '.tmp', JSON.stringify(value, null, 2));
    fs.renameSync(file + '.tmp', file);
  }

  return {
    assets,
    state() {
      return { available: true, running: true, config, revision, error, url: bannersOutputPath };
    },
    health: async () => {},
    start: async () => changed?.(),
    save(value) {
      const next = validateBanners(value);
      try {
        persist(next);
      } catch (e) {
        error = 'No se pudo guardar Ad Banner Rotator: ' + e.message;
        log?.(error);
        throw new Error(error);
      }
      config = next;
      revision = Math.max(Date.now(), revision + 1);
      error = '';
      changed?.();
    },
    close() {},
  };
}
