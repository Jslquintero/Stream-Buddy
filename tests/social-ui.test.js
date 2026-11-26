import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import { defaults } from '../backend/settings.js';
import { defaultSocial, socialLayouts } from '../modules/social/config.js';

const pause = () => new Promise(resolve => setTimeout(resolve, 30));
async function until(check) {
  for (let i = 0; i < 200; i++) {
    if (check()) return;
    await pause();
  }
  assert.ok(check(), 'La interfaz no respondió a tiempo');
}

async function mount(t, route) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://127.0.0.1:17900' + route, runScripts: 'outside-only', pretendToBeVisual: true });
  t.after(() => dom.window.close());
  const { window } = dom;
  let stream;
  const requests = [];
  window.structuredClone = structuredClone;
  window.EventSource = class { constructor() { stream = this; } close() {} };
  window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  window.fetch = async (url, options) => {
    const body = JSON.parse(options.body);
    requests.push({ url, body });
    return { ok: true, json: async () => ({ ok: true, notificationRevision: 200 }) };
  };
  const html = fs.readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
  window.eval(fs.readFileSync(new URL('../dist' + html.match(/src="([^"]+\.js)"/)[1], import.meta.url), 'utf8'));
  await until(() => stream);
  return {
    window,
    requests,
    publish: state => stream.onmessage({ data: JSON.stringify(state) }),
    disconnect: () => stream.onerror(),
  };
}

test('Social Media Rotator previews channels, rotates manually and autosaves the design', async t => {
  const { window, requests, publish } = await mount(t, '/social');
  publish({
    token: 'test', settings: defaults, tts: { resources: {}, queued: 0 }, events: [],
    tools: { layout: {}, ads: {}, social: { config: structuredClone(defaultSocial), revision: 10 } },
  });
  await until(() => window.document.querySelector('.social-settings'));
  const doc = window.document;
  assert.equal(doc.querySelector('.nav-item.active').textContent, 'Social Media Rotator');
  assert.match(doc.querySelector('.social-preview .social-card').textContent, /Instagram/);
  assert.match(doc.querySelector('.social-choices button[aria-pressed="true"]').textContent, /Tarjeta/);
  assert.equal(doc.querySelectorAll('.social-mini').length, socialLayouts.length);
  assert.ok(doc.querySelector('.social-preview .social-card').className.includes('social-layout-card'));
  assert.ok(doc.querySelector('.social-preview .social-card').className.includes('social-style-clean'));
  assert.equal(doc.querySelector('.social-preview .social-card').style.getPropertyValue('--social-icon-size'), '56px');
  assert.equal(doc.querySelector('.social-preview .social-card').style.getPropertyValue('--social-border-width'), '1px');
  assert.equal(doc.querySelector('.social-preview .social-card').style.getPropertyValue('--social-border-style'), 'solid');
  const buttons = () => [...doc.querySelectorAll('button')];
  buttons().find(button => button.textContent === 'Siguiente').click();
  await until(() => /TikTok/.test(doc.querySelector('.social-preview .social-card').textContent));
  const interval = doc.querySelector('.social-settings input[type="number"]');
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(interval, '9');
  interval.dispatchEvent(new window.Event('input', { bubbles: true }));
  await until(() => requests.some(request => request.url === '/api/social/save'));
  assert.equal(requests.find(request => request.url === '/api/social/save').body.interval, 9);
});

test('Social Media Rotator applies the custom CSS to the editor preview', async t => {
  const { window, requests, publish } = await mount(t, '/social');
  publish({
    token: 'test', settings: defaults, tts: { resources: {}, queued: 0 }, events: [],
    tools: { layout: {}, ads: {}, social: { config: structuredClone(defaultSocial), revision: 10 } },
  });
  await until(() => window.document.querySelector('.social-css-input'));
  const doc = window.document;
  const textarea = () => doc.querySelector('.social-css-input');
  Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(textarea(), '.social-stage { justify-content: center; }');
  textarea().dispatchEvent(new window.Event('input', { bubbles: true }));
  await until(() => requests.some(request => request.url === '/api/social/save' && request.body.customCss));
  assert.equal(requests.find(request => request.url === '/api/social/save').body.customCss, '.social-stage { justify-content: center; }');
  await until(() => doc.querySelector('.social-preview style')?.textContent);
  assert.match(doc.querySelector('.social-preview style').textContent, /justify-content: center/);
});

test('Social Media Rotator output stays transparent, positions the card and hides when disabled', async t => {
  const { window, publish } = await mount(t, '/?social-output=1');
  const state = { tools: { social: { config: structuredClone(defaultSocial) } } };
  publish(state);
  await until(() => window.document.querySelector('.social-card'));
  assert.ok(window.document.documentElement.classList.contains('social-output'));
  assert.ok(window.document.querySelector('.social-stage').classList.contains('bottom-left'));
  assert.match(window.document.querySelector('.social-card').textContent, /Instagram/);
  state.tools.social.config = { ...state.tools.social.config, opacity: 0 };
  publish(state);
  await until(() => window.document.querySelector('.social-card')?.classList.contains('social-flat'));
  state.tools.social.config = { ...state.tools.social.config, enabled: false };
  publish(state);
  await until(() => !window.document.querySelector('.social-card'));
});

test('Social Media Rotator applies the layout selection and text shadow to the card', async t => {
  const { window, publish } = await mount(t, '/social');
  publish({
    token: 'test', settings: defaults, tts: { resources: {}, queued: 0 }, events: [],
    tools: { layout: {}, ads: {}, social: { config: structuredClone(defaultSocial), revision: 10 } },
  });
  await until(() => window.document.querySelector('.social-choices button[aria-pressed="true"]'));
  const doc = window.document;
  assert.ok([...doc.querySelectorAll('.social-design-section')].some(section =>
    section.querySelector('summary').textContent.includes('Diseño')
    && section.querySelector('.social-choices')));
  assert.equal(doc.querySelectorAll('.social-mini').length, socialLayouts.length);
  const card = () => doc.querySelector('.social-preview .social-card');
  [...doc.querySelectorAll('.social-choices button')].find(button => button.textContent.includes('Compacta')).click();
  await until(() => card().className.includes('social-layout-slim'));
  [...doc.querySelectorAll('.social-style-choices button')].find(button => button.textContent.includes('Retro')).click();
  await until(() => card().className.includes('social-style-retro'));
  const shadowToggle = [...doc.querySelectorAll('.toggle-row')]
    .find(row => row.textContent.includes('Sombra de texto')).querySelector('button');
  shadowToggle.click();
  await until(() => card().style.getPropertyValue('--social-text-shadow') !== 'none');
  assert.match(card().style.getPropertyValue('--social-text-shadow'), /0\.1em/);
});

test('Social Media Rotator adds selected networks through the picker', async t => {
  const { window, requests, publish } = await mount(t, '/social');
  publish({
    token: 'test', settings: defaults, tts: { resources: {}, queued: 0 }, events: [],
    tools: { layout: {}, ads: {}, social: { config: structuredClone(defaultSocial), revision: 10 } },
  });
  await until(() => window.document.querySelector('.social-settings'));
  const doc = window.document;
  const addButton = [...doc.querySelectorAll('button')].find(button => button.textContent.includes('Añadir red'));
  assert.ok(addButton);
  addButton.click();
  await until(() => doc.querySelector('.social-picker-item input[type="checkbox"]'));
  const checkboxes = [...doc.querySelectorAll('.social-picker-item input[type="checkbox"]')];
  checkboxes[0].click();
  checkboxes[1].click();
  assert.equal(checkboxes[0].checked, true);
  assert.equal(checkboxes[1].checked, true);
  const confirm = [...doc.querySelectorAll('.social-picker button')].find(button => button.textContent.includes('Añadir'));
  assert.ok(confirm);
  confirm.click();
  await until(() => requests.some(request => request.url === '/api/social/save' && request.body.channels?.length === 5));
  assert.equal(doc.querySelector('.social-picker'), null);
});
