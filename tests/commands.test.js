import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { createCommandsModule } from '../modules/commands/index.js';
import { validateCommands } from '../modules/commands/config.js';
import { Center } from '../backend/center.js';

const row = (id, extra = {}) => ({ id, command: '!' + id, enabled: true, image: '', audio: '', text: id, duration: 1, volume: 80, ...extra });
test('help displays enabled descriptions and preserves audio without sending chat messages', async t => {
  const { module, replies } = fixture(t);
  module.save({ enabled: true, commands: [row('a', { description: 'Mi sonido', audio: 'https://example.com/a.mp3' }), row('b', { enabled: false })] });
  module.receive({ kind: 'comment', text: '!a' }); const audio = module.state().audio, visual = module.state().visual;
  assert.equal(module.receive({ kind: 'comment', text: ' !COMANDOS ' }), true);
  assert.deepEqual(module.state().list.help, [{command:'!a',description:'Mi sonido'}]);
  assert.equal(module.state().visual, visual); assert.equal(replies.length,0);
  assert.equal(module.state().audio, audio);
  const list = module.state().list;
  module.receive({ kind: 'comment', text: '!a' }); assert.equal(module.state().list, list);
  module.clear(); assert.equal(module.state().list, null);
  module.save({ enabled: true, commands: [] }); await module.test('!comandos'); assert.deepEqual(module.state().list.help, []);
  module.save({ enabled: false, commands: [] }); assert.equal(module.receive({ kind: 'comment', text: '!comandos' }), false);
});
test('descriptions migrate old settings and reserve the built-in command', () => {
  assert.equal(validateCommands({ enabled: true, commands: [row('a')] }).commands[0].description, '');
  for (const extra of [{ command: '!Comandos' }, { description: 'x'.repeat(101) }, { description: 3 }]) assert.throws(() => validateCommands({ enabled: true, commands: [row('a', extra)] }));
});
function fixture(t) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-commands-'));
  t.after(() => { for (const name of fs.readdirSync(dataDir)) fs.unlinkSync(path.join(dataDir, name)); fs.rmdirSync(dataDir); });
  const replies = [];
  const options = { dataDir, changed() {}, reply: async messages => { replies.push(messages); } };
  const module = createCommandsModule(options); t.after(() => module.close());
  return { module, options, replies };
}
test('commands validate duplicate names, unsafe resources and incomplete enabled rows', () => {
  for (const commands of [[row('a'), row('b', { command: '!A' })], [row('a', { audio: 'javascript:alert(1)' })], [row('a', { text: '' })], [row('a', { duration: 0 })]]) {
    assert.throws(() => validateCommands({ enabled: true, commands }));
  }
});
test('latest visual and audio replace their channels independently; repeated commands restart', t => {
  const { module } = fixture(t);
  module.save({ enabled: true, commands: [row('Aatrox'), row('Sion', { text: '', audio: 'https://example.com/sion.mp3' }), row('other', { audio: 'https://example.com/other.mp3' })] });
  const send = text => module.receive({ kind: 'comment', user: 'Ana', text });
  assert.equal(send('!aatrox extra'), false); assert.equal(send('!aatroxx'), false);
  assert.equal(send(' !AATROX '), true); const first = module.state().visual.id;
  send('!aatrox'); assert.notEqual(module.state().visual.id, first);
  send('!sion'); assert.equal(module.state().visual.text, 'Aatrox');
  const audio = module.state().audio.id;
  send('!other'); assert.notEqual(module.state().audio.id, audio); assert.equal(module.state().visual.text, 'other');
  module.clear(); assert.equal(module.state().visual, null); assert.equal(module.state().audio, null);
});
test('configuration persists, runtime does not, and disabled commands do not execute', t => {
  const { module, options } = fixture(t);
  module.save({ enabled: true, commands: [row('a'), row('b', { enabled: false })] });
  module.receive({ kind: 'comment', text: '!a' });
  const restored = createCommandsModule(options); t.after(() => restored.close());
  assert.deepEqual(restored.state().config, module.state().config); assert.equal(restored.state().visual, null);
  assert.equal(restored.receive({ kind: 'comment', text: '!b' }), false);
  restored.save({ ...restored.state().config, enabled: false });
  assert.equal(restored.receive({ kind: 'comment', text: '!a' }), false);
});
test('replacement timer cannot erase a newer visual', async t => {
  const { module } = fixture(t);
  module.save({ enabled: true, commands: [row('a'), row('b', { duration: 2 })] });
  module.receive({ kind: 'comment', text: '!a' });
  module.receive({ kind: 'comment', text: '!b' });
  await new Promise(resolve => setTimeout(resolve, 1100));
  assert.equal(module.state().visual.text, 'b');
  await new Promise(resolve => setTimeout(resolve, 1000));
  assert.equal(module.state().visual, null);
});
test('shared connector executes commands with TTS disabled and preserves ordinary chat', async t => {
  const { options } = fixture(t); let onLine;
  const processes = { start(cmd, args, callback) { onLine = callback; return new EventEmitter(); }, async stop() {}, async close() {} };
  const center = new Center({ root: process.cwd(), dataDir: options.dataDir, processes, tools: {} });
  t.after(() => center.close());
  center.commands.save({ enabled: true, commands: [row('a')] });
  center.settings.save({ ...center.settings.read(), Username: 'test', Enabled: false });
  center.tts.connectorPython = () => 'fake'; center.tts.connect();
  onLine(JSON.stringify({ kind: 'comment', text: '!a', user: 'Ana' }));
  assert.equal(center.commands.state().visual.text, 'a'); assert.equal(center.tts.queue.length, 0);
  center.settings.save({ ...center.settings.read(), Enabled: true, ReadAll: true, Cooldown: 0 }); center.tts.paused = true;
  onLine(JSON.stringify({ kind: 'comment', text: 'hola', user: 'Ana' }));
  assert.equal(center.tts.queue.length, 1);
  onLine(JSON.stringify({ kind: 'comment', text: '!a', user: 'Ana' }));
  assert.equal(center.tts.queue.length, 1);
});
