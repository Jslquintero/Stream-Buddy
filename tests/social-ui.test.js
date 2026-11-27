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
const configuredValue = (card, name) => card.style.getPropertyValue('--social-config-' + name);
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

test('local profile picker keeps separate browser drafts when changing profiles', async t => {
  const { window, requests, publish } = await mount(t, '/social');
  const doc = window.document;
  const principal = { id: 'default', name: 'Principal' };
  const secondary = { id: 'secondary', name: 'Segundo' };
  const base = {
    token: 'principal-token', settings: defaults, tts: { resources: {}, queued: 0 }, events: [],
    tools: { layout: {}, ads: {}, social: { config: defaultSocial, revision: 10 } },
  };
  const key = 'live-studio.social.pending.v1';
  window.localStorage.setItem(key, JSON.stringify({ config: { ...defaultSocial, heading: 'Borrador principal' } }));
  window.localStorage.setItem(key + '.profile.secondary', JSON.stringify({ config: { ...defaultSocial, heading: 'Borrador segundo' } }));
  const switcher = () => doc.querySelector('.profile-picker select');
  const deleteProfile = () => doc.querySelector('[aria-label="Eliminar perfil"]');
  const confirmation = () => doc.querySelector('.profile-confirmation[role="alertdialog"]');
  const dialogButton = label => [...confirmation().querySelectorAll('button')].find(button => button.textContent === label);
  const heading = () => doc.querySelector('.social-preview .social-heading')?.textContent;
  window.confirm = () => assert.fail('Profile confirmations must be rendered in the dashboard');
  publish({ ...base, profiles: { activeId: principal.id, items: [principal] } });
  await until(() => heading() === 'Borrador principal');
  assert.equal(deleteProfile().disabled, true);
  doc.querySelector('[aria-label="Nuevo perfil"]').click();
  await until(() => doc.querySelector('[aria-label="Nombre del perfil"]'));
  const name = doc.querySelector('[aria-label="Nombre del perfil"]');
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(name, secondary.name);
  name.dispatchEvent(new window.Event('input', { bubbles: true }));
  doc.querySelector('.profile-picker-form button').click();
  await until(() => requests.some(request => request.url === '/api/profiles/create' && request.body.name === secondary.name));

  const items = [principal, secondary];
  publish({ ...base, tts: { ...base.tts, connected: true }, profiles: { activeId: principal.id, items } });
  await until(() => switcher()?.options.length === 2 && !switcher().disabled);
  switcher().value = secondary.id;
  switcher().dispatchEvent(new window.Event('change', { bubbles: true }));
  await until(confirmation);
  assert.equal(confirmation().querySelector('h2').textContent, 'Cambiar a Segundo');
  assert.ok(!requests.some(request => request.url === '/api/profiles/activate'));
  dialogButton('Cambiar de perfil').click();
  await until(() => requests.some(request => request.url === '/api/profiles/activate' && request.body.id === secondary.id));
  publish({ ...base, token: 'second-token', profiles: { activeId: secondary.id, items } });
  await until(() => heading() === 'Borrador segundo');
  assert.equal(switcher().value, secondary.id);

  deleteProfile().click();
  await until(confirmation);
  assert.equal(confirmation().querySelector('h2').textContent, 'Eliminar Segundo');
  assert.equal(confirmation().closest('.sidebar'), null);
  await until(() => doc.activeElement === dialogButton('Cancelar'));
  dialogButton('Cancelar').dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await until(() => !confirmation());
  assert.ok(!requests.some(request => request.url === '/api/profiles/delete'));
  deleteProfile().click();
  await until(confirmation);
  dialogButton('Eliminar perfil').click();
  await until(() => requests.some(request => request.url === '/api/profiles/delete' && request.body.id === secondary.id));
  publish({ ...base, token: 'restored-token', profiles: { activeId: principal.id, items: [principal] } });
  await until(() => switcher().value === principal.id && switcher().options.length === 1);
  assert.equal(deleteProfile().disabled, true);
});

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
  const card = doc.querySelector('.social-preview .social-card');
  assert.equal(configuredValue(card, 'icon-size'), '56px');
  assert.equal(configuredValue(card, 'border-width'), '1px');
  assert.equal(configuredValue(card, 'border-style'), 'solid');
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
    tools: { layout: {}, ads: {}, social: { config: { ...defaultSocial, layout: 'hero', iconBackdropStyle: 'light' }, revision: 10 } },
  });
  const doc = window.document;
  await openEditor(doc, 'CSS');
  const textarea = () => doc.querySelector('.social-css-input');
  const css = '.social-stage { justify-content: center; } .social-card { --social-radius: 42px; } .social-icon { border-radius: 0; background: #101212; }';
  Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(textarea(), css);
  textarea().dispatchEvent(new window.Event('input', { bubbles: true }));
  await until(() => requests.some(request => request.url === '/api/social/save'));
  assert.equal(requests.find(request => request.url === '/api/social/save').body.channels[0].design.customCss.clean, css);
  await until(() => doc.querySelector('.social-preview style')?.textContent);
  assert.match(doc.querySelector('.social-preview style').textContent, /justify-content: center/);
  assert.match(doc.querySelector('.social-css-current').textContent, /justify-content: center/);
  assert.equal(doc.querySelector('.social-preview .social-card').style.getPropertyValue('--social-radius'), '');
});

