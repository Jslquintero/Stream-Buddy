import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createSocialModule } from '../modules/social/index.js';
import { defaultSocial, migrateSocial, validateSocial, socialOutputPath } from '../modules/social/config.js';

test('social validates channel rotations, platforms and safe links', () => {
  assert.deepEqual(validateSocial(defaultSocial), defaultSocial);
  const custom = {
    ...defaultSocial,
    heading: 'MIS REDES',
    interval: 12,
    width: 520,
    animation: 'flip',
    position: 'bottom-right',
    random: true,
    channels: [
      { id: 'ig', platform: 'instagram', label: 'Mi Instagram', handle: '@yo', url: 'https://instagram.com/yo', color: '#e1306c', enabled: true },
      { id: 'tw', platform: 'twitch', label: 'Twitch', handle: 'micanal', url: '', color: '#9146ff', enabled: false },
    ],
  };
  assert.deepEqual(validateSocial(custom), custom);
  assert.throws(() => validateSocial({ ...custom, interval: 1 }));
  assert.throws(() => validateSocial({ ...custom, width: 1000 }));
  assert.throws(() => validateSocial({ ...custom, animation: 'spin' }));
  assert.throws(() => validateSocial({ ...custom, position: 'middle' }));
  assert.throws(() => validateSocial({ ...custom, heading: 'dos\nlíneas' }));
  assert.throws(() => validateSocial({ ...custom, channels: [] }));
  assert.throws(() => validateSocial({ ...custom, channels: [{ ...custom.channels[0], platform: 'myspace' }] }));
  assert.throws(() => validateSocial({ ...custom, channels: [{ ...custom.channels[0], url: 'javascript:alert(1)' }] }));
  assert.throws(() => validateSocial({ ...custom, channels: [{ ...custom.channels[0], color: 'red' }] }));
  assert.throws(() => validateSocial({ ...custom, channels: [custom.channels[0], custom.channels[0]] }));
  assert.throws(() => validateSocial({ ...custom, channels: Array.from({ length: 26 }, (_, index) => ({ ...custom.channels[0], id: 'red-' + index })) }));
});

test('social accepts new platforms, icon sizes and custom CSS', () => {
  const personalized = {
    ...defaultSocial,
    animation: 'float',
    position: 'top-center',
    layout: 'slim',
    style: 'glass',
    borderStyle: 'dashed',
    borderOpacity: 40,
    borderWidth: 2,
    iconSize: 64,
    textShadow: true,
    shadowColor: '#101010',
    customCss: '.social-card { border-radius: 44px; }',
    channels: [
      { id: 'linkedin', platform: 'linkedin', label: 'LinkedIn', handle: '/yo', url: 'https://linkedin.com/in/yo', color: '#0a66c2', enabled: true },
      { id: 'bluesky', platform: 'bluesky', label: 'Bluesky', handle: '@yo', url: '', color: '#1185fe', enabled: false },
      { id: 'dribbble', platform: 'dribbble', label: 'Dribbble', handle: '', url: '', color: '#ea4c89', enabled: true },
    ],
  };
  assert.deepEqual(validateSocial(personalized), personalized);
  assert.equal(personalized.channels.length, 3);
  for (const layout of ['pill', 'stacked', 'banner', 'announcement', 'ticker', 'ribbon']) {
    assert.equal(validateSocial({ ...personalized, layout }).layout, layout);
  }
  assert.equal(migrateSocial({ ...defaultSocial, iconSize: 380 }).iconSize, 56);
  assert.equal(migrateSocial({ ...defaultSocial, iconSize: 64 }).iconSize, 64);
  assert.throws(() => validateSocial({ ...personalized, iconSize: 23 }));
  assert.throws(() => validateSocial({ ...personalized, iconSize: 97 }));
  assert.throws(() => validateSocial({ ...personalized, customCss: 'x'.repeat(4001) }));
  assert.throws(() => validateSocial({ ...personalized, animation: 'spin' }));
  assert.throws(() => validateSocial({ ...personalized, layout: 'default' }));
  assert.throws(() => validateSocial({ ...personalized, style: 'blur' }));
  assert.throws(() => validateSocial({ ...personalized, borderStyle: 'wave' }));
  assert.throws(() => validateSocial({ ...personalized, borderOpacity: 101 }));
  assert.throws(() => validateSocial({ ...personalized, borderWidth: 9 }));
  assert.throws(() => validateSocial({ ...personalized, textShadow: 'yes' }));
  assert.throws(() => validateSocial({ ...personalized, shadowColor: 'red' }));
});

test('social saves rotations atomically and restores them after restart', t => {
  const dataDir = fs.mkdtempSync(path.resolve('tests/scratch-social-'));
  let changes = 0;
  const context = { dataDir, changed() { changes++; }, log() {} };
  const module = createSocialModule(context);
  t.after(() => {
    module.close();
    for (const name of fs.readdirSync(dataDir)) fs.unlinkSync(path.join(dataDir, name));
    fs.rmdirSync(dataDir);
  });
  assert.equal(module.state().url, socialOutputPath);
  assert.equal(module.state().config.enabled, true);
  const design = {
    ...defaultSocial,
    heading: 'SÍGUEME',
    interval: 8,
    animation: 'bounce',
    position: 'top-right',
    channels: defaultSocial.channels.map((channel, index) => ({ ...channel, handle: '@canal' + index })),
  };
  const before = module.state().revision;
  module.save(design);
  assert.ok(changes > 0);
  assert.ok(module.state().revision > before);
  assert.equal(module.state().config.heading, 'SÍGUEME');
  assert.equal(module.state().config.channels[1].handle, '@canal1');
  assert.throws(() => module.save({ ...design, interval: 0 }));
  assert.equal(module.state().config.interval, 8);

  const reopened = createSocialModule(context);
  t.after(() => reopened.close());
  assert.equal(reopened.state().config.animation, 'bounce');
  assert.equal(reopened.state().config.position, 'top-right');
  assert.equal(reopened.state().config.channels.length, 3);
  assert.equal(reopened.state().error, '');
});
