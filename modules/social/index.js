import fs from 'node:fs';
import path from 'node:path';
import { defaultSocial, migrateSocial, validateSocial, socialOutputPath } from './config.js';

export function createSocialModule({ dataDir, changed, log } = {}) {
  const file = path.join(dataDir, 'social.json');
  let config = structuredClone(defaultSocial), revision = Date.now(), error = '';

  function read(target) {
    const data = JSON.parse(fs.readFileSync(target, 'utf8').replace(/^\uFEFF/, ''));
    config = validateSocial(migrateSocial(data));
  }

  try {
    read(file);
  } catch (e) {
    if (e.code !== 'ENOENT') error = 'No se pudo cargar Social Media Rotator: ' + e.message;
  }

  function persist(value) {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(file + '.tmp', JSON.stringify(value, null, 2));
    fs.renameSync(file + '.tmp', file);
  }

  return {
    state() {
      return { available: true, running: true, config, revision, error, url: socialOutputPath };
    },
    health: async () => {},
    start: async () => changed?.(),
    save(value) {
      const next = validateSocial(value);
      try {
        persist(next);
      } catch (e) {
        error = 'No se pudo guardar Social Media Rotator: ' + e.message;
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
