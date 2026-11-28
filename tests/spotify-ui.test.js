import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import { defaults } from '../backend/settings.js';

const pause = () => new Promise(resolve => setTimeout(resolve, 20));
const widget = doc => doc.querySelector('.spotify-surface')?.shadowRoot;
async function until(check) { for (let i = 0; i < 100; i++) { if (check()) return; await pause(); } assert.ok(check(), 'La interfaz no respondió a tiempo'); }
async function activateTab(window, name) {
  const tab = [...window.document.querySelectorAll('.spotify-tabs [role="tab"]')].find(item => item.textContent === name);
  assert.ok(tab, name);
  tab.dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true, button: 0 }));
  await until(() => tab.getAttribute('aria-selected') === 'true');
}
async function setup(t, pathname, mode = 'api', pending = null) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://127.0.0.1:17900' + pathname, runScripts: 'outside-only', pretendToBeVisual: true });
  t.after(() => dom.window.close()); const { window } = dom;
  if (pending) window.localStorage.setItem('live-studio.spotify.pending.v1',pending);
  let stream; const requests = [];
  window.EventSource = class { constructor() { stream = this; } close() {} };
  window.fetch = async (url, options) => { requests.push({ url, ...options }); return { ok: true, json: async () => ({ ok: true }) }; };
  window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  const html = fs.readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8'), asset = html.match(/src="([^"]+\.js)"/)[1];
  window.eval(fs.readFileSync(new URL('../dist' + asset, import.meta.url), 'utf8'));
  await until(() => stream);
  const spotify = { running: true, connected: true, config: { mode, enabled: true, clientId: 'a'.repeat(32), hideWhenPaused: true, theme: 'dark' }, url: '/?spotify-output=1#tiktok.studio', playback: { title: 'Canción de prueba', artist: 'Artista', playing: true, progress: 1000, duration: 200000, updatedAt: Date.now() } };
  const state = { token: 'csrf', settings: defaults, tools: { spotify, layout: {}, ads: {} }, tts: { resources: {} }, events: [] };
  const publish = async () => { stream.onmessage({ data: JSON.stringify(state) }); await pause(); };
  await publish(); return { window, spotify, publish, requests, getStream: () => stream };
}
test('Spotify panel preserves draft during updates and saves design; copies output', async t => {
  const f = await setup(t, '/spotify'), doc = f.window.document;
  await until(() => doc.querySelector('.spotify-settings'));
  assert.equal(doc.querySelector('.nav-item[aria-current="page"]').textContent, 'Música');
  assert.equal(doc.querySelector('.breadcrumb strong').textContent, 'Música');
  doc.querySelector('.spotify-source summary').click();
  const input = doc.querySelector('.spotify-source input');
  Object.getOwnPropertyDescriptor(f.window.HTMLInputElement.prototype, 'value').set.call(input, 'b'.repeat(32));
  input.dispatchEvent(new f.window.Event('input', { bubbles: true })); await pause(); await f.publish();
  assert.equal(input.value, 'b'.repeat(32));
  const click = async text => { const button = [...doc.querySelectorAll('button')].find(b => b.textContent === text); assert.ok(button, text); button.click(); await pause(); };
  await until(() => f.requests.some(r => r.url === '/api/spotify/save'));
  assert.equal(JSON.parse(f.requests.find(r => r.url === '/api/spotify/save').body).clientId, 'b'.repeat(32));
  let copied; Object.defineProperty(f.window.navigator, 'clipboard', { value: { writeText: async text => { copied = text; } } });
  await click('Copiar salida'); assert.equal(copied, 'http://127.0.0.1:17900/?spotify-output=1#tiktok.studio');
  await click('Desconectar Spotify'); assert.ok(f.requests.some(r => r.url === '/api/spotify/disconnect' && r.headers['X-Studio'] === 'csrf'));
});
test('local Spotify panel activates without Client ID or authorization redirect', async t => {
  const f = await setup(t, '/spotify', 'local'), doc = f.window.document;
  await until(() => doc.querySelector('.spotify-local-help'));
  doc.querySelector('.spotify-source summary').click();
  assert.equal(doc.querySelector('input[placeholder="Client ID de tu app de Spotify"]'), null);
  const button = [...doc.querySelectorAll('button')].find(b => b.textContent === 'Activar lectura local');
  assert.equal(button.disabled, false); button.click(); await pause();
  assert.equal(JSON.parse(f.requests.find(r => r.url === '/api/spotify/save').body).mode, 'local');
  assert.ok(f.requests.some(r => r.url === '/api/spotify/connect'));
  assert.equal(f.window.location.pathname, '/spotify');
});
test('Spotify output renders song, hides pauses and clears immediately on connection loss', async t => {
  const f = await setup(t, '/?spotify-output=1'), page = f.window.document;
  const doc = { querySelector: selector => widget(page)?.querySelector(selector), documentElement:page.documentElement };
  await until(() => doc.querySelector('.spotify-title'));
  assert.equal(doc.querySelector('.spotify-title').textContent, 'Canción de prueba');
  assert.ok(doc.documentElement.classList.contains('spotify-output')); assert.equal(doc.querySelector('.sidebar'), null);
  f.spotify.playback.playing = false; await f.publish(); await until(() => !doc.querySelector('.spotify-now'));
  f.spotify.config.hideWhenPaused = false; await f.publish(); assert.ok(doc.querySelector('.spotify-now'));
  f.getStream().onerror(); await pause(); assert.equal(doc.querySelector('.spotify-now'), null);
  await f.publish(); assert.ok(doc.querySelector('.spotify-now'));
  f.spotify.error = 'Sin conexión con Spotify'; await f.publish(); assert.equal(doc.querySelector('.spotify-now'), null);
  f.spotify.error = ''; f.spotify.playback = null; await f.publish(); assert.equal(doc.querySelector('.spotify-now'), null);
});

