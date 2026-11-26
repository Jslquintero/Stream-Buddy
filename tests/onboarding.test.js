import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readOnboarding, writeOnboarding } from '../web/src/lib/onboarding.js';

test('onboarding preferences are sanitized and restored', () => {
  const store = new Map();
  const previous = globalThis.window;
  globalThis.window = { localStorage: {
    getItem: key => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, value),
  } };
  try {
    assert.deepEqual(readOnboarding(), { dismissed: false, copied: false, added: false, completed: false });
    writeOnboarding({ copied: true, added: true });
    assert.deepEqual(readOnboarding(), { dismissed: false, copied: true, added: true, completed: false });
    store.set('live-studio.onboarding.v1', '{broken');
    assert.deepEqual(readOnboarding(), { dismissed: false, copied: false, added: false, completed: false });
  } finally {
    globalThis.window = previous;
  }
});
