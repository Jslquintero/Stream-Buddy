import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createSpotifyModule } from '../backend/modules/spotify.js';
import { createSpotifyLocalReader, localPlayback } from '../backend/modules/spotify-local.js';

function fixture(t) {
  const dataDir = fs.mkdtempSync(path.resolve('tests/scratch-spotify-local-'));
  let time = 10000, reads = 0, result = { available: false, playback: null }, closed = false;
  const localReader = { read: async () => { reads++; return typeof result === 'function' ? result() : result; }, close: () => { closed = true; } };
  const options = { dataDir, localReader, now: () => time, changed() {}, fetchImpl() { assert.fail('Local mode must never call Spotify API'); } };
  const module = createSpotifyModule(options);
  t.after(() => { module.close(); for (const name of fs.readdirSync(dataDir)) fs.unlinkSync(path.join(dataDir, name)); fs.rmdirSync(dataDir); });
  return { module, options, set: value => { result = value; }, advance: () => { time += 16000; }, reads: () => reads, closed: () => closed };
}
const song = { title: 'Canción local', artist: 'Artista', duration: 100000, progress: 2000, playing: true, image: 'data:image/png;base64,aGVsbG8=' };
test('local Spotify defaults to Windows without credentials and tracks absence, play and pause', async t => {
  const f = fixture(t);
  assert.equal(f.module.state().config.mode, 'local');
  await f.module.health(); assert.equal(f.module.state().connected, false); assert.equal(f.module.state().error, '');
  f.set({ available: true, playback: song }); f.advance(); await f.module.health();
  assert.equal(f.module.state().connected, true); assert.equal(f.module.state().playback.title, song.title);
  assert.equal(f.module.state().playback.image, song.image);
  await f.module.health(); assert.equal(f.reads(), 2, 'Polling is shared and throttled');
  f.set({ available: true, playback: { ...song, playing: false } }); f.advance(); await f.module.health();
  assert.equal(f.module.state().playback.playing, false);
  f.set({ available: false }); f.advance(); await f.module.health(); assert.equal(f.module.state().playback, null);
});
test('local stop persists, resume needs no OAuth, and in-flight results cannot undo stop', async t => {
  const f = fixture(t); let resolve;
  f.set(() => new Promise(r => { resolve = r; })); const poll = f.module.health();
  f.module.disconnect(); resolve({ available: true, playback: song }); await poll;
  assert.equal(f.module.state().playback, null); assert.equal(f.module.state().config.enabled, false);
  const restored = createSpotifyModule(f.options); t.after(() => restored.close());
  assert.equal(restored.state().config.enabled, false);
  f.advance(); await f.module.health(); assert.equal(f.reads(), 1);
  assert.deepEqual(f.module.connect(), { local: true });
  f.set({ available: true, playback: song }); await f.module.health(); assert.equal(f.module.state().playback.title, song.title);
  f.module.close(); assert.equal(f.closed(), true);
});
test('Windows reader failures clear playback and recover on next poll', async t => {
  const f = fixture(t); f.set({ available: true, playback: song }); await f.module.health();
  f.set(() => { throw new Error('Windows unavailable'); }); f.advance(); await f.module.health();
  assert.equal(f.module.state().playback, null); assert.equal(f.module.state().error, 'Windows unavailable');
  f.set({ available: true, playback: song }); f.advance(); await f.module.health(); assert.equal(f.module.state().error, '');
});
test('switching from Windows to API discards late local data', async t => {
  const f = fixture(t); let resolve;
  f.set(() => new Promise(r => { resolve = r; })); const poll = f.module.health();
  f.module.save({ mode: 'api', clientId: 'a'.repeat(32) });
  resolve({ available: true, playback: song }); await poll;
  assert.equal(f.module.state().connected, false); assert.equal(f.module.state().playback, null);
});
test('local metadata validates cover URLs and bounds progress', () => {
  assert.equal(localPlayback({ ...song, image: 'https://untrusted.test/image', progress: Infinity }, 10).image, '');
  assert.equal(localPlayback({ ...song, progress: 999999 }, 10).progress, song.duration);
  assert.equal(localPlayback({ title: '' }, 10), null);
});
test('Windows adapter runs hidden, enforces timeout, parses UTF-8 and stops its process', async () => {
  let callback, killed = false;
  const reader = createSpotifyLocalReader({ platform: 'win32', execute(command, args, options, done) {
    assert.equal(command, 'powershell.exe'); assert.ok(args.includes('-NonInteractive')); assert.equal(options.windowsHide, true); assert.equal(options.timeout, 12000);
    callback = done; return { kill() { killed = true; callback(new Error('killed')); } };
  } });
  const pending = reader.read(); callback(null, '\uFEFF' + JSON.stringify({ available: true, playback: song }));
  assert.equal((await pending).playback.title, song.title);
  const cancelled = reader.read(); reader.close(); await assert.rejects(cancelled); assert.equal(killed, true);
  await assert.rejects(createSpotifyLocalReader({ platform: 'linux' }).read(), /Windows/);
});
