import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import { defaults } from '../backend/settings.js';
import { defaultBanners } from '../modules/banners/config.js';

const pause = () => new Promise(resolve => setTimeout(resolve, 30));
async function until(check) {
  for (let i = 0; i < 240; i++) {
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
    return { ok: true, json: async () => ({ ok: true, notificationRevision: 200, image: '/banner-assets/' + 'c'.repeat(64) + '.png' }) };
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

const firstImage = '/banner-assets/' + 'a'.repeat(64) + '.png';
const secondImage = '/banner-assets/' + 'b'.repeat(64) + '.svg';
const sampleAds = [
  { id: 'ad-1', image: firstImage, name: 'Campaña de verano', alt: 'Oferta de temporada', advertiser: 'Acme', caption: 'Visita la tienda', enabled: true },
  { id: 'ad-2', image: secondImage, name: 'Lanzamiento', alt: 'Nuevo producto', advertiser: 'Marca', caption: 'Descúbrelo', enabled: true },
];
const stateFor = config => ({
  token: 'test', settings: defaults, tts: { resources: {}, queued: 0 }, events: [],
  tools: { layout: {}, ads: {}, banners: { config, revision: 10, url: '/?banners-output=1#tiktok.studio' } },
});

test('Ad Banner Rotator previews creatives, measures and corporate animations', async t => {
  const { window, requests, publish } = await mount(t, '/banners');
  publish(stateFor({ ...structuredClone(defaultBanners), interval: 10, ads: structuredClone(sampleAds) }));
  await until(() => window.document.querySelector('.banner-settings'));
  const doc = window.document;
  assert.equal(doc.querySelector('.nav-item.active').textContent, 'Ad Banner Rotator');
  const card = () => doc.querySelector('.banner-preview .bn-card');
  assert.match(card().className, /bn-layout-frame/);
  assert.match(card().className, /bn-style-corporate/);
  assert.match(card().className, /bn-enter-rise/);
  assert.match(card().className, /bn-autosize/);
  assert.ok(doc.querySelector('.banner-auto-note'));
  assert.doesNotMatch(doc.querySelector('.banner-design-body').textContent, /Medida estándar/);
  assert.equal(card().style.getPropertyValue('--bn-width'), '728px');
  assert.equal(card().style.getPropertyValue('--bn-height'), '90px');
  assert.equal(card().querySelector('.bn-image').getAttribute('src'), firstImage);
  assert.equal(card().querySelector('.bn-tag').textContent, 'PUBLICIDAD');
  assert.ok(doc.querySelector('.banner-preview .bn-progress'));

  const autoRow = [...doc.querySelectorAll('.toggle-row')].find(row => row.textContent.includes('Rotación automática en la vista previa'));
  autoRow.querySelector('button').click();
  const fitRow = [...doc.querySelectorAll('.toggle-row')].find(row => row.textContent.includes('Ajustar al tamaño de cada imagen'));
  fitRow.querySelector('button').click();
  await until(() => !card().className.includes('bn-autosize') && !doc.querySelector('.banner-auto-note'));
  assert.doesNotMatch(doc.querySelector('.banner-design-body').textContent, /Medida estándar/);

  const setFixed = async (label, value) => {
    const field = [...doc.querySelectorAll('.banner-design-body .field')].find(item => item.querySelector('label')?.textContent.startsWith(label));
    assert.ok(field, label);
    const input = field.querySelector('input');
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, String(value));
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
    await pause();
  };
  await setFixed('Ancho fijo', 970);
  await setFixed('Alto fijo', 250);
  await until(() => card().style.getPropertyValue('--bn-width') === '970px');
  assert.equal(card().style.getPropertyValue('--bn-height'), '250px');
  await until(() => requests.some(request => request.url === '/api/banners/save' && request.body.width === 970 && request.body.height === 250));

  [...doc.querySelectorAll('button')].find(button => button.textContent.trim() === 'Siguiente').click();
  await until(() => card()?.getAttribute('aria-label')?.includes('Lanzamiento'));
  assert.equal(card().querySelector('.bn-image').getAttribute('src'), secondImage);

  const intervalInput = doc.querySelector('.banner-settings input[type="number"]');
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(intervalInput, '12');
  intervalInput.dispatchEvent(new window.Event('input', { bubbles: true }));
  await until(() => requests.some(request => request.url === '/api/banners/save' && request.body.interval === 12));

  [...doc.querySelectorAll('.banner-choices:not(.banner-style-choices) button')].find(button => button.textContent.includes('A sangre')).click();
  await until(() => card().className.includes('bn-layout-bleed'));
  [...doc.querySelectorAll('.banner-style-choices button')].find(button => button.textContent.includes('Cristal')).click();
  await until(() => card().className.includes('bn-style-glass'));

  [...doc.querySelectorAll('button')].find(button => button.textContent.includes('Repetir animación')).click();
  await until(() => card().className.includes('bn-exit-sink'));
  await until(() => card().className.includes('bn-enter-rise'));

  doc.querySelector('[aria-label^="Editar Campaña"]').click();
  await until(() => doc.querySelector('.bn-dialog'));
  const nameInput = doc.querySelector('.bn-dialog .input');
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(nameInput, 'Campaña editada');
  nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
  await until(() => requests.some(request => request.url === '/api/banners/save' && request.body.ads[0]?.name === 'Campaña editada'));
  assert.match(doc.querySelector('.bn-dialog-header h2').textContent, /Campaña editada/);
});

test('Ad Banner Rotator applies custom CSS to the editor preview', async t => {
  const { window, requests, publish } = await mount(t, '/banners');
  publish(stateFor({ ...structuredClone(defaultBanners), ads: structuredClone(sampleAds) }));
  await until(() => window.document.querySelector('.banner-css-input'));
  const doc = window.document;
  const textarea = () => doc.querySelector('.banner-css-input');
  Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(textarea(), '.bn-card { border-radius: 24px; }');
  textarea().dispatchEvent(new window.Event('input', { bubbles: true }));
  await until(() => requests.some(request => request.url === '/api/banners/save' && request.body.customCss));
  assert.equal(requests.find(request => request.url === '/api/banners/save').body.customCss, '.bn-card { border-radius: 24px; }');
  await until(() => doc.querySelector('.banner-preview style')?.textContent);
  assert.match(doc.querySelector('.banner-preview style').textContent, /border-radius: 24px/);
});

test('Ad Banner Rotator uploads several creatives into the rotation', async t => {
  const { window, requests, publish } = await mount(t, '/banners');
  publish(stateFor({ ...structuredClone(defaultBanners), ads: [] }));
  await until(() => window.document.querySelector('.bn-dropzone'));
  const doc = window.document;
  const drop = new window.Event('drop', { bubbles: true, cancelable: true });
  Object.defineProperty(drop, 'dataTransfer', { value: { files: [
    new window.File(['primera'], 'campana uno.png', { type: 'image/png' }),
    new window.File(['segunda'], 'campana dos.svg', { type: 'image/svg+xml' }),
  ] } });
  doc.querySelector('.bn-dropzone').dispatchEvent(drop);
  await until(() => requests.filter(request => request.url === '/api/banners/upload').length === 2);
  assert.equal(drop.defaultPrevented, true);
  await until(() => requests.some(request => request.url === '/api/banners/save' && request.body.ads?.length === 2));
  await until(() => doc.querySelectorAll('.bn-ad-row').length === 2);
  assert.equal(doc.querySelectorAll('.bn-ad-row .bn-ad-thumb img').length, 2);
  assert.match(doc.querySelector('.bn-ad-row').textContent, /campana uno/);
});

test('Ad Banner Rotator output stays transparent, keeps the slot and hides when disabled', async t => {
  const { window, publish } = await mount(t, '/?banners-output=1');
  const state = stateFor({ ...structuredClone(defaultBanners), ads: structuredClone(sampleAds) });
  Object.assign(state, { tools: { banners: { config: state.tools.banners.config } } });
  publish(state);
  await until(() => window.document.querySelector('.bn-card'));
  const doc = window.document;
  assert.ok(doc.documentElement.classList.contains('banners-output'));
  assert.ok(doc.querySelector('.bn-stage').classList.contains('bottom-center'));
  assert.equal(doc.querySelector('.bn-tag').textContent, 'PUBLICIDAD');
  assert.ok(doc.querySelector('.bn-progress'));
  assert.ok(doc.querySelector('.bn-card').classList.contains('bn-autosize'));

  state.tools.banners.config = { ...state.tools.banners.config, fitToCreative: false };
  publish(state);
  await until(() => !doc.querySelector('.bn-card').classList.contains('bn-autosize'));

  state.tools.banners.config = { ...state.tools.banners.config, ads: [structuredClone(sampleAds[0])] };
  publish(state);
  await until(() => !window.document.querySelector('.bn-progress'));
  assert.ok(doc.querySelector('.bn-card'));

  state.tools.banners.config = { ...state.tools.banners.config, opacity: 0 };
  publish(state);
  await until(() => doc.querySelector('.bn-card')?.classList.contains('bn-flat'));

  state.tools.banners.config = { ...state.tools.banners.config, enabled: false };
  publish(state);
  await until(() => !doc.querySelector('.bn-card'));
});
