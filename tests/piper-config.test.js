import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { legacyPiperConfig, preparePiperConfig } from '../backend/modules/piper-config.js';

const sample = () => ({ num_symbols: 256, num_speakers: 1, audio: { sample_rate: 22050 }, phoneme_id_map: { a: [14], 'ɪ': [74], 'aɪ': [161], '😀': [200] }, vowel_clusters: [['a', 'ɪ']] });
test('legacy CLI adaptation keeps constituent IDs and Unicode codepoints without mutating source', () => {
  const source = sample(), before = structuredClone(source);
  const result = legacyPiperConfig(source);
  assert.equal(result.adapted, true); assert.equal(result.config.num_symbols, 256);
  assert.equal(Object.hasOwn(result.config.phoneme_id_map, 'aɪ'), false);
  assert.deepEqual(result.config.phoneme_id_map.a, [14]);
  assert.deepEqual(result.config.phoneme_id_map['ɪ'], [74]);
  assert.deepEqual(result.config.phoneme_id_map['😀'], [200]);
  assert.deepEqual(source, before);
});
test('ordinary models pass through unchanged; undeclared and unrepresentable clusters fail explicitly', () => {
  const ordinary = { phoneme_id_map: { a: [1], 'ɪ': [2] } };
  assert.equal(legacyPiperConfig(ordinary).config, ordinary);
  assert.equal(legacyPiperConfig(ordinary).adapted, false);
  assert.throws(() => legacyPiperConfig({ ...sample(), vowel_clusters: [] }), /incompatible/);
  const missing = sample(); delete missing.phoneme_id_map['ɪ'];
  assert.throws(() => legacyPiperConfig(missing), /incompatible/);
});
test('runtime sidecar is cached in data directory and original companion is preserved byte for byte', t => {
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'scratch-' + randomUUID());
  fs.mkdirSync(dir);
  t.after(() => { for (const file of fs.readdirSync(dir)) fs.unlinkSync(path.join(dir, file)); fs.rmdirSync(dir); });
  const model = path.join(dir, 'voice.onnx'), original = JSON.stringify(sample());
  fs.writeFileSync(model + '.json', original);
  const prepared = preparePiperConfig(model, dir);
  assert.equal(prepared.adapted, true); assert.notEqual(prepared.path, model + '.json');
  assert.equal(fs.readFileSync(model + '.json', 'utf8'), original);
  assert.equal(preparePiperConfig(model, dir).path, prepared.path);
  assert.equal(Object.keys(JSON.parse(fs.readFileSync(prepared.path)).phoneme_id_map).every(key => [...key].length === 1), true);
});
