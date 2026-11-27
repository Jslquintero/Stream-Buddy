import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import { defaults } from '../backend/settings.js';
import { defaultNotifications } from '../modules/notifications/config.js';
import { defaultSocial, socialLayouts, socialStyles } from '../modules/social/config.js';

const pause = () => new Promise(resolve => setTimeout(resolve, 30));
const uploadedSvg = '/social-assets/' + 'a'.repeat(64) + '.svg';
const googleFontId = 'b'.repeat(24);
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
    const responses = {
      '/api/social/upload': { ok: true, image: uploadedSvg },
      '/api/notifications/fonts/install': { ok: true, id: googleFontId, name: body.name },
    };
    return { ok: true, json: async () => responses[url] ?? { ok: true, notificationRevision: 200 } };
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

async function selectEditorTab(dialog, name) {
  const tab = [...dialog.querySelectorAll('[role="tab"]')].find(button => button.textContent === name);
  assert.ok(tab, 'No se encontró la pestaña ' + name);
  tab.dispatchEvent(new dialog.ownerDocument.defaultView.MouseEvent('mousedown', { bubbles: true, button: 0 }));
  await until(() => tab.getAttribute('aria-selected') === 'true');
}

async function openEditor(doc, tab, name = 'Instagram') {
  const button = () => doc.querySelector(`[aria-label="Editar ${name}"]`);
  await until(button);
  button().click();
  await until(() => doc.querySelector('.social-dialog-editor'));
  const dialog = doc.querySelector('.social-dialog-editor');
  if (tab) await selectEditorTab(dialog, tab);
  return dialog;
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
  assert.equal(doc.querySelector('.social-settings .social-choices'), null);
  assert.ok(doc.querySelector('.social-preview .social-card').className.includes('social-layout-card'));
  assert.ok(doc.querySelector('.social-preview .social-card').className.includes('social-style-clean'));
  assert.match(doc.querySelector('.social-preview .social-card .social-icon svg path').getAttribute('d'), /^M7\.0301\.084/);
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
  const doc = window.document;
  await openEditor(doc, 'CSS');
  const textarea = () => doc.querySelector('.social-css-input');
  Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(textarea(), '.social-stage { justify-content: center; }');
  textarea().dispatchEvent(new window.Event('input', { bubbles: true }));
  await until(() => requests.some(request => request.url === '/api/social/save'));
  assert.equal(requests.find(request => request.url === '/api/social/save').body.channels[0].design.customCss.clean, '.social-stage { justify-content: center; }');
  await until(() => doc.querySelector('.social-preview style')?.textContent);
  assert.match(doc.querySelector('.social-preview style').textContent, /justify-content: center/);
  assert.match(doc.querySelector('.social-css-current').textContent, /justify-content: center/);
});

