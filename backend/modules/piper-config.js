import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

// The Windows C++ CLI consumes individual Unicode codepoints, whereas recent
// voice configs can also declare vowel clusters for newer Python engines.
export function legacyPiperConfig(config) {
  const map = config.phoneme_id_map || {};
  const compound = Object.keys(map).filter(key => [...key].length !== 1);
  if (!compound.length) return { config, adapted: false };
  const clusters = new Set((config.vowel_clusters || []).map(parts => parts.join('')));
  for (const key of compound) {
    if (!key || !clusters.has(key) || [...key].some(part => !Object.hasOwn(map, part))) {
      throw new Error(`Este modelo contiene un fonema incompatible con Piper Windows: ${key}. Necesita un motor con soporte para fonemas compuestos.`);
    }
  }
  const compatible = structuredClone(config);
  for (const key of compound) delete compatible.phoneme_id_map[key];
  delete compatible.vowel_clusters;
  return { config: compatible, adapted: true };
}

export function preparePiperConfig(model, dataDir) {
  const source = fs.readFileSync(model + '.json', 'utf8').replace(/^\uFEFF/, '');
  const { config, adapted } = legacyPiperConfig(JSON.parse(source));
  if (!adapted) return { path: model + '.json', adapted: false };
  const content = JSON.stringify(config);
  const key = createHash('sha256').update(content).digest('hex').slice(0, 16);
  const file = path.join(dataDir, `piper-config-${key}.json`);
  if (!fs.existsSync(file)) fs.writeFileSync(file, content, 'utf8');
  return { path: file, adapted: true };
}
