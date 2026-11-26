import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createBannersModule } from '../modules/banners/index.js';
import { defaultBanners, migrateBanners, validateBanners, bannersOutputPath } from '../modules/banners/config.js';
import { sanitizeSvg } from '../modules/banners/assets.js';

const asset = '/banner-assets/' + 'a'.repeat(64) + '.png';
const sampleAd = { id: 'ad-1', image: asset, name: 'Campaña de verano', alt: 'Oferta de temporada', advertiser: 'Acme', caption: 'Visita la tienda', enabled: true };
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';

function scratch(t) {
  const dataDir = fs.mkdtempSync(path.resolve('tests/scratch-banners-'));
  t.after(() => {
    const assets = path.join(dataDir, 'banner-assets');
    if (fs.existsSync(assets)) {
      for (const name of fs.readdirSync(assets)) fs.unlinkSync(path.join(assets, name));
      fs.rmdirSync(assets);
    }
    for (const name of fs.readdirSync(dataDir)) fs.unlinkSync(path.join(dataDir, name));
    fs.rmdirSync(dataDir);
  });
  return dataDir;
}

test('banners validate ad settings, animations and creative metadata', () => {
  assert.deepEqual(validateBanners(defaultBanners), defaultBanners);
  const custom = {
    ...defaultBanners,
    ads: [sampleAd],
    interval: 14,
    transition: 900,
    animation: 'wipe',
    exitAnimation: 'curtain',
    position: 'top-right',
    width: 970,
    height: 250,
    fit: 'cover',
    layout: 'caption',
    style: 'glass',
    showCaption: true,
    showAdvertiser: true,
    imageMotion: true,
    labelText: 'PATROCINADO',
  };
  assert.deepEqual(validateBanners(custom), custom);
  for (const [key, value] of [
    ['interval', 2],
    ['transition', 100],
    ['width', 100],
    ['height', 20],
    ['padding', 60],
    ['radius', 90],
    ['opacity', 101],
    ['borderOpacity', -1],
    ['borderWidth', 9],
  ]) {
    assert.throws(() => validateBanners({ ...custom, [key]: value }), /Valor inválido/, key);
  }
  for (const [key, value] of [
    ['animation', 'spin'],
    ['exitAnimation', 'explode'],
    ['position', 'middle'],
    ['layout', 'poster'],
    ['style', 'blur'],
    ['fit', 'stretch'],
    ['random', 'yes'],
    ['fitToCreative', 'yes'],
  ]) {
    assert.throws(() => validateBanners({ ...custom, [key]: value }), undefined, key);
  }
  assert.throws(() => validateBanners({ ...custom, labelText: 'dos\nlineas' }));
  assert.throws(() => validateBanners({ ...custom, customCss: 'x'.repeat(4001) }));
  assert.throws(() => validateBanners({ ...custom, background: 'red' }));
  assert.throws(() => validateBanners({ ...custom, ads: [{ ...sampleAd, image: 'javascript:alert(1)' }] }));
  assert.throws(() => validateBanners({ ...custom, ads: [{ ...sampleAd, image: 'http://example.com/banner.png' }] }));
  assert.throws(() => validateBanners({ ...custom, ads: [{ ...sampleAd, name: 'x'.repeat(61) }] }));
  assert.throws(() => validateBanners({ ...custom, ads: [{ ...sampleAd, enabled: 'yes' }] }));
  assert.throws(() => validateBanners({ ...custom, ads: [sampleAd, sampleAd] }));
  assert.throws(() => validateBanners({ ...custom, ads: Array.from({ length: 25 }, (_, index) => ({ ...sampleAd, id: 'ad-' + index })) }));
  assert.equal(validateBanners({ ...custom, ads: [{ ...sampleAd, image: 'https://cdn.example.com/banner.png' }] }).ads[0].image, 'https://cdn.example.com/banner.png');
  assert.equal(validateBanners({ ...custom, ads: [{ ...sampleAd, alt: undefined }] }).ads[0].alt, '');
  assert.equal(validateBanners({ ...custom, ads: [] }).ads.length, 0);
  assert.equal(migrateBanners({ ...defaultBanners, transition: 20 }).transition, 650);
  assert.equal(migrateBanners({ ...defaultBanners, transition: 800 }).transition, 800);
  assert.equal(migrateBanners({ ...defaultBanners, fitToCreative: undefined }).fitToCreative, true);
});