test('Local output shows AIMP playback with its artwork and player name', async t => {
  const f = await setup(t, '/?spotify-output=1', 'local');
  f.spotify.playback.source = 'aimp';
  f.spotify.playback.image = 'data:image/png;base64,aGVsbG8=';
  await f.publish();
  const output = widget(f.window.document);
  assert.match(output.querySelector('.spotify-brand').textContent, /^AIMP/);
  assert.equal(output.querySelector('.spotify-title').tagName, 'SPAN');
  assert.equal(output.querySelector('img.spotify-cover').getAttribute('src'), f.spotify.playback.image);
});

test('Spotify vertical design previews, autosaves and uses a portrait canvas in the output', async t => {
  const panel = await setup(t, '/spotify'), doc = panel.window.document;
  const vertical = [...doc.querySelectorAll('button')].find(button => button.textContent === 'Vertical');
  assert.ok(vertical);
  vertical.click();
  await until(() => widget(doc)?.querySelector('.player-vertical'));
  assert.equal(vertical.getAttribute('aria-pressed'), 'true');
  assert.match(doc.querySelector('.spotify-preview-panel').textContent, /288 × 424 px/);
  await until(() => panel.requests.some(request => request.url === '/api/spotify/save'));
  const config = JSON.parse(panel.requests.find(request => request.url === '/api/spotify/save').body);
  assert.equal(config.playerStyle, 'vertical');

  const output = await setup(t, '/?spotify-output=1'), page = output.window.document;
  output.spotify.config = config;
  await output.publish();
  await until(() => widget(page)?.querySelector('.player-vertical'));
  const stage = page.querySelector('.spotify-stage');
  assert.equal(stage.style.width, '288px');
  assert.equal(stage.style.height, '424px');
  assert.ok(widget(page).querySelector('.player-vertical [role="progressbar"]'));
});

test('Spotify CD Retro is available as both a layout and a theme', async t => {
  const panel = await setup(t, '/spotify'), doc = panel.window.document;
  const button = [...doc.querySelectorAll('button')].find(button => button.textContent === 'CD Retro');
  const theme = doc.querySelector('option[value="cd-retro"]').closest('select');
  button.click();
  await until(() => widget(doc)?.querySelector('.player-cd-retro.spotify-cd-retro'));
  theme.value = 'cd-retro';
  theme.dispatchEvent(new panel.window.Event('change', {bubbles:true}));
  await until(() => panel.requests.some(request => request.url === '/api/spotify/save' && JSON.parse(request.body).theme === 'cd-retro'));
  const config = JSON.parse(panel.requests.filter(request => request.url === '/api/spotify/save').at(-1).body);
  assert.equal(config.playerStyle, 'cd-retro');
  assert.equal(config.theme, 'cd-retro');

  const output = await setup(t, '/?spotify-output=1');
  output.spotify.config = config;
  await output.publish();
  const shadow = widget(output.window.document);
  assert.ok(shadow.querySelector('.player-cd-retro.spotify-cd-retro'));
  assert.deepEqual([...shadow.querySelectorAll('.spotify-cd-label')].map(label => label.textContent), ['Pista', 'Artista']);
  assert.equal(output.window.document.querySelector('.spotify-stage').style.height, '264px');
  output.spotify.config.playerStyle = 'vertical';
  await output.publish();
  assert.ok(shadow.querySelector('.player-vertical.spotify-cd-retro'));
});

