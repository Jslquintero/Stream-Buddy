import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createSocialModule } from '../modules/social/index.js';
import { defaultSocial, migrateSocial, resolveSocialDesign, resolveSocialLayout, validateSocial, socialOutputPath } from '../modules/social/config.js';
import { socialCardCss, socialCustomCss } from '../modules/social/css.js';

test('social validates channel rotations, platforms and safe links', () => {
  assert.deepEqual(validateSocial(defaultSocial), defaultSocial);
  assert.deepEqual(
    validateSocial({ channels: defaultSocial.channels }),
    defaultSocial,
  );
  const custom = {
    ...defaultSocial,
    heading: 'MIS REDES',
    interval: 12,
    width: 520,
    animation: 'flip',
    position: 'bottom-right',
    random: true,
    channels: [
      { id: 'ig', platform: 'instagram', label: 'Mi Instagram', handle: '@yo', url: 'https://instagram.com/yo', color: '#e1306c', enabled: true, image: '' },
      { id: 'tw', platform: 'twitch', label: 'Twitch', handle: 'micanal', url: '', color: '#9146ff', enabled: false, image: '' },
    ],
  };
  assert.deepEqual(validateSocial(custom), custom);
  assert.throws(() => validateSocial({ ...custom, interval: 1 }));
  assert.throws(() => validateSocial({ ...custom, width: 1000 }));
  assert.throws(() => validateSocial({ ...custom, animation: 'spin' }));
  assert.throws(() => validateSocial({ ...custom, textAnimation: 'spin' }));
  assert.throws(() => validateSocial({ ...custom, textAnimationDuration: 2001 }));
  assert.throws(() => validateSocial({ ...custom, fontFamily: 'url(https://example.com/font.css)' }));
  assert.throws(() => validateSocial({ ...custom, position: 'middle' }));
  assert.throws(() => validateSocial({ ...custom, channels: [{ ...custom.channels[0], layout: 'unknown' }] }));
  assert.throws(() => validateSocial({ ...custom, channels: [{ ...custom.channels[0], design: { width: 1000 } }] }));
  assert.throws(() => validateSocial({ ...custom, heading: 'dos\nlíneas' }));
  assert.throws(() => validateSocial({ ...custom, channels: [] }));
  assert.throws(() => validateSocial({ ...custom, channels: [{ ...custom.channels[0], platform: 'myspace' }] }));
  assert.throws(() => validateSocial({ ...custom, channels: [{ ...custom.channels[0], url: 'javascript:alert(1)' }] }));
  const website = { ...custom.channels[0], platform: 'website', url: 'example.com/pagina?desde=directo' };
  assert.equal(validateSocial({ ...custom, channels: [{ ...website, label: undefined }] }).channels[0].label, '');
  assert.equal(validateSocial({ ...custom, channels: [website] }).channels[0].url, 'https://example.com/pagina?desde=directo');
  assert.throws(() => validateSocial({ ...custom, channels: [{ ...website, url: 'https://user:pass@example.com' }] }));
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
    borderEffect: 'rgb',
    cornerStyle: 'square',
    iconSize: 64,
    textShadow: true,
    shadowColor: '#101010',
    customCss: { glass: '.social-card { border-radius: 44px; }' },
    cssEnabled: true,
    cssTemplates: [{ id: 'mi-tema', name: 'Mi tema', css: '.social-card { border-radius: 44px; }' }],
    channels: [
      { id: 'linkedin', platform: 'linkedin', label: 'LinkedIn', handle: '/yo', url: 'https://linkedin.com/in/yo', color: '#0a66c2', enabled: true, image: '/social-assets/' + 'a'.repeat(64) + '.png' },
      { id: 'bluesky', platform: 'bluesky', label: 'Bluesky', handle: '@yo', url: '', color: '#1185fe', enabled: false, image: '' },
      { id: 'dribbble', platform: 'dribbble', label: 'Dribbble', handle: '', url: '', color: '#ea4c89', enabled: true, image: '' },
    ],
  };
  assert.deepEqual(validateSocial(personalized), personalized);
  assert.equal(personalized.channels.length, 3);
  for (const layout of ['pill', 'stacked', 'banner', 'announcement', 'ticker', 'ribbon']) {
    assert.equal(validateSocial({ ...personalized, layout }).layout, layout);
  }
  assert.equal(migrateSocial({ ...defaultSocial, iconSize: 380 }).iconSize, 56);
  assert.equal(migrateSocial({ ...defaultSocial, iconSize: 64 }).iconSize, 64);
  assert.deepEqual(migrateSocial({ ...defaultSocial, style: 'retro', customCss: '.social-card { color: red; }' }).customCss, { retro: '.social-card { color: red; }' });
  assert.throws(() => validateSocial({ ...personalized, iconSize: 23 }));
  assert.throws(() => validateSocial({ ...personalized, iconSize: 97 }));
  assert.throws(() => validateSocial({ ...personalized, customCss: '.social-card { color: red; }' }));
  assert.throws(() => validateSocial({ ...personalized, customCss: { inventado: '.x{}' } }));
  assert.throws(() => validateSocial({ ...personalized, customCss: { glass: 42 } }));
  assert.throws(() => validateSocial({ ...personalized, customCss: { glass: 'x'.repeat(12001) } }));
  assert.throws(() => validateSocial({ ...personalized, cssEnabled: 'yes' }));
  assert.throws(() => validateSocial({ ...personalized, cssTemplates: [{ id: 'x', name: '', css: '.x{}' }] }));
  assert.throws(() => validateSocial({ ...personalized, cssTemplates: [{ id: 'x', name: 'Vacía', css: '   ' }] }));
  assert.throws(() => validateSocial({ ...personalized, cssTemplates: [{ id: 'x', name: 'Uno', css: 'x'.repeat(12001) }] }));
  assert.throws(() => validateSocial({ ...personalized, cssTemplates: Array.from({ length: 21 }, (_, index) => ({ id: 't-' + index, name: 'Tema ' + index, css: '.x{}' })) }));
  assert.throws(() => validateSocial({ ...personalized, animation: 'spin' }));
  assert.throws(() => validateSocial({ ...personalized, layout: 'default' }));
  assert.throws(() => validateSocial({ ...personalized, style: 'blur' }));
  assert.throws(() => validateSocial({ ...personalized, borderStyle: 'wave' }));
  assert.throws(() => validateSocial({ ...personalized, cornerStyle: 'oval' }));
  assert.throws(() => validateSocial({ ...personalized, borderEffect: 'rainbow' }));
  assert.throws(() => validateSocial({ ...personalized, borderOpacity: 101 }));
  assert.throws(() => validateSocial({ ...personalized, borderWidth: 9 }));
  assert.throws(() => validateSocial({ ...personalized, imageWidth: 79 }));
  assert.throws(() => validateSocial({ ...personalized, imageHeight: 901 }));
  assert.throws(() => validateSocial({ ...personalized, imageFit: 'stretch' }));
  assert.throws(() => validateSocial({ ...personalized, imageCorners: 'diagonal' }));
  assert.throws(() => validateSocial({ ...personalized, imageOffsetX: 51 }));
  assert.throws(() => validateSocial({ ...personalized, imageZoom: 99 }));
  assert.throws(() => validateSocial({ ...personalized, channels: [{ ...personalized.channels[0], image: 'https://example.com/foto.png' }] }));
  assert.equal(validateSocial({ ...personalized, layout: 'photo-left' }).layout, 'photo-left');
  assert.equal(validateSocial({ ...personalized, imageCorners: 'custom', imageRadiusTL: 80 }).imageRadiusTL, 80);
  assert.throws(() => validateSocial({ ...personalized, textShadow: 'yes' }));
  assert.throws(() => validateSocial({ ...personalized, shadowColor: 'red' }));
});

