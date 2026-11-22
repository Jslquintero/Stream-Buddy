import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
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
  const legacy = Object.fromEntries(Object.entries(defaults).filter(([key]) => !['Enabled', 'AudioDevice', 'MaxQueue', 'BlockLinks', 'BlockedUsers', 'PocketVoice'].includes(key)));
  const value = validateSettings({ ...legacy, Speed: .9 });
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
test('legacy Piper settings migrate without requiring an old executable or model', () => {
  const migrated = validateSettings({ Engine: 'Piper', Model: 'missing', PiperExe: 'missing', Speaker: 3, Volume: 42, AudioDevice: 'device' });
  assert.equal(migrated.Engine, 'PocketTTS');
  assert.equal(migrated.PocketVoice, 'lola');
  assert.equal(migrated.Volume, 42);
  assert.equal(migrated.AudioDevice, 'device');
  assert.ok(!Object.hasOwn(migrated, 'PiperExe'));
});

test('speech jobs send the selected Pocket voice and managed executable', t => {
  const { root, module, resources, calls } = fixture(t);
  const executable = path.join(resources.pocketDirectory, 'pocket-tts.exe');
  fs.mkdirSync(resources.pocketDirectory, { recursive: true });
  fs.writeFileSync(executable, 'fixture');
  module.preview('Hola', { ...defaults, Engine: 'PocketTTS', PocketVoice: 'alba' });
  assert.equal(calls.length, 1);
  const job = JSON.parse(fs.readFileSync(path.join(root, 'data', 'speech.json'), 'utf8'));
  assert.equal(job.PocketVoice, 'alba');
  assert.equal(job.PocketExe, executable);
});

test('resource detection returns Windows voice and audio identifiers', async t => {
  const { resources } = fixture(t);
  await resources.refresh();
  assert.equal(resources.voices[0].id, 'voice-id');
  assert.equal(resources.devices[0].id, 'audio-id');
  assert.equal(resources.task.running, false);
});

test('resource task failure is reported and releases busy state for retry', async t => {
  const { resources } = fixture(t);
  resources.jsonScript = async () => { throw new Error('SAPI no disponible'); };
  await resources.refresh();
  assert.equal(resources.task.running, false);
  assert.match(resources.error, /SAPI/);
  resources.jsonScript = async () => ({ voices: [], devices: [], warnings: ['Sin dispositivo activo'] });
  await resources.refresh();
  assert.equal(resources.task.running, false);
  assert.match(resources.error, /Sin dispositivo/);
});

test('Pocket preparation activates the engine after verifying the selected voice', async t => {
  const { resources, settings, processes } = fixture(t);
  settings.save({ ...settings.read(), PocketVoice: 'alba', Volume: 63 });
  let runs = 0;
  processes.run = async (_command, args, line) => {
    assert.equal(path.basename(args[args.indexOf('-File') + 1]), 'install-pocket.ps1');
    assert.equal(args[args.indexOf('-Voice') + 1], 'alba');
    const staging = args[args.indexOf('-Staging') + 1];
    if (++runs === 1) {
      line('download');
      fs.writeFileSync(path.join(staging, 'pocket-tts.exe'), 'test');
      fs.writeFileSync(path.join(staging, 'LICENSE'), 'license');
    }
    line('model');
  };
  await resources.installPocket();
  assert.equal(resources.error, null);
  assert.equal(resources.state().pocketInstalled, true);
  assert.equal(settings.read().Engine, 'PocketTTS');
  assert.equal(settings.read().PocketVoice, 'alba');
  assert.equal(settings.read().Volume, 63);
  assert.equal(resources.configured.Engine, 'PocketTTS');
  await resources.installPocket();
  assert.equal(resources.error, null);
  assert.equal(runs, 2);
  assert.deepEqual(fs.readdirSync(path.dirname(resources.pocketDirectory)), ['pocket-tts']);
});

test('a failed Pocket preparation reports the error and cleans unpublished files', async t => {
  const { resources, settings, processes } = fixture(t);
  processes.run = async (_command, args, line) => {
    const staging = args[args.indexOf('-Staging') + 1];
    fs.writeFileSync(path.join(staging, 'pocket-tts.exe'), 'test');
    line('error:Descarga interrumpida');
    throw new Error('Exit code 1');
  };
  await resources.installPocket();
  assert.equal(resources.task.running, false);
  assert.match(resources.error, /interrumpida/);
  assert.equal(resources.state().pocketInstalled, false);
  assert.equal(settings.read().Engine, 'Windows');
  assert.deepEqual(fs.readdirSync(path.dirname(resources.pocketDirectory)), []);
});
