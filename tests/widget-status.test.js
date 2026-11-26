import { test } from 'node:test';
import assert from 'node:assert/strict';
import { relativeTime, visibleCount, widgetStatus, widgetSummary } from '../web/src/lib/widget-status.js';

test('widget status distinguishes disconnected sources, hidden outputs and stopped tools', () => {
  const state = { tts: { connected: false } };
  assert.equal(widgetStatus({ id: 'likes', tool: { config: { enabled: true } }, state, online: true }).label, 'Sin conectar');
  assert.equal(widgetStatus({ id: 'likes', tool: { config: { enabled: false } }, state, online: true }).label, 'Oculto');
  assert.equal(widgetStatus({ id: 'layout', tool: { running: false }, state, online: true }).label, 'Detenido');
  assert.equal(widgetStatus({ id: 'social', tool: { config: { enabled: true } }, state, online: true }).label, 'En pantalla');
  assert.equal(widgetStatus({ id: 'layout', tool: { running: true }, state, online: false }).label, 'Sin conexión');
});

test('visible count ignores stopped tools and disabled outputs', () => {
  const widgets = [{ id: 'layout' }, { id: 'likes' }, { id: 'spotify' }];
  const tools = {
    layout: { running: true },
    likes: { config: { enabled: true } },
    spotify: { config: { enabled: false } },
  };
  assert.equal(visibleCount(widgets, tools), 2);
});

test('widget summaries read counters and relative activity without inventing data', () => {
  const now = Date.now();
  assert.equal(relativeTime(now - 15000, now), 'hace 15 s');
  const summary = widgetSummary({
    id: 'likes',
    tool: { updatedAt: now - 15000, participants: 4, total: 2400 },
    state: {},
    now,
  });
  assert.match(summary, /4 usuarios/);
  assert.match(summary, /2[.,]?400 likes/);
  assert.match(summary, /hace 15 s/);
  assert.equal(widgetSummary({ id: 'likes', tool: {}, state: {}, now }), 'Esperando likes.');
});
