import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { defaults } from '../backend/settings.js';

test('dashboard consumes Node events and preserves unsaved form input across updates', async () => {
  const html = fs.readFileSync(new URL('../web/index.html', import.meta.url), 'utf8');
  const elements = new Map();
  function element() { return { textContent: '', value: '', options: [], dataset: {}, classList: { add() {}, toggle() {} }, replaceChildren() {}, append() {}, addEventListener() {} }; }
  for (const match of html.matchAll(/id="([^"]+)"/g)) elements.set('#' + match[1], element());
  elements.get('#settings').elements = Object.fromEntries(Object.entries(defaults).map(([key, value]) => [key, { ...element(), type: typeof value === 'boolean' ? 'checkbox' : typeof value === 'number' ? 'number' : 'text', checked: false }]));
  let stream;
  const requests = [];
  const context = vm.createContext({
    document: {
      querySelector(selector) { assert.ok(elements.has(selector), `Missing dashboard element ${selector}`); return elements.get(selector); },
      querySelectorAll() { return []; },
      createElement: element, createTextNode: text => text
    },
    EventSource: class { constructor(url) { assert.equal(url, '/api/events'); stream = this; } },
    fetch: async (url, options) => { requests.push({ url, options }); return { ok: true, json: async () => ({ ok: true }) }; },
    navigator: { clipboard: { writeText: async () => {} } }
  });
  vm.runInContext(fs.readFileSync(new URL('../web/tts.js', import.meta.url), 'utf8'), context);
  vm.runInContext(fs.readFileSync(new URL('../web/app.js', import.meta.url), 'utf8'), context);
  const state = { token: 'test-token', settings: { ...defaults, Username: 'usuario' }, tools: { layout: { running: false, available: true }, ads: { running: true, available: true } }, tts: { queued: 2, connected: false, connector: true, resources: { voices: [], devices: [], models: [], catalog: [] } }, events: [] };
  stream.onmessage({ data: JSON.stringify(state) });
  assert.equal(elements.get('#global-account').textContent, '@usuario');
  assert.match(elements.get('#queue').textContent, /2 en cola/);
  const form = elements.get('#settings');
  form.elements.Command.value = '!editado';
  state.tts.connected = true;
  stream.onmessage({ data: JSON.stringify(state) });
  assert.equal(form.elements.Command.value, '!editado');
  assert.equal(elements.get('#global-connection').textContent, 'Conectado');
  elements.get('#preview-text').value = 'Texto sin comando';
  await elements.get('#preview-voice').onclick();
  assert.equal(requests[0].url, '/api/tts/preview');
  const preview = JSON.parse(requests[0].options.body);
  assert.equal(preview.settings.Command, '!editado');
  assert.equal(preview.text, 'Texto sin comando');
  assert.equal(preview.settings.Speaker, 0);
  assert.equal(state.settings.Command, defaults.Command);
  await elements.get('#test').onclick();
  assert.equal(requests[1].options.headers['X-Studio'], 'test-token');
  stream.onerror(); assert.match(elements.get('#notice').textContent, /Sin conexión/);
  stream.onmessage({ data: JSON.stringify(state) });
  assert.match(elements.get('#notice').textContent, /restablecida/);
  delete state.tts.resources;
  stream.onmessage({ data: JSON.stringify(state) });
  assert.match(elements.get('#tts-error').textContent, /versión anterior/);
});
