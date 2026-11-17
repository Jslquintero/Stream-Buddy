import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EventEmitter } from 'node:events';
import { defaults, SettingsStore, validateSettings } from '../backend/settings.js';
import { TTSModule, filterText } from '../backend/modules/tts.js';
import { LocalToolModule } from '../backend/modules/local-tool.js';
import { ProcessManager } from '../backend/processes.js';
import { Center } from '../backend/center.js';
import { createDashboardServer } from '../backend/http.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function scratch(t) {
  const dir = path.join(root, 'tests', `scratch-${crypto.randomUUID()}`);
  fs.mkdirSync(dir);
  t.after(() => {
    // Only known flat test files are removed; never recurse over user data.
    for (const file of fs.readdirSync(dir)) fs.unlinkSync(path.join(dir, file));
    fs.rmdirSync(dir);
  });
  return dir;
}
class FakeProcesses {
  constructor() { this.children = new Set(); this.starts = []; }
  start(command, args, onLine) {
    const child = new EventEmitter(); child.onLine = onLine;
    this.children.add(child); this.starts.push({ command, args, child }); return child;
  }
  async stop(child) { if (child) { this.children.delete(child); child.emit('close', 0); } }
  async close() { for (const child of this.children) await this.stop(child); }
}
function ttsFixture(t, config = {}) {
  const dataDir = scratch(t), settings = new SettingsStore(dataDir);
  settings.save({ ...defaults, Cooldown: 0, ...config });
  const processes = new FakeProcesses();
  const module = new TTSModule({ root, dataDir, settings, processes, log() {}, changed() {} });
  return { module, settings, processes };
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('filters preserve named command boundaries, symbols, blocked words and links', () => {
  const s = { ...defaults, Command: '!tts', Blocked: ['spam'] };
  for (const text of ['!ttss hola', '!tts ', '!tts www.test.com', '!tts SPAM']) assert.equal(filterText(text, s), null);
  assert.equal(filterText('!TTS hola', s), 'hola');
  assert.equal(filterText('!hola', { ...s, Command: '!' }), 'hola');
  assert.equal(filterText('hola', { ...s, ReadAll: true }), 'hola');
});
test('settings reject invalid ranges, missing Piper files, booleans and noninteger cooldowns', () => {
  for (const value of [{ Speed: NaN }, { Volume: 101 }, { Volume: true }, { Cooldown: .5 }, { ReadAll: 'true' }, { Engine: 'Piper' }, { Blocked: [1] }]) {
    assert.throws(() => validateSettings({ ...defaults, ...value }));
  }
});
test('existing UTF-8 BOM configuration is loaded without rewriting; saves are atomic', t => {
  const dir = scratch(t), file = path.join(dir, 'tts.json');
  const original = '\uFEFF' + JSON.stringify({ ...defaults, Username: 'usuario', Engine: 'Piper', Model: 'missing', PiperExe: 'missing' });
  fs.writeFileSync(file, original);
  const settings = new SettingsStore(dir);
  assert.equal(settings.read().Username, 'usuario');
  assert.equal(fs.readFileSync(file, 'utf8'), original);
  settings.save({ ...settings.read(), Engine: 'Windows', Volume: 55 });
  assert.equal(new SettingsStore(dir).read().Volume, 55);
  assert.equal(fs.existsSync(file + '.tmp'), false);
});
test('cooldowns and maximum queue length are enforced', t => {
  const { module, settings } = ttsFixture(t, { Cooldown: 5 }); module.paused = true;
  module.enqueue('same', '!hola'); assert.match(module.enqueue('same', '!otra'), /Espera/);
  settings.save({ ...settings.read(), Cooldown: 0 });
  for (let i = 0; i < 49; i++) module.enqueue(String(i), '!hola');
  assert.equal(module.queue.length, 50); assert.match(module.enqueue('extra', '!hola'), /llena/);
});
test('speech is serial, pause holds queued messages and skip starts the next job', async t => {
  const { module, processes } = ttsFixture(t); module.paused = true;
  module.enqueue('1', '!primero'); module.enqueue('2', '!segundo');
  await tick(); assert.equal(processes.starts.length, 0);
  module.pause(); assert.equal(processes.starts.length, 1); assert.equal(module.queue.length, 1);
  await module.stop(false); await tick();
  assert.equal(processes.starts.length, 2); assert.equal(module.queue.length, 0);
  await module.close();
});
test('stop clears queued messages and prevents an unintended next speech', async t => {
  const { module, processes } = ttsFixture(t);
  module.enqueue('1', '!primero'); module.enqueue('2', '!segundo'); await tick();
  await module.stop(true); await tick();
  assert.equal(processes.starts.length, 1); assert.equal(module.queue.length, 0); assert.equal(module.speaker, null);
});
test('connector forwards chat to the queue and resets state after exit', async t => {
  const { module, processes } = ttsFixture(t, { Username: 'test' }); module.paused = true;
  module.connectorPython = () => 'fake-python';
  module.connect(); const child = processes.starts[0].child;
  child.onLine(JSON.stringify({ kind: 'status', text: 'Conectado al directo @test' }));
  child.onLine(JSON.stringify({ kind: 'comment', user: 'u', text: '!hola' }));
  assert.equal(module.connected, true); assert.equal(module.queue.length, 1);
  assert.throws(() => module.connect(), /activa/);
  await module.disconnect(); assert.equal(module.connected, false); assert.equal(module.bridge, null);
});
test('tool reuses external instances and never takes ownership of them', async () => {
  const processes = new FakeProcesses();
  const tool = new LocalToolModule({ id: 'test', name: 'Test', url: 'http://127.0.0.1:1', requiredFile: root, processes, changed() {}, log() {} });
  tool.health = async () => { tool.running = true; return true; };
  await Promise.all([tool.start(), tool.start()]);
  assert.equal(processes.starts.length, 0); assert.equal(tool.state().managed, false);
  await tool.close();
});
test('missing tools fail before spawning a process', async () => {
  const processes = new FakeProcesses();
  const tool = new LocalToolModule({ name: 'Missing', url: 'http://127.0.0.1:1', requiredFile: path.join(root, 'not-present.exe'), processes, changed() {}, log() {} });
  tool.health = async () => false;
  await assert.rejects(tool.start(), /No se encuentra/); assert.equal(processes.starts.length, 0);
});
test('process manager reports spawn failures and cleans its registry', async () => {
  const logs = [], processes = new ProcessManager(text => logs.push(text));
  await assert.rejects(processes.run(path.join(root, 'missing-program.exe'), []));
  await tick(); await tick();
  assert.ok(logs.length); await processes.close();
});
test('HTTP serves dashboard, validates origin/token, persists settings and streams updates', async t => {
  const dataDir = scratch(t), processes = new FakeProcesses();
  const tools = Object.fromEntries(['layout', 'ads'].map(id => [id, { state: () => ({ running: false, available: true }), health: async () => false, start: async () => {} }]));
  const center = new Center({ root, dataDir, processes, tools, legacyFile: path.join(dataDir, 'absent') });
  const dashboard = createDashboardServer(center);
  await new Promise(resolve => dashboard.server.listen(0, '127.0.0.1', resolve));
  t.after(() => dashboard.close());
  const base = `http://127.0.0.1:${dashboard.server.address().port}`;
  assert.match(await (await fetch(base)).text(), /LIVE STUDIO/);
  const state = await (await fetch(base + '/api/state')).json(); assert.equal(state.backend, 'node');
  const post = (action, body, headers = {}) => fetch(base + '/api/' + action, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  assert.equal((await post('settings', defaults)).status, 403);
  assert.equal((await post('settings', defaults, { 'X-Studio': state.token, Origin: 'https://example.com' })).status, 403);
  assert.equal((await post('settings', { ...defaults, Volume: 101 }, { 'X-Studio': state.token })).status, 400);
  assert.equal((await post('settings', { ...defaults, Volume: 33 }, { 'X-Studio': state.token })).status, 200);
  assert.equal(center.settings.read().Volume, 33);
  assert.equal((await post('start', { tool: 'unknown' }, { 'X-Studio': state.token })).status, 400);
  const controller = new AbortController();
  const stream = await fetch(base + '/api/events', { signal: controller.signal });
  assert.match(stream.headers.get('content-type'), /event-stream/);
  const reader = stream.body.getReader();
  const initial = new TextDecoder().decode((await reader.read()).value); assert.match(initial, /"Volume":33/);
  center.log('evento de prueba');
  const update = await Promise.race([reader.read(), new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('SSE no respondió')), 3000); timer.unref(); })]);
  assert.match(new TextDecoder().decode(update.value), /evento de prueba/);
  controller.abort(); await reader.cancel().catch(() => {});
});