test('Social Media Rotator preserves per-network formats and shows the same card in both previews', async t => {
  const { window, requests, publish } = await mount(t, '/social');
  const css = '.social-stage { justify-content: center; } .social-card { outline: 2px solid red; }';
  const config = { ...defaultSocial, layout: 'slim', interval: 2, position: 'top-right', image: uploadedSvg, customCss: { clean: css } };
  publish({
    token: 'test', settings: defaults, tts: { resources: {}, queued: 0 }, events: [],
    tools: { layout: {}, ads: {}, social: { config, revision: 10 } },
  });
  const doc = window.document;
  const monitor = () => doc.querySelector('.social-monitor .social-preview');
  const dialog = () => doc.querySelector('.social-dialog-editor');
  const field = (root, label) => [...root.querySelectorAll('label')].find(node => node.textContent === label)?.control;
  const change = (select, value) => {
    select.value = value;
    select.dispatchEvent(new window.Event('change', { bubbles: true }));
  };
  await until(monitor);
  const disableAutoplay = field(doc, 'Rotación automática en la vista previa');
  disableAutoplay.click();
  const editor = await openEditor(doc, 'Formato', 'TikTok');
  assert.equal(field(editor, 'Aplicar diseño a'), undefined);
  const choice = [...editor.querySelectorAll('.social-choices button')].find(button => button.textContent.includes('pie sobre foto'));
  choice.click();
  change(field(editor, 'Posición en pantalla'), 'bottom-center');
  const modalPreview = dialog().querySelector('.social-preview');
  await until(() => monitor().querySelector('.social-stage.bottom-center .social-layout-photo-caption'));
  const previewCard = preview => preview.querySelector('.social-card');
  assert.equal(previewCard(modalPreview).outerHTML, previewCard(monitor()).outerHTML);
  for (const preview of [monitor(), modalPreview]) {
    assert.ok(preview.querySelector('.social-stage.bottom-center'));
    assert.ok(preview.querySelector('.social-progress'));
    assert.ok(preview.querySelector('style').textContent.includes(css));
  }
  await selectEditorTab(editor, 'CSS');
  assert.match(doc.querySelector('.social-css-current').textContent, /pie sobre foto/);
  const individualCss = '.social-card { outline: 3px solid blue; }';
  const cssField = editor.querySelector('.social-css-input');
  Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(cssField, individualCss);
  cssField.dispatchEvent(new window.Event('input', { bubbles: true }));
  const saves = () => requests.filter(request => request.url === '/api/social/save');
  await until(() => saves().at(-1)?.body.channels[1].design.customCss?.clean === individualCss);
  assert.equal(saves().at(-1).body.channels[1].layout, 'photo-caption');
  assert.equal(saves().at(-1).body.channels[0].layout, undefined);
  assert.deepEqual(saves().at(-1).body.channels[1].design, { position: 'bottom-center', customCss: { clean: individualCss } });
  assert.ok(monitor().querySelector('style').textContent.includes(individualCss));
  assert.ok(modalPreview.querySelector('style').textContent.includes(individualCss));
  assert.equal(saves().at(-1).body.channels[0].design, undefined);
  assert.equal(saves().at(-1).body.layoutMode, undefined);
  dialog().querySelector('[aria-label="Cerrar editor de red"]').click();
  await until(() => !dialog());

  const output = await mount(t, '/?social-output=1');
  const outputDoc = output.window.document;
  output.publish({ tools: { social: { config: saves().at(-1).body } } });
  await until(() => outputDoc.querySelector('.social-layout-slim'));
  assert.ok(outputDoc.querySelector('.social-stage.top-right'));
  assert.match(outputDoc.querySelector('.social-card').textContent, /Instagram/);
  await until(() => outputDoc.querySelector('.social-layout-photo-caption .social-media-cover'));
  assert.ok(outputDoc.querySelector('.social-stage.bottom-center'));
  assert.ok([...outputDoc.querySelectorAll('style')].some(style => style.textContent === individualCss));
  assert.match(outputDoc.querySelector('.social-card').getAttribute('aria-label'), /TikTok/);
});

test('Social Media Rotator keeps CSS per visual theme and previews the current card CSS', async t => {
  const { window, publish } = await mount(t, '/social');
  publish({
    token: 'test', settings: defaults, tts: { resources: {}, queued: 0 }, events: [],
    tools: { layout: {}, ads: {}, social: { config: structuredClone(defaultSocial), revision: 10 } },
  });
  const doc = window.document;
  const dialog = await openEditor(doc, 'Estilo');
  const card = () => doc.querySelector('.social-preview .social-card');
  const textarea = () => doc.querySelector('.social-css-input');
  assert.equal(doc.querySelectorAll('.social-style-choices button').length, socialStyles.length);
  [...doc.querySelectorAll('.social-style-choices button')].find(button => button.textContent.includes('Aurora')).click();
  await until(() => card().classList.contains('social-style-aurora'));
  await selectEditorTab(dialog, 'CSS');
  assert.match(doc.querySelector('.social-css-current').textContent, /Tema visual «Aurora»/);
  const css = '.social-card { --social-radius: 40px; }';
  Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(textarea(), css);
  textarea().dispatchEvent(new window.Event('input', { bubbles: true }));
  await until(() => doc.querySelector('.social-css-current').textContent.includes(css));
  await selectEditorTab(dialog, 'Estilo');
  [...doc.querySelectorAll('.social-style-choices button')].find(button => button.textContent.includes('Noir')).click();
  await until(() => card().classList.contains('social-style-noir'));
  await selectEditorTab(dialog, 'CSS');
  assert.equal(textarea().value, '', 'Cada tema conserva su propio CSS');
  await selectEditorTab(dialog, 'Estilo');
  [...doc.querySelectorAll('.social-style-choices button')].find(button => button.textContent.includes('Aurora')).click();
  await selectEditorTab(dialog, 'CSS');
  await until(() => textarea().value === css);
});

