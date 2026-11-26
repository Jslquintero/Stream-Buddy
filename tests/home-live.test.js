import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import { defaults } from '../backend/settings.js';
import { defaultNotifications } from '../modules/notifications/config.js';
import { defaultLikes } from '../modules/likes/config.js';
import { defaultGifters } from '../modules/gifters/config.js';
import { defaultAuction } from '../modules/auction/config.js';
import { defaultSocial } from '../modules/social/config.js';
import { defaultBanners } from '../modules/banners/config.js';
import { defaultCommands } from '../modules/commands/config.js';

const pause = () => new Promise(resolve => setTimeout(resolve, 30));
async function until(check) {
  for (let i = 0; i < 100; i++) {
    if (check()) return;
    await pause();
  }
  assert.ok(check(), 'La interfaz no respondió a tiempo');
}

async function mount(t) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://127.0.0.1:17900/', runScripts: 'outside-only', pretendToBeVisual: true });
  t.after(() => dom.window.close());
  const { window } = dom;
  let stream;
  window.EventSource = class { constructor() { stream = this; } close() {} };
  window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  window.fetch = async () => ({ ok: true, json: async () => ({ ok: true }) });
  const html = fs.readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
  window.eval(fs.readFileSync(new URL('../dist' + html.match(/src="([^"]+\.js)"/)[1], import.meta.url), 'utf8'));
  await until(() => stream);
  return {
    window,
    publish: state => stream.onmessage({ data: JSON.stringify(state) }),
    disconnect: () => stream.onerror(),
  };
}

test('home shows live state, onboarding and typed connection notices', async t => {
  const { window, publish, disconnect } = await mount(t);
  const state = {
    token: 'test',
    settings: { ...defaults, Username: 'usuario' },
    tts: { connected: false, connector: true, resources: {}, queued: 2 },
    events: [{ time: '12:00:00', text: 'Centro iniciado' }],
    tools: {
      layout: { running: true, compositions: [] },
      ads: { available: true, running: false },
      notifications: { config: structuredClone(defaultNotifications), queued: 1, url: '/?notifications-output=1#tiktok.studio' },
      likes: { config: structuredClone(defaultLikes), updatedAt: Date.now() - 15000, participants: 4, total: 2400, url: '/?likes-output=1#tiktok.studio' },
      gifters: { config: structuredClone(defaultGifters), updatedAt: 0, participants: 0, totalGifts: 0, totalDiamonds: 0, url: '/?gifters-output=1#tiktok.studio' },
      auction: { config: structuredClone(defaultAuction), status: 'idle', round: 0, participants: 0, url: '/?auction-output=1#tiktok.studio' },
      social: { config: structuredClone(defaultSocial), url: '/?social-output=1#tiktok.studio' },
      banners: { config: structuredClone(defaultBanners), url: '/?banners-output=1#tiktok.studio' },
      commands: { config: structuredClone(defaultCommands), url: '/commands?commands-output=1#tiktok.studio' },
      spotify: { config: { enabled: true }, connected: false, playback: null, url: '/?spotify-output=1#tiktok.studio' },
    },
  };
  publish(state);
  const doc = window.document;
  await until(() => doc.querySelector('.home-status'));

  assert.match(doc.querySelector('.home-banner').textContent, /Prepara tu primer directo/);
  assert.ok(doc.querySelector('.first-run'));
  assert.match(doc.querySelector('.first-run').textContent, /Conecta tu TikTok/);

  const rows = [...doc.querySelectorAll('.home-widget-row')];
  const likes = rows.find(row => row.querySelector('h3')?.textContent === 'Top likes');
  assert.ok(likes);
  assert.equal(likes.querySelector('.home-status').textContent, 'Sin conectar');
  assert.match(likes.querySelector('.home-widget-meta').textContent, /4 usuarios/);

  const social = rows.find(row => row.querySelector('h3')?.textContent === 'Social Media Rotator');
  assert.equal(social.querySelector('.home-status').textContent, 'En pantalla');

  const connect = [...doc.querySelectorAll('.first-run button')].find(button => button.textContent.trim() === 'Conectar');
  assert.ok(connect);
  connect.click();
  await until(() => doc.querySelector('#tiktok-panel'));

  const hide = [...doc.querySelectorAll('.first-run button')].find(button => button.textContent.trim() === 'Ocultar guía');
  assert.ok(hide);
  hide.click();
  await pause();
  assert.equal(doc.querySelector('.first-run'), null);
  assert.ok(window.localStorage.getItem('live-studio.onboarding.v1'));

  disconnect();
  await until(() => doc.querySelector('.toast-error'));
  assert.match(doc.querySelector('.toast-error').textContent, /Sin conexión/);

  publish(state);
  await until(() => doc.querySelector('.toast-success'));
  assert.equal(doc.querySelector('.toast-error'), null);

});
