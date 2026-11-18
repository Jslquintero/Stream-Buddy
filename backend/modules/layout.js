import fs from 'node:fs';
import path from 'node:path';
import { defaultLayout, validateLayout } from '../../shared/layout.js';
import { layoutOutputPath } from '../../shared/layout-url.js';
export function createLayoutModule({ dataDir, changed, log }) {
  const file = path.join(dataDir, 'layout.json');
  let document = structuredClone(defaultLayout), error = '';
  let revision = Date.now();
  try { document = validateLayout(JSON.parse(fs.readFileSync(file, 'utf8'))); }
  catch (e) { if (e.code !== 'ENOENT') error = 'No se pudo cargar layout.json: ' + e.message; }
  return {
    state: () => ({ available: true, running: true, url: layoutOutputPath, document, error, revision }),
    health: async () => {}, start: async () => { changed(); },
    save(input) {
      const next = validateLayout(input);
      fs.mkdirSync(dataDir, { recursive: true });
      fs.writeFileSync(file + '.tmp', JSON.stringify(next, null, 2), 'utf8');
      fs.renameSync(file + '.tmp', file);
      document = next; revision=Math.max(Date.now(),revision+1); error = ''; changed();
    },
  };
}