test('Social Media Rotator saves, applies and deletes reusable CSS templates', async t => {
  const { window, requests, publish } = await mount(t, '/social');
  publish({
    token: 'test', settings: defaults, tts: { resources: {}, queued: 0 }, events: [],
    tools: { layout: {}, ads: {}, social: { config: structuredClone(defaultSocial), revision: 10 } },
  });
  const doc = window.document;
  await openEditor(doc, 'CSS');
  const textarea = () => doc.querySelector('.social-css-input');
  const css = '.social-card { outline: 2px solid #ff2d75; }';
  Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(textarea(), css);
  textarea().dispatchEvent(new window.Event('input', { bubbles: true }));
  await until(() => requests.some(request => request.url === '/api/social/save' && request.body.channels[0].design?.customCss?.clean === css));
  const name = doc.querySelector('[aria-label="Nombre de la plantilla CSS"]');
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(name, 'Mi borde rosa');
  name.dispatchEvent(new window.Event('input', { bubbles: true }));
  [...doc.querySelectorAll('.social-css-template-save button')].find(button => button.textContent.includes('Guardar')).click();
  await until(() => requests.some(request => request.body.cssTemplates?.length === 1));
  const saved = requests.find(request => request.body.cssTemplates?.length === 1).body.cssTemplates[0];
  assert.equal(saved.name, 'Mi borde rosa');
  assert.equal(saved.css, css);
  [...doc.querySelectorAll('button')].find(button => button.textContent.includes('Restaurar CSS de este tema')).click();
  await until(() => textarea().value === '');
  doc.querySelector('.social-css-template-list li button').click();
  await until(() => textarea().value === css);
  await until(() => requests.at(-1).body.channels[0].design?.customCss?.clean === css);
  doc.querySelector('button[aria-label="Eliminar plantilla Mi borde rosa"]').click();
  await until(() => requests.at(-1).body.cssTemplates?.length === 0);
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

test('Social Media Rotator uploads SVG artwork for the custom card and applies the layout in the output', async t => {
  const { window, requests, publish } = await mount(t, '/social');
  publish({
    token: 'test', settings: defaults, tts: { resources: {}, queued: 0 }, events: [],
    tools: { layout: {}, ads: {}, social: { config: structuredClone(defaultSocial), revision: 10 } },
  });
  const doc = window.document;
  const dialog = await openEditor(doc, 'Formato');
  const choose = label => [...doc.querySelectorAll('.social-choices button')].find(button => button.textContent.includes(label));
  choose('Tarjeta personalizada').click();
  await until(() => dialog.querySelector('.social-format-actions button'));
  dialog.querySelector('.social-format-actions button').click();
  const imageScope = () => [...dialog.querySelectorAll('label')].find(label => label.textContent === 'Archivo de imagen para')?.control;
  await until(imageScope);
  imageScope().value = 'shared';
  imageScope().dispatchEvent(new window.Event('change', { bubbles: true }));
  await until(() => doc.querySelector('[aria-label="Seleccionar imagen compartida o SVG"]'));
  const upload = doc.querySelector('[aria-label="Seleccionar imagen compartida o SVG"]');
  const svg = new window.File(['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"/>'], 'diseño.svg');
  Object.defineProperty(upload, 'files', { value: [svg] });
  upload.dispatchEvent(new window.Event('change', { bubbles: true }));
  await until(() => doc.querySelector('.social-preview .social-media img')?.getAttribute('src') === uploadedSvg);
  assert.match(requests.find(request => request.url === '/api/social/upload').body.data, /^data:image\/svg\+xml;base64,/);

  const setNumber = (input, value) => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, value);
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
  };
  setNumber(doc.querySelector('.social-range input'), '83');
  await selectEditorTab(dialog, 'Estilo');
  choose('Por esquina').click();
  await until(() => doc.querySelector('.social-preview .social-corners-custom'));
  const corner = [...doc.querySelectorAll('.field')].find(field => field.querySelector('label')?.textContent === 'Superior izquierda · px');
  setNumber(corner.querySelector('input'), '38');
  await until(() => requests.some(({ url, body }) => url === '/api/social/save'
    && body.image === uploadedSvg && body.channels[0].design?.imagePositionX === 83 && body.channels[0].design.radiusTL === 38));

  const saved = requests.filter(({ url }) => url === '/api/social/save').at(-1).body;
  const output = await mount(t, '/?social-output=1');
  const card = () => output.window.document.querySelector('.social-card');
  const state = { tools: { social: { config: saved } } };
  output.publish(state);
  await until(() => card()?.classList.contains('social-layout-custom'));
  assert.equal(card().style.getPropertyValue('--social-image-x'), '83%');
  assert.equal(card().style.getPropertyValue('--social-card-tl'), '38px');
  assert.equal(card().querySelector('.social-media img').getAttribute('src'), uploadedSvg);

  state.tools.social.config = {
    ...saved,
    channels: saved.channels.map((channel, index) => index ? channel : { ...channel, layout: 'photo-caption', design: { ...channel.design, imageCorners: 'custom', imageRadiusBR: 64 } }),
  };
  output.publish(state);
  await until(() => card()?.classList.contains('social-layout-photo-caption'));
  assert.equal(card().style.getPropertyValue('--social-image-br'), '64px');
  assert.equal(card().querySelector('.social-media-background .social-media-cover').getAttribute('src'), uploadedSvg);
});