test('Spotify CSS is live, isolated, saved per skin and can be reset', async t => {
  const f = await setup(t, '/spotify'), doc = f.window.document;
  await activateTab(f.window, 'Avanzado');
  await until(() => doc.querySelector('textarea[aria-label="CSS personalizado"]'));
  const getEditor = () => doc.querySelector('textarea[aria-label="CSS personalizado"]');
  const editor = getEditor();
  const css = '.spotify-title { color: rgb(255, 0, 0); } body { display:none; }';
  Object.getOwnPropertyDescriptor(f.window.HTMLTextAreaElement.prototype,'value').set.call(editor, css);
  editor.dispatchEvent(new f.window.Event('input',{bubbles:true})); await pause();
  assert.equal(widget(doc).querySelector('[data-spotify-custom-css]').textContent,css);
  assert.equal(doc.querySelector('[data-spotify-custom-css]'),null);
  const click = async label => { [...doc.querySelectorAll('button')].find(b => b.textContent === label).click(); await pause(); };
  await activateTab(f.window, 'Diseño');
  await click('Gallery');
  await activateTab(f.window, 'Avanzado');
  assert.equal(getEditor().value, '');
  await activateTab(f.window, 'Diseño');
  await click('Compact');
  await activateTab(f.window, 'Avanzado');
  assert.equal(getEditor().value, css);
  await until(() => f.requests.some(r => r.url === '/api/spotify/save'));
  assert.equal(JSON.parse(f.requests.find(r => r.url === '/api/spotify/save').body).customCss.compact,css);
  await click('Restaurar CSS de este diseño'); assert.equal(getEditor().value,'');
  assert.equal(widget(doc).querySelector('[data-spotify-custom-css]').textContent,'');
  await click('Insertar CSS actual');
  assert.match(getEditor().value, /\.spotify-now\.player-compact/);
  assert.doesNotMatch(getEditor().value, /\.player-gallery/);
  assert.ok(getEditor().value.length <= getEditor().maxLength);
  assert.equal(widget(doc).querySelector('[data-spotify-custom-css]').textContent, getEditor().value);
  assert.match(doc.querySelector('.spotify-settings .css-reference').textContent, /--card-background/);
});

test('Spotify automatically saves actions and recovers pending changes after reload', async t => {
  const f = await setup(t,'/spotify'), doc = f.window.document;
  f.getStream().onerror(); await pause();
  await activateTab(f.window, 'Carátula');
  [...doc.querySelectorAll('button')].find(b=>b.textContent==='Vinilo').click(); await pause();
  const pending = f.window.localStorage.getItem('live-studio.spotify.pending.v1');
  assert.equal(JSON.parse(pending).config.coverStyle,'vinyl');
  assert.equal(f.requests.filter(r=>r.url==='/api/spotify/save').length,0);
  const restored = await setup(t,'/spotify','api',pending);
  await until(()=>restored.requests.some(r=>r.url==='/api/spotify/save'));
  assert.equal(JSON.parse(restored.requests.find(r=>r.url==='/api/spotify/save').body).coverStyle,'vinyl');
  await until(()=>restored.window.localStorage.getItem('live-studio.spotify.pending.v1')===null);
  await until(()=>[...restored.window.document.querySelectorAll('[role="status"]')].some(e=>e.textContent.includes('guardados automáticamente')));
});

test('Spotify autosaves output design, cover, effects, theme and animations without a save button', async t => {
  const f = await setup(t,'/spotify'), doc=f.window.document;
  const button = text => [...doc.querySelectorAll('button')].find(b=>b.textContent===text);
  const toggle = text => [...doc.querySelectorAll('label')].find(label => label.textContent === text).control;
  const select = (label, value) => {
    const control = [...doc.querySelectorAll('.spotify-settings select')].find(item => item.labels[0].firstChild.textContent === label);
    control.value = value;
    control.dispatchEvent(new f.window.Event('change', { bubbles: true }));
  };
  const actions = [
    ['Diseño', () => button('Gallery').click(), 'playerStyle', 'gallery'],
    ['Carátula', () => button('Vinilo').click(), 'coverStyle', 'vinyl'],
    ['Carátula', () => toggle('Brillo alrededor de la carátula').click(), 'coverGlow', true],
    ['Carátula', () => toggle('Carátula desenfocada como fondo').click(), 'coverBlur', true],
    ['Diseño', () => select('Tema', 'gradient'), 'theme', 'gradient'],
    ['Visibilidad', () => select('Animación de entrada', 'fade'), 'revealAnimation', 'fade'],
  ];
  for (const [tab, action, key, value] of actions) {
    await activateTab(f.window, tab);
    const count=f.requests.filter(r=>r.url==='/api/spotify/save').length;
    action();
    await until(()=>f.requests.filter(r=>r.url==='/api/spotify/save').length>count);
    assert.equal(JSON.parse(f.requests.filter(r=>r.url==='/api/spotify/save').at(-1).body)[key],value);
    await until(()=>f.window.localStorage.getItem('live-studio.spotify.pending.v1')===null);
    await pause();
  }
  assert.equal(button('Guardar ajustes de Spotify'),undefined);
});

test('Spotify preview tests both transitions without changing the broadcast settings', async t => {
  const { window, spotify, publish, requests } = await setup(t, '/spotify');
  const doc = window.document;
  const preview = doc.querySelector('.spotify-preview-panel');
  const button = text => [...preview.querySelectorAll('button')].find(item => item.textContent === text);
  assert.match(preview.textContent, /Reproducción detectada/);
  spotify.playback = null;
  await publish();
  assert.match(preview.textContent, /Canción de ejemplo/);
  button('Probar salida').click();
  await until(() => widget(doc).querySelector('.spotify-motion.exit'));
  await until(() => !widget(doc).querySelector('.spotify-now'));
  assert.equal(button('Probar salida').disabled, true);
  button('Probar entrada').click();
  await until(() => widget(doc).querySelector('.spotify-motion.enter'));
  assert.equal(button('Probar salida').disabled, false);
  assert.equal(requests.some(request => request.url === '/api/spotify/save'), false);
});