test('SVG creatives keep animations and reject executable content', () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><style>@keyframes pulse{from{opacity:.2}to{opacity:1}}.dot{animation:pulse 1s infinite}</style><rect class="dot" width="10" height="10" onclick="alert(1)"/><script>alert("x")</script><animate attributeName="opacity" values="0;1" dur="1s" repeatCount="indefinite"/></svg>';
  const cleaned = sanitizeSvg(svg);
  assert.doesNotMatch(cleaned, /script|onclick/i);
  assert.match(cleaned, /@keyframes pulse/);
  assert.match(cleaned, /<animate /);
  assert.match(cleaned, /xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(cleaned, /<svg[^>]*width="10"[^>]*height="10"/);
  assert.doesNotMatch(sanitizeSvg('<svg><foreignObject><div>hola</div></foreignObject></svg>'), /foreignObject/i);
  assert.throws(() => sanitizeSvg('<svg><foreignObject><div>hola</div></svg>'), /contenido no permitido/);
  assert.throws(() => sanitizeSvg('<div>no es svg</div>'), /no es un SVG válido/);
  assert.throws(() => sanitizeSvg(''), /vacío/);
});

test('banners save rotations atomically and restore them after restart', t => {
  const dataDir = scratch(t);
  let changes = 0;
  const context = { dataDir, changed() { changes++; }, log() {} };
  const module = createBannersModule(context);
  t.after(() => module.close());
  assert.equal(module.state().url, bannersOutputPath);
  assert.deepEqual(module.state().config.ads, []);
  const design = {
    ...defaultBanners,
    interval: 12,
    animation: 'wipe',
    exitAnimation: 'fade',
    position: 'top-center',
    ads: [sampleAd, { ...sampleAd, id: 'ad-2', name: 'Segunda campaña', enabled: false }],
  };
  const before = module.state().revision;
  module.save(design);
  assert.ok(changes > 0);
  assert.ok(module.state().revision > before);
  assert.equal(module.state().config.ads[0].name, 'Campaña de verano');
  assert.equal(module.state().config.ads[1].enabled, false);
  assert.throws(() => module.save({ ...design, interval: 1 }));
  assert.equal(module.state().config.interval, 12);

  const reopened = createBannersModule(context);
  t.after(() => reopened.close());
  assert.equal(reopened.state().config.animation, 'wipe');
  assert.equal(reopened.state().config.exitAnimation, 'fade');
  assert.equal(reopened.state().config.position, 'top-center');
  assert.equal(reopened.state().config.ads.length, 2);
  assert.equal(reopened.state().error, '');
});

test('banner assets store raster images and sanitized animated SVGs', t => {
  const dataDir = scratch(t);
  const module = createBannersModule({ dataDir, changed() {}, log() {} });
  t.after(() => module.close());
  const upload = module.assets.upload({ data: 'data:image/png;base64,' + png });
  assert.match(upload.image, /^\/banner-assets\/[a-f0-9]{64}\.png$/);
  const stored = module.assets.read(upload.image.split('/').pop());
  assert.equal(stored.mime, 'image/png');
  assert.deepEqual(stored.bytes, Buffer.from(png, 'base64'));
  assert.equal(module.assets.upload({ data: 'data:image/png;base64,' + png }).image, upload.image);

  const svg = '<svg xmlns="http://www.w3.org/2000/svg"><style>.a{animation:pulse 1s infinite}@keyframes pulse{to{opacity:.5}}</style><script>alert(1)</script><rect class="a" width="8" height="8"/></svg>';
  const vector = module.assets.upload({ data: 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64') });
  assert.match(vector.image, /^\/banner-assets\/[a-f0-9]{64}\.svg$/);
  const savedSvg = module.assets.read(vector.image.split('/').pop());
  assert.equal(savedSvg.mime, 'image/svg+xml');
  assert.doesNotMatch(savedSvg.bytes.toString('utf8'), /script/i);
  assert.match(savedSvg.bytes.toString('utf8'), /@keyframes pulse/);

  assert.equal(module.assets.read('no-existe.png'), null);
  assert.throws(() => module.assets.upload({ data: 'data:image/png;base64,aGVsbG8=' }), /formato de imagen/);
  assert.throws(() => module.assets.upload({ data: 'data:text/plain;base64,aGVsbG8=' }), /PNG, JPG/);
  assert.throws(() => module.assets.upload({ data: 'data:image/svg+xml;base64,' + Buffer.from('<div>hola</div>').toString('base64') }), /no es un SVG válido/);
});