test('Social Media Rotator applies the layout selection and text shadow to the card', async t => {
  const { window, publish } = await mount(t, '/social');
  publish({
    token: 'test', settings: defaults, tts: { resources: {}, queued: 0 }, events: [],
    tools: { layout: {}, ads: {}, social: { config: structuredClone(defaultSocial), revision: 10 } },
  });
  const doc = window.document;
  const dialog = await openEditor(doc, 'Formato');
  assert.match(dialog.querySelector('.social-choices button[aria-pressed="true"]').textContent, /Tarjeta/);
  assert.equal(doc.querySelectorAll('.social-mini').length, socialLayouts.length);
  const card = () => doc.querySelector('.social-preview .social-card');
  [...doc.querySelectorAll('.social-choices button')].find(button => button.textContent.includes('Compacta')).click();
  await until(() => card().className.includes('social-layout-slim'));
  await selectEditorTab(dialog, 'Estilo');
  [...doc.querySelectorAll('.social-style-choices button')].find(button => button.textContent.includes('Retro')).click();
  await until(() => card().className.includes('social-style-retro'));
  const shadowToggle = [...doc.querySelectorAll('.toggle-row')]
    .find(row => row.textContent.includes('Sombra de texto')).querySelector('button');
  shadowToggle.click();
  await until(() => card().style.getPropertyValue('--social-text-shadow') !== 'none');
  assert.match(card().style.getPropertyValue('--social-text-shadow'), /0\.1em/);
});

