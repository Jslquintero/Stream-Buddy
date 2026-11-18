import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { defaults, SettingsStore, validateSettings } from '../backend/settings.js';
import { TTSModule, filterText } from '../backend/modules/tts.js';
import { TTSResources } from '../backend/modules/tts-resources.js';

const testsDir = path.dirname(fileURLToPath(import.meta.url));
function fixture(t) {
  const root = path.join(testsDir, 'scratch-' + randomUUID());
  fs.mkdirSync(path.join(root, 'modules', 'tts'), { recursive: true });
  t.after(() => {
    const target = path.resolve(root);
    assert.ok(target.startsWith(path.resolve(testsDir) + path.sep) && path.basename(target).startsWith('scratch-'));
    fs.rmSync(target, { recursive: true, force: true });
  });
  const settings = new SettingsStore(path.join(root, 'data'));
  const calls = [], processes = {
    run: async (_command, _args, line) => { if (line) line(JSON.stringify({ voices: [{ id: 'voice-id', name: 'Voz de prueba' }], devices: [{ id: 'audio-id', name: 'Audio de prueba' }] })); },
    start: (command, args) => { const child = new EventEmitter(); calls.push({ command, args, child }); return child; },
    stop: async child => { child?.emit('close', 0); }
  };
  const context = { root, dataDir: path.join(root, 'data'), settings, processes, log() {}, changed() {} };
  return { ...context, calls, resources: new TTSResources(context), module: new TTSModule(context) };
}