test('Social Media Rotator leaves the card title empty when the visible name is cleared', async t => {
  const editor = await mount(t, '/social');
  editor.publish({
    token: 'test', settings: defaults, tts: { resources: {}, queued: 0 }, events: [],
    tools: { layout: {}, ads: {}, social: { config: { ...defaultSocial, channels: [defaultSocial.channels[0]] }, revision: 10 } },
  });
  const { window, requests } = editor;
  const dialog = await openEditor(window.document, 'Red');
  const input = [...dialog.querySelectorAll('label')].find(label => label.textContent === 'Nombre visible').control;
  const preview = () => dialog.querySelector('.social-preview .social-card');
  assert.equal(preview().querySelector('.social-label').textContent, 'Instagram');
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, '');
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
  await until(() => !preview().querySelector('.social-label'));

  const platform = [...dialog.querySelectorAll('label')].find(label => label.textContent === 'Plataforma').control;
  platform.value = 'website';
  platform.dispatchEvent(new window.Event('change', { bubbles: true }));
  const saved = () => requests.find(({ url, body }) => url === '/api/social/save' &&
    body.channels[0].platform === 'website' && body.channels[0].label === '');
  await until(saved);
  assert.equal(input.value, '');

  const output = await mount(t, '/?social-output=1#tiktok.studio');
  output.publish({ tools: { social: { config: saved().body } } });
  const card = () => output.window.document.querySelector('.social-card');
  await until(card);
  assert.equal(card().querySelector('.social-label'), null);
  assert.equal(card().querySelector('.social-handle').textContent, '@tuusuario');
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

test('Social Media Rotator keeps the channel editor open on a backdrop click after changing tabs', async t => {
  const { window, publish } = await mount(t, '/social');
  publish({
    token: 'test', settings: defaults, tts: { resources: {}, queued: 0 }, events: [],
    tools: { layout: {}, ads: {}, social: { config: structuredClone(defaultSocial), revision: 10 } },
  });
  const doc = window.document;
  const dialog = await openEditor(doc, 'Formato');
  assert.ok(![...dialog.querySelectorAll('[role="tab"]')].some(tab => tab.textContent === 'QR'));
  await selectEditorTab(dialog, 'Imagen');
  dialog.parentElement.click();
  await pause();
  assert.equal(doc.querySelector('.social-dialog-editor'), dialog);
  assert.equal(dialog.querySelector('[role="tab"][aria-selected="true"]').textContent, 'Imagen');

  window.document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await until(() => !doc.querySelector('.social-dialog-editor'));
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
  assert.equal(configuredValue(card(), 'image-x'), '83%');
  assert.equal(configuredValue(card(), 'card-tl'), '38px');
  assert.equal(card().querySelector('.social-media img').getAttribute('src'), uploadedSvg);

  state.tools.social.config = {
    ...saved,
    channels: saved.channels.map((channel, index) => index ? channel : { ...channel, layout: 'photo-caption', design: { ...channel.design, imageCorners: 'custom', imageRadiusBR: 64 } }),
  };
  output.publish(state);
  await until(() => card()?.classList.contains('social-layout-photo-caption'));
  assert.equal(configuredValue(card(), 'image-br'), '64px');
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
  await until(() => configuredValue(card(), 'text-shadow') !== 'none');
  assert.match(configuredValue(card(), 'text-shadow'), /0\.1em/);
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
  assert.equal(configuredValue(card(), 'text-duration'), '850ms');

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
  assert.match(configuredValue(rendered, 'font-family'), new RegExp(googleFontId));
  assert.equal(configuredValue(rendered, 'text-duration'), '850ms');
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
  assert.equal(configuredValue(card(), 'radius'), '24px');
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

test('Social Media Rotator removes a channel from the list after confirmation', async t => {
  const { window, requests, publish } = await mount(t, '/social');
  const config = { ...defaultSocial, channels: defaultSocial.channels.slice(0, 2) };
  publish({
    token: 'test', settings: defaults, tts: { resources: {}, queued: 0 }, events: [],
    tools: { layout: {}, ads: {}, social: { config, revision: 10 } },
  });
  const doc = window.document;
  const remove = name => doc.querySelector(`.social-channel-list button[aria-label="Eliminar ${name}"]`);
  const confirm = () => doc.querySelector('.social-dialog-confirm');
  const editor = await openEditor(doc, 'Red', 'TikTok');
  assert.ok(![...editor.querySelectorAll('.social-dialog-footer button')].some(button => button.textContent === 'Eliminar'));
  editor.querySelector('[aria-label="Cerrar editor de red"]').click();
  await until(() => !doc.querySelector('.social-dialog-editor'));
  remove('TikTok').click();
  await until(confirm);
  assert.equal(confirm().querySelector('h2').textContent, 'Eliminar TikTok');
  [...confirm().querySelectorAll('button')].find(button => button.textContent === 'Cancelar').click();
  await until(() => !confirm());
  assert.ok(remove('TikTok'));
  assert.equal(requests.filter(request => request.url === '/api/social/save').length, 0);

  remove('TikTok').click();
  await until(confirm);
  confirm().querySelector('.button-danger').click();
  await until(() => !remove('TikTok') && !confirm());
  assert.equal(remove('Instagram').disabled, true);
  const saved = () => requests.find(request => request.url === '/api/social/save');
  await until(saved);
  assert.deepEqual(saved().body.channels.map(channel => channel.id), ['instagram']);
});

test('Social Media Rotator generates and styles a QR in the editor and in the output', async t => {
  const editor = await mount(t, '/social');
  editor.publish({
    token: 'test', settings: defaults, tts: { resources: {}, queued: 0 }, events: [],
    tools: { layout: {}, ads: {}, social: { config: structuredClone(defaultSocial), revision: 10 } },
  });
  const doc = editor.window.document;
  await until(() => doc.querySelector('.social-settings'));
  [...doc.querySelectorAll('button')].find(button => button.textContent.includes('Añadir red')).click();
  await until(() => doc.querySelector('.social-picker-item'));
  const option = [...doc.querySelectorAll('.social-picker-item')].find(item => item.querySelector('strong').textContent === 'QR');
  option.querySelector('input').click();
  await until(() => option.dataset.selected === 'true');
  [...doc.querySelectorAll('.social-picker button')].find(button => button.textContent === 'Añadir 1 red').click();

  const dialog = await openEditor(doc, 'Red', 'QR');
  const input = doc.getElementById([...dialog.querySelectorAll('label')].find(label => label.textContent === 'URL del código QR').htmlFor);
  const enterUrl = url => {
    Object.getOwnPropertyDescriptor(editor.window.HTMLInputElement.prototype, 'value').set.call(input, url);
    input.dispatchEvent(new editor.window.Event('input', { bubbles: true }));
  };
  const previewQr = () => dialog.querySelector('.social-preview .social-qr');
  assert.equal(previewQr(), null);
  enterUrl('https://example.com/primero');
  await until(previewQr);
  const firstCode = previewQr().getAttribute('src');
  const url = 'https://example.com/menú?desde=directo#qr';
  enterUrl(url);
  await until(() => previewQr() && previewQr().getAttribute('src') !== firstCode);
  await selectEditorTab(dialog, 'QR');
  const field = label => doc.getElementById([...dialog.querySelectorAll('label')].find(item => item.textContent === label).htmlFor);
  const select = (label, value) => {
    const element = field(label);
    Object.getOwnPropertyDescriptor(editor.window.HTMLSelectElement.prototype, 'value').set.call(element, value);
    element.dispatchEvent(new editor.window.Event('change', { bubbles: true }));
  };
  select('Colores del QR', 'purple');
  select('Forma de los módulos', 'rounded');
  const size = field('Tamaño del QR');
  Object.getOwnPropertyDescriptor(editor.window.HTMLInputElement.prototype, 'value').set.call(size, '220');
  size.dispatchEvent(new editor.window.Event('input', { bubbles: true }));
  await until(() => previewQr()?.width === 220);
  const code = previewQr().getAttribute('src');
  assert.match(decodeURIComponent(code), /fill="#faf5ff"/);
  assert.match(decodeURIComponent(code), /stroke-linejoin="round"/);
  const saved = () => editor.requests.find(request => request.url === '/api/social/save' &&
    request.body.channels.some(channel => channel.platform === 'qr' && channel.url === new URL(url).href &&
      channel.design?.qrPalette === 'purple' && channel.design?.qrShape === 'rounded' && channel.design?.qrSize === 220));
  await until(saved);

  const output = await mount(t, '/?social-output=1#tiktok.studio');
  const qr = saved().body.channels.find(channel => channel.platform === 'qr');
  const publishOutput = channels => output.publish({ tools: { social: { config: { ...saved().body, channels } } } });
  const outputDoc = output.window.document;
  publishOutput([{ ...qr, url: '' }, defaultSocial.channels[0]]);
  await until(() => outputDoc.querySelector('.social-card')?.textContent.includes('Instagram'));
  publishOutput([{ ...qr, layout: 'minimal', design: { ...qr.design, showIcon: false } }]);
  const outputQr = () => outputDoc.querySelector('.social-card.social-layout-minimal .social-qr');
  await until(outputQr);
  assert.equal(outputQr().getAttribute('src'), code);
  assert.equal(outputQr().width, 220);
});

test('Social Media Rotator uses a website favicon unless a custom icon is uploaded', async t => {
  const editor = await mount(t, '/social');
  editor.publish({
    token: 'test', settings: defaults, tts: { resources: {}, queued: 0 }, events: [],
    tools: { layout: {}, ads: {}, social: { config: structuredClone(defaultSocial), revision: 10 } },
  });
  const { window, requests } = editor;
  const doc = window.document;
  await until(() => doc.querySelector('.social-settings'));
  [...doc.querySelectorAll('button')].find(button => button.textContent.includes('Añadir red')).click();
  await until(() => doc.querySelector('.social-picker-item'));
  const platforms = [['custom', 'Personalizada'], ['website', 'Sitio web']];
  for (const [, name] of platforms) {
    const option = [...doc.querySelectorAll('.social-picker-item')].find(item => item.querySelector('strong').textContent === name);
    option.querySelector('input').click();
    await until(() => option.dataset.selected === 'true');
  }
  [...doc.querySelectorAll('.social-picker button')].find(button => button.textContent === 'Añadir 2 redes').click();

  const output = await mount(t, '/?social-output=1#tiktok.studio');
  const outputCard = () => output.window.document.querySelector('.social-card');
  const faviconUrl = 'https://a.favicon.im/github.com?larger=true&throw-error-on-404=true';
  for (const [platform, name] of platforms) {
    const dialog = await openEditor(doc, 'Red', name);
    const previewIcon = () => dialog.querySelector('.social-preview .social-icon img');
    if (platform === 'website') {
      const url = [...dialog.querySelectorAll('label')].find(label => label.textContent === 'URL del sitio web').control;
      const enterUrl = value => {
        Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(url, value);
        url.dispatchEvent(new window.Event('input', { bubbles: true }));
      };
      enterUrl('github.com/ruta?consulta=1#seccion');
      await until(() => previewIcon()?.getAttribute('src') === faviconUrl);
      previewIcon().dispatchEvent(new window.Event('load'));
      await until(() => previewIcon() && !previewIcon().hidden);
      enterUrl('http://127.0.0.1:17900');
      await until(() => !previewIcon());
      enterUrl('github.com/ruta?consulta=1#seccion');
      await until(() => previewIcon()?.getAttribute('src') === faviconUrl);
      previewIcon().dispatchEvent(new window.Event('error'));
      await until(() => !previewIcon() && dialog.querySelector('.social-preview .social-icon svg.lucide-globe'));
    }
    const input = dialog.querySelector('[aria-label="Seleccionar imagen para el icono"]');
    assert.ok(input);
    const svg = new window.File(['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 16"><rect width="32" height="16"/></svg>'], 'icono.svg');
    Object.defineProperty(input, 'files', { value: [svg] });
    input.dispatchEvent(new window.Event('change', { bubbles: true }));
    await until(() => previewIcon()?.getAttribute('src') === uploadedSvg);

    const saved = () => requests.find(({ url, body }) => url === '/api/social/save' &&
      body.channels.some(channel => channel.platform === platform && channel.icon === uploadedSvg));
    await until(saved);
    const config = saved().body;
    const channel = config.channels.find(item => item.platform === platform);
    assert.equal(channel.image, '');
    const publishOutput = channel => output.publish({ tools: { social: { config: { ...config, channels: [channel] } } } });
    publishOutput(channel);
    await until(() => outputCard()?.textContent.includes(name));
    assert.equal(outputCard().querySelector('.social-icon img').getAttribute('src'), uploadedSvg);
    if (platform === 'website') {
      const previousRequests = requests.length;
      [...dialog.querySelectorAll('button')].find(button => button.textContent === 'Quitar icono').click();
      await until(() => previewIcon()?.getAttribute('src') === faviconUrl);
      const restored = () => requests.slice(previousRequests).find(({ url, body }) => url === '/api/social/save' &&
        body.channels.some(item => item.platform === platform && !item.icon));
      await until(restored);
      publishOutput(restored().body.channels.find(item => item.platform === platform));
      const outputIcon = () => outputCard()?.querySelector('.social-icon img');
      await until(() => outputIcon()?.getAttribute('src') === faviconUrl);
      outputIcon().dispatchEvent(new output.window.Event('load'));
      await until(() => outputIcon() && !outputIcon().hidden);
    }
    dialog.querySelector('[aria-label="Cerrar editor de red"]').click();
    await until(() => !doc.querySelector('.social-dialog-editor'));
  }
});

test('Social Media Rotator accepts icons on branded and QR channels and saves their backdrop styles', async t => {
  const editor = await mount(t, '/social');
  const channels = [defaultSocial.channels[0], { id: 'qr', platform: 'qr', label: 'QR', enabled: true, url: 'https://example.com' }];
  editor.publish({
    token: 'test', settings: defaults, tts: { resources: {}, queued: 0 }, events: [],
    tools: { layout: {}, ads: {}, social: { config: { ...defaultSocial, channels }, revision: 10 } },
  });
  const { window, requests } = editor;
  const doc = window.document;
  const upload = dialog => {
    const input = dialog.querySelector('[aria-label="Seleccionar imagen para el icono"]');
    assert.ok(input);
    Object.defineProperty(input, 'files', { value: [new window.File(['<svg xmlns="http://www.w3.org/2000/svg"/>'], 'icono.svg')] });
    input.dispatchEvent(new window.Event('change', { bubbles: true }));
  };
  const dialog = await openEditor(doc, 'Red');
  const icon = () => dialog.querySelector('.social-preview .social-icon');
  upload(dialog);
  await until(() => icon().querySelector('img')?.getAttribute('src') === uploadedSvg);
  await selectEditorTab(dialog, 'Estilo');
  const field = label => [...dialog.querySelectorAll('label')].find(item => item.textContent === label).control;
  for (const [label, value] of [['Forma del fondo del icono', 'circle'], ['Color del fondo del icono', 'light']]) {
    const select = field(label);
    select.value = value;
    select.dispatchEvent(new window.Event('change', { bubbles: true }));
  }
  await until(() => icon().dataset.shape === 'circle' && icon().dataset.backdrop === 'light');
  field('Mostrar fondo del icono').click();
  await until(() => icon().dataset.backdrop === 'none');
  assert.equal(icon().querySelector('img').getAttribute('src'), uploadedSvg);
  dialog.querySelector('[aria-label="Cerrar editor de red"]').click();
  await until(() => !doc.querySelector('.social-dialog-editor'));

  const qrDialog = await openEditor(doc, 'Red', 'QR');
  const qr = () => qrDialog.querySelector('.social-preview .social-qr');
  await until(qr);
  const qrCode = qr().getAttribute('src');
  upload(qrDialog);
  await until(() => qrDialog.querySelector('.social-preview .social-icon img')?.getAttribute('src') === uploadedSvg);
  assert.equal(qr().getAttribute('src'), qrCode);
  const saved = () => requests.find(({ url, body }) => url === '/api/social/save' && body.channels.every(channel => channel.icon === uploadedSvg) &&
    body.channels[0].design?.showIconBackdrop === false);
  await until(saved);
  const config = saved().body;
  assert.equal(config.channels[0].design.iconShape, 'circle');
  assert.equal(config.channels[0].design.iconBackdropStyle, 'light');

  const output = await mount(t, '/?social-output=1#tiktok.studio');
  output.publish({ tools: { social: { config } } });
  const outputIcon = () => output.window.document.querySelector('.social-card .social-icon');
  await until(() => outputIcon()?.dataset.backdrop === 'none');
  assert.equal(outputIcon().querySelector('img').getAttribute('src'), uploadedSvg);
  output.publish({ tools: { social: { config: { ...config, channels: [config.channels[1]] } } } });
  await until(() => output.window.document.querySelector('.social-card .social-qr'));
  assert.equal(outputIcon().querySelector('img').getAttribute('src'), uploadedSvg);
});