test('Social Media Rotator installs Google Fonts and replays the text independently of the card', async t => {
  const { window, requests, publish } = await mount(t, '/social');
  const state = {
    token: 'test', settings: defaults, tts: { resources: {}, queued: 0 }, events: [],
    tools: { layout: {}, ads: {}, social: { config: { ...defaultSocial, animation: 'none' }, revision: 10 } },
  };
  publish(state);
  const doc = window.document;
  const dialog = await openEditor(doc, 'Texto');
  const settings = element => dialog.querySelector(element);
  const card = () => dialog.querySelector('.social-preview .social-card');
  await until(() => settings('.notification-font-installer'));
  const setValue = (input, prototype, value, event) => {
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(input, value);
    input.dispatchEvent(new window.Event(event, { bubbles: true }));
  };
  const textSelect = [...dialog.querySelectorAll('label')]
    .find(label => label.textContent === 'Animación de entrada del texto').control;
  const originalCard = card();
  setValue(textSelect, window.HTMLSelectElement.prototype, 'reveal', 'change');
  await until(() => card().querySelector('.social-copy.social-animation-reveal'));
  setValue(settings('input[type="range"]'), window.HTMLInputElement.prototype, '850', 'input');
  const copy = card().querySelector('.social-copy');
  [...dialog.querySelectorAll('.social-dialog-preview-actions button')].find(button => button.textContent.includes('Repetir animación del texto')).click();
  await until(() => card().querySelector('.social-copy') !== copy);
  assert.equal(card(), originalCard);
  assert.ok(card().classList.contains('social-animation-none'));
  assert.equal(card().style.getPropertyValue('--social-text-duration'), '850ms');

  const installer = settings('.notification-font-installer');
  setValue(installer.querySelector('input'), window.HTMLInputElement.prototype, 'Montserrat', 'input');
  installer.querySelector('button').click();
  const fontFamily = 'google:' + googleFontId;
  await until(() => requests.some(request => request.url === '/api/social/save' && request.body.channels[0].design?.fontFamily === fontFamily));
  const saved = requests.filter(request => request.url === '/api/social/save').at(-1).body;
  assert.deepEqual(requests.find(request => request.url === '/api/notifications/fonts/install').body, { name: 'Montserrat' });
  assert.equal(saved.channels[0].design.textAnimation, 'reveal');
  assert.equal(saved.channels[0].design.textAnimationDuration, 850);
  assert.equal(saved.animation, 'none');
  assert.ok(doc.head.querySelector(`link[href="/notification-fonts/${googleFontId}.css"]`));
  state.tools.notifications = {
    config: defaultNotifications, revision: 10, queued: 0, current: null,
    fonts: { items: [{ id: googleFontId, name: 'Montserrat' }] },
  };
  state.tools.social = { config: saved, revision: 200 };
  publish(state);
  await until(() => settings(`option[value="${fontFamily}"]`)?.textContent === 'Montserrat · instalada');

  const output = await mount(t, '/?social-output=1');
  const outputDoc = output.window.document;
  output.publish({ tools: { social: { config: saved } } });
  await until(() => outputDoc.head.querySelector(`link[href="/notification-fonts/${googleFontId}.css"]`));
  const rendered = outputDoc.querySelector('.social-card');
  assert.ok(rendered.classList.contains('social-animation-none'));
  assert.ok(rendered.querySelector('.social-copy.social-animation-reveal'));
  assert.match(rendered.style.getPropertyValue('--social-font-family'), new RegExp(googleFontId));
  assert.equal(rendered.style.getPropertyValue('--social-text-duration'), '850ms');
});

test('Social Media Rotator forces corners and RGB borders on every layout', async t => {
  const { window, publish } = await mount(t, '/social');
  publish({
    token: 'test', settings: defaults, tts: { resources: {}, queued: 0 }, events: [],
    tools: { layout: {}, ads: {}, social: { config: structuredClone(defaultSocial), revision: 10 } },
  });
  await until(() => window.document.querySelector('.social-settings'));
  const doc = window.document;
  const dialog = await openEditor(doc, 'Estilo');
  const card = () => doc.querySelector('.social-preview .social-card');
  const selectByLabel = label => [...doc.querySelectorAll('.field')]
    .find(field => field.querySelector('label')?.textContent === label)
    ?.querySelector('select');
  const choose = async (label, value, check) => {
    const select = selectByLabel(label);
    assert.ok(select, 'No se encontró el campo ' + label);
    Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set.call(select, value);
    select.dispatchEvent(new window.Event('change', { bubbles: true }));
    await until(check);
  };

  await choose('Efecto del borde', 'rgb', () => card().classList.contains('social-border-rgb'));
  [...doc.querySelectorAll('.social-corner-choices button')].find(button => button.textContent.includes('Rectas')).click();
  await until(() => card().classList.contains('social-corners-square'));
  await selectEditorTab(dialog, 'Formato');
  [...doc.querySelectorAll('.social-choices button')].find(button => button.textContent.includes('Píldora')).click();
  await until(() => card().classList.contains('social-layout-pill'));
  assert.ok(card().classList.contains('social-corners-square'));
  assert.ok(card().classList.contains('social-border-rgb'));
  assert.equal(card().style.getPropertyValue('--social-radius'), '24px');
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