test('legacy settings gain new TTS defaults without changing existing values', () => {
  const legacy = Object.fromEntries(Object.entries(defaults).filter(([key]) => !['Enabled', 'AudioDevice', 'MaxQueue', 'BlockLinks', 'BlockedUsers'].includes(key)));
  const value = validateSettings({ ...legacy, Speed: .9 }, false);
  assert.equal(value.MaxQueue, 50); assert.equal(value.Enabled, true); assert.equal(value.Speed, .9);
  assert.throws(() => validateSettings({ ...defaults, MaxQueue: 0 }));
  assert.throws(() => validateSettings({ ...defaults, BlockedUsers: [1] }));
});
test('new reading controls disable chat, block users and allow configurable links', async t => {
  const { module, settings } = fixture(t); module.paused = true;
  settings.save({ ...defaults, Enabled: false }); assert.match(module.enqueue('u', '!hola'), /desactivado/);
  settings.save({ ...defaults, BlockedUsers: ['@BLOCKED'] }); assert.match(module.enqueue('blocked', '!hola'), /Ignorado/);
  assert.equal(filterText('!https://example.com', { ...defaults, BlockLinks: false }), 'https://example.com');
  assert.equal(module.queue.length, 0);
});
test('preview bypasses chat filters and cooldowns, uses unsaved settings, and stays removable', t => {
  const { module, settings } = fixture(t); module.paused = true;
  const s = { ...defaults, Enabled: false, Blocked: ['hola'], Volume: 24 };
  module.preview('hola sin comando', s);
  assert.equal(module.queue[0].Volume, 24); assert.equal(module.queue[0].preview, true);
  assert.equal(settings.read().Volume, 80);
  const id = module.state().items[0].id;
  module.remove(id); assert.equal(module.queue.length, 0);
  assert.throws(() => module.remove(id), /ya no/);
});
test('queue cap can be configured independently of character cap', t => {
  const { module, settings } = fixture(t); module.paused = true;
  settings.save({ ...defaults, MaxQueue: 1, Cooldown: 0 });
  module.enqueue('a', '!hola'); assert.match(module.enqueue('b', '!hola'), /llena \(1/);
});
test('Piper validates speaker selection against the companion model configuration', t => {
  const { root } = fixture(t), model = path.join(root, 'voice.onnx'), exe = path.join(root, 'piper.exe');
  fs.writeFileSync(model, 'model'); fs.writeFileSync(exe, 'fixture');
  fs.writeFileSync(model + '.json', JSON.stringify({ num_speakers: 2 }));
  const s = { ...defaults, Engine: 'Piper', Model: model, PiperExe: exe, Speaker: 1 };
  assert.equal(validateSettings(s).Speaker, 1);
  assert.throws(() => validateSettings({ ...s, Speaker: 2 }), /hablante/);
});
test('speech jobs pass the compatible config to the Windows adapter', t => {
  const { root, module, calls } = fixture(t), model = path.join(root, 'voice.onnx'), exe = path.join(root, 'piper.exe');
  fs.writeFileSync(model, 'model'); fs.writeFileSync(exe, 'fixture');
  const config = JSON.stringify({ num_speakers: 1, phoneme_id_map: { a: [14], 'ɪ': [74], 'aɪ': [161] }, vowel_clusters: [['a', 'ɪ']] });
  fs.writeFileSync(model + '.json', config);
  module.preview('Hola', { ...defaults, Engine: 'Piper', Model: model, PiperExe: exe });
  assert.equal(calls.length, 1);
  const job = JSON.parse(fs.readFileSync(path.join(root, 'data', 'speech.json'), 'utf8'));
  assert.notEqual(job.PiperConfig, model + '.json');
  assert.equal(Object.hasOwn(JSON.parse(fs.readFileSync(job.PiperConfig)).phoneme_id_map, 'aɪ'), false);
  assert.equal(fs.readFileSync(model + '.json', 'utf8'), config);
});
test('resource detection returns voice and audio identifiers and scans complete models only', async t => {
  const { root, resources } = fixture(t), folder = path.join(root, 'modules', 'tts', 'voices');
  fs.mkdirSync(folder); fs.writeFileSync(path.join(folder, 'complete.onnx'), 'model'); fs.writeFileSync(path.join(folder, 'complete.onnx.json'), '{}'); fs.writeFileSync(path.join(folder, 'partial.onnx'), 'incomplete');
  await resources.refresh();
  assert.equal(resources.voices[0].id, 'voice-id'); assert.equal(resources.devices[0].id, 'audio-id');
  assert.equal(resources.models.length, 1); assert.equal(resources.models[0].name, 'complete');
  assert.equal(resources.task.running, false);
});
test('cancelled native file selection leaves settings and resources unchanged', async t => {
  const { resources, settings } = fixture(t);
  resources.jsonScript = async () => ({ path: '' });
  await resources.pick('model');
  assert.equal(resources.picked, null); assert.equal(settings.read().Model, '');
  assert.throws(() => resources.pick('other'), /inválido/);
});
test('local model import requires its companion JSON and copies into managed storage', async t => {
  const { root, resources, settings } = fixture(t), file = path.join(root, 'test.onnx');
  fs.writeFileSync(file, 'model');
  resources.jsonScript = async () => ({ path: file });
  await resources.pick('model'); assert.match(resources.error, /onnx.json/);
  fs.writeFileSync(file + '.json', '{}');
  await resources.pick('model');
  assert.equal(resources.models.length, 1); assert.equal(resources.models[0].managed, true);
  assert.notEqual(resources.picked.path, file); assert.equal(settings.read().Model, '');
});
function voicePayload() {
  const id = 'es_MX-test-medium';
  const files = { [`es/es_MX/test/medium/${id}.onnx`]: 'test-model', [`es/es_MX/test/medium/${id}.onnx.json`]: '{}', 'es/es_MX/test/medium/MODEL_CARD': 'license test' };
  const metadata = Object.fromEntries(Object.entries(files).map(([name, content]) => [name, { size_bytes: Buffer.byteLength(content), md5_digest: createHash('md5').update(content).digest('hex') }]));
  return { id, files, voice: { name: 'test', quality: 'medium', language: { code: 'es_MX', name_native: 'Español' }, files: metadata } };
}
test('catalog downloads verify size/hash and publish complete model with license', async t => {
  const { resources } = fixture(t), { id, files, voice } = voicePayload();
  t.mock.method(globalThis, 'fetch', async url => new Response(url.endsWith('voices.json') ? JSON.stringify({ [id]: voice }) : files[decodeURI(url.split('/resolve/main/')[1])], { status: 200 }));
  await resources.loadCatalog(); assert.equal(resources.catalog[0].language, 'es_MX');
  await resources.downloadVoice(id);
  assert.equal(resources.error, null); assert.equal(resources.models.length, 1);
  assert.equal(fs.readFileSync(resources.models[0].path, 'utf8'), 'test-model');
  assert.ok(fs.existsSync(resources.models[0].path.replace('.onnx', '.MODEL_CARD.txt')));
});
test('a damaged download leaves no partial files or selectable models', async t => {
  const { root, resources } = fixture(t), { id, voice } = voicePayload();
  resources.catalogData = { [id]: voice };
  t.mock.method(globalThis, 'fetch', async () => new Response('wrong'));
  await resources.downloadVoice(id);
  assert.match(resources.error, /coincide/); assert.equal(resources.models.length, 0);
  assert.deepEqual(fs.readdirSync(path.join(root, 'modules', 'tts', 'voices')), []);
});
test('resource task failure is reported and releases busy state for retry', async t => {
  const { resources } = fixture(t);
  resources.jsonScript = async () => { throw new Error('SAPI no disponible'); };
  await resources.refresh(); assert.equal(resources.task.running, false); assert.match(resources.error, /SAPI/);
  resources.jsonScript = async () => ({ voices: [], devices: [], warnings: ['Sin dispositivo activo'] });
  await resources.refresh(); assert.equal(resources.task.running, false); assert.match(resources.error, /Sin dispositivo/);
});

test('Piper setup installs locally, downloads every voice, persists selection and resumes verified files', async t => {
  const { resources, settings, processes } = fixture(t);
  const first = voicePayload();
  const second = JSON.parse(JSON.stringify(first).replaceAll(first.id, 'en_US-test-medium'));
  second.voice.language.code = 'en_US';
  const catalog = { [first.id]: first.voice, [second.id]: second.voice };
  const files = { ...first.files, ...second.files };
  let installs = 0, downloads = 0;
  processes.run = async (_command, args) => {
    installs++;
    const folder = path.join(args.at(-1), 'piper');
    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(folder, 'piper.exe'), 'test');
  };
  t.mock.method(globalThis, 'fetch', async url => {
    if (url.endsWith('voices.json')) return new Response(JSON.stringify(catalog));
    downloads++;
    return new Response(files[url.split('/resolve/main/')[1]]);
  });
  await resources.installPiper();
  assert.equal(resources.error, null);
  assert.equal(installs, 1);
  assert.equal(resources.models.length, 2);
  assert.equal(settings.read().Engine, 'Piper');
  assert.equal(settings.read().PiperExe, path.join(resources.directory, 'tools', 'piper', 'piper.exe'));
  assert.equal(path.basename(settings.read().Model), first.id + '.onnx');
  assert.equal(resources.configured.Model, settings.read().Model);
  const previous = downloads;
  await resources.installPiper();
  assert.equal(resources.error, null);
  assert.equal(installs, 1);
  assert.equal(downloads, previous);
  fs.writeFileSync(settings.read().Model, 'bad-model!');
  await resources.installPiper();
  assert.equal(resources.error, null);
  assert.equal(downloads, previous + 1);
  const english = resources.models.find(model => model.name === second.id);
  fs.unlinkSync(english.path);
  await resources.installPiper('es');
  assert.equal(resources.error, null);
  assert.equal(downloads, previous + 1, 'Spanish setup must not download missing English voices');
  assert.equal(path.basename(settings.read().Model), first.id + '.onnx');
  await resources.installPiper('en');
  assert.equal(resources.error, null);
  assert.equal(downloads, previous + 2);
  assert.equal(path.basename(settings.read().Model), second.id + '.onnx');
  await resources.installPiper('zz');
  assert.match(resources.error, /idioma seleccionado/);
  assert.throws(() => resources.installPiper('../bad'), /idioma/);
});

test('failed Piper setup reports error and never selects a missing executable', async t => {
  const { resources, settings, processes } = fixture(t);
  processes.run = async () => { throw new Error('Descarga interrumpida'); };
  await resources.installPiper();
  assert.equal(resources.task.running, false);
  assert.match(resources.error, /interrumpida/);
  assert.equal(settings.read().PiperExe, '');
  assert.equal(settings.read().Engine, 'Windows');
});