test('social card CSS reflects the current design and keeps one snippet per visual theme', () => {
  const config = validateSocial({
    ...defaultSocial,
    style: 'aurora',
    layout: 'pill',
    customCss: { aurora: '.social-card { outline: 2px solid red; }', noir: '.social-card { color: white; }' },
    cssTemplates: [{ id: 'tema', name: 'Tema guardado', css: '.social-card { padding: 2em; }' }],
  });
  const css = socialCardCss(config);
  assert.match(css, /Tema visual «Aurora»/);
  assert.match(css, /--social-radius: 999px;/);
  assert.match(css, /\.social-card \{ outline: 2px solid red; \}/);
  assert.doesNotMatch(css, /color: white/);
  assert.equal(socialCustomCss({ ...config, style: 'noir' }), '.social-card { color: white; }');
  assert.equal(socialCustomCss({ ...config, style: 'clean' }), '');
  assert.match(socialCardCss({ ...config, cssEnabled: false }), /CSS personalizado desactivado/);
  const iconCss = socialCardCss({ ...config, showIconBackdrop: false, iconShape: 'circle' });
  assert.match(iconCss, /\.social-card \.social-icon \{[^}]+background: transparent;[^}]+box-shadow: none;[^}]+border-radius: 50%;/);
});

test('social stores uploaded photos and rejects external image references', t => {
  const dataDir = fs.mkdtempSync(path.resolve('tests/scratch-social-photo-'));
  const module = createSocialModule({ dataDir, changed() {}, log() {} });
  t.after(() => { module.close(); fs.rmSync(dataDir, { recursive: true, force: true }); });
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';
  const upload = module.assets.upload({ data: 'data:image/png;base64,' + png });
  assert.match(upload.image, /^\/social-assets\/[a-f0-9]{64}\.png$/);
  assert.equal(module.assets.read(upload.image.split('/').pop()).mime, 'image/png');
  const config = module.state().config;
  const channels = config.channels.map((channel, index) => index ? channel : { ...channel, image: upload.image });
  module.save({ ...config, channels, layout: 'photo-left' });
  assert.equal(module.state().config.channels[0].image, upload.image);
  assert.throws(() => module.save({ ...config, channels: [{ ...channels[0], image: 'https://example.com/foto.png' }] }), /Foto de red inválida/);
  assert.throws(() => module.save({ ...config, channels: [{ ...channels[0], image: '/social-assets/no-existe.png' }] }), /Foto de red inválida/);
  const customChannel = { ...config.channels[0], platform: 'custom', icon: upload.image };
  const custom = { ...config, channels: [customChannel], layout: 'custom', image: upload.image, imagePositionY: 100, cornerStyle: 'custom', radiusTR: 0 };
  module.save(custom);
  const reopened = createSocialModule({ dataDir });
  t.after(() => reopened.close());
  assert.equal(reopened.state().config.image, upload.image);
  assert.equal(reopened.state().config.channels[0].icon, upload.image);
  assert.equal(reopened.state().config.imagePositionY, 100);
  assert.equal(reopened.state().config.radiusTR, 0);
  assert.throws(() => module.save({ ...custom, image: 'https://example.com/foto.png' }), /Foto de red inválida/);
  assert.throws(() => module.save({ ...custom, channels: [{ ...customChannel, icon: 'https://example.com/icono.png' }] }), /Icono de red inválido/);
  assert.throws(() => module.save({ ...custom, imagePositionY: 101 }), /imagePositionY/);
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
    textAnimation: 'blur',
    textAnimationDuration: 950,
    fontFamily: 'google:' + 'a'.repeat(24),
    position: 'top-right',
    layoutMode: 'shared',
    channels: defaultSocial.channels.map((channel, index) => ({
      ...channel,
      handle: '@canal' + index,
      ...(index === 1 ? { layout: 'photo-right', design: { width: 620, imageFit: 'contain', customCss: {} } } : {}),
    })),
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
  assert.equal(reopened.state().config.textAnimation, 'blur');
  assert.equal(reopened.state().config.textAnimationDuration, 950);
  assert.equal(reopened.state().config.fontFamily, design.fontFamily);
  assert.equal(reopened.state().config.position, 'top-right');
  assert.equal(reopened.state().config.layoutMode, undefined);
  assert.equal(resolveSocialLayout(reopened.state().config, reopened.state().config.channels[1]), 'photo-right');
  assert.equal(resolveSocialDesign(reopened.state().config, reopened.state().config.channels[1]).width, 620);
  assert.equal(resolveSocialDesign(reopened.state().config, reopened.state().config.channels[0]).width, defaultSocial.width);
  assert.equal(reopened.state().config.channels.length, 3);
  assert.equal(reopened.state().error, '');
});
