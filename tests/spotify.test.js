import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createSpotifyModule } from '../backend/modules/spotify.js';
import { Center } from '../backend/center.js';
import { createDashboardServer } from '../backend/http.js';

const clientId = 'a'.repeat(32);
const song = { currently_playing_type: 'track', is_playing: true, progress_ms: 12000, item: { type: 'track', name: 'Mi canción', artists: [{ name: 'Artista' }], duration_ms: 180000, album: { images: [{ url: 'https://i.scdn.co/image/test' }] }, external_urls: { spotify: 'https://open.spotify.com/track/test' } } };
const response = (data, status = 200, headers = {}) => new Response(status === 204 ? null : JSON.stringify(data), { status, headers });
function fixture(t) {
  const dataDir = fs.mkdtempSync(path.resolve('tests/scratch-spotify-'));
  let clock = 1000000;
  const calls = [], replies = [];
  const options = { dataDir, changed() {}, now: () => clock, fetchImpl: async (url, options) => { calls.push({ url, ...options }); assert.ok(replies.length, 'Unexpected Spotify request'); const reply = replies.shift(); return typeof reply === 'function' ? reply() : reply; } };
  const spotify = createSpotifyModule(options);
  t.after(() => { spotify.close(); for (const name of fs.readdirSync(dataDir)) fs.unlinkSync(path.join(dataDir, name)); fs.rmdirSync(dataDir); });
  spotify.save({ clientId, mode: 'api' });
  async function authorize(play = song) {
    const url = new URL(spotify.connect('http://127.0.0.1:17900').authorizationUrl);
    replies.push(response({ access_token: 'secret-access', refresh_token: 'secret-refresh', expires_in: 3600 }), response(play));
    await spotify.callback(new URLSearchParams({ state: url.searchParams.get('state'), code: 'code' }));
    return url;
  }
  return { spotify, dataDir, options, calls, replies, authorize, advance: ms => { clock += ms; } };
}
test('Spotify PKCE binds callback, keeps tokens private and restores session', async t => {
  const f = fixture(t), url = await f.authorize();
  assert.equal(url.searchParams.get('scope'), 'user-read-currently-playing');
  assert.equal(url.searchParams.get('redirect_uri'), 'http://127.0.0.1:17900/api/spotify/callback');
  const tokenBody = new URLSearchParams(f.calls[0].body);
  assert.equal(createHash('sha256').update(tokenBody.get('code_verifier')).digest('base64url'), url.searchParams.get('code_challenge'));
  assert.equal(f.spotify.state().playback.title, 'Mi canción');
  assert.doesNotMatch(JSON.stringify(f.spotify.state()), /secret-|code_verifier/);
  const restored = createSpotifyModule(f.options); t.after(() => restored.close());
  assert.equal(restored.state().connected, true);
  await assert.rejects(f.spotify.callback(new URLSearchParams({ state: url.searchParams.get('state'), code: 'replay' })));
});
test('Spotify rejects incorrect, expired and cancelled authorization', async t => {
  const f = fixture(t);
  let url = new URL(f.spotify.connect('http://127.0.0.1:17901').authorizationUrl);
  await assert.rejects(f.spotify.callback(new URLSearchParams({ state: 'wrong', code: 'bad' })));
  f.advance(600001);
  await assert.rejects(f.spotify.callback(new URLSearchParams({ state: url.searchParams.get('state'), code: 'expired' })));
  url = new URL(f.spotify.connect('http://127.0.0.1:17901').authorizationUrl);
  await f.spotify.callback(new URLSearchParams({ state: url.searchParams.get('state'), error: 'access_denied' }));
  assert.equal(f.calls.length, 0); assert.equal(f.spotify.state().connecting, false);
  assert.match(f.spotify.state().error, /No se autorizó/);
});
test('Spotify refreshes expired access and preserves refresh token when omitted', async t => {
  const f = fixture(t); await f.authorize(); f.advance(3600000);
  f.replies.push(response({ access_token: 'new-access', expires_in: 3600 }), response(song));
  await f.spotify.health();
  assert.equal(new URLSearchParams(f.calls[2].body).get('refresh_token'), 'secret-refresh');
  assert.equal(f.calls[3].headers.Authorization, 'Bearer new-access');
  assert.equal(JSON.parse(fs.readFileSync(path.join(f.dataDir, 'spotify.json'))).auth.refreshToken, 'secret-refresh');
});
test('Spotify retries 401 once, respects rate limits and clears old playback', async t => {
  const f = fixture(t); await f.authorize(); f.advance(5000);
  f.replies.push(response({}, 401), response({ access_token: 'renewed', expires_in: 3600 }), response({}, 429, { 'retry-after': '120' }));
  await f.spotify.health(); assert.equal(f.spotify.state().playback, null);
  assert.match(f.spotify.state().error, /limitado/);
  const count = f.calls.length; f.advance(119000); await f.spotify.health(); assert.equal(f.calls.length, count);
  f.advance(1000); f.replies.push(response(song)); await f.spotify.health(); assert.equal(f.spotify.state().error, '');
});
test('Spotify handles pause, no playback, private playback and podcasts', async t => {
  const f = fixture(t); await f.authorize({ ...song, is_playing: false }); assert.equal(f.spotify.state().playback.playing, false);
  for (const reply of [response(null, 204), response({ ...song, item: null }), response({ ...song, device: { is_private_session: true } })]) {
    f.advance(5000); f.replies.push(reply); await f.spotify.health(); assert.equal(f.spotify.state().playback, null);
  }
  f.advance(5000); f.replies.push(response({ ...song, item: { type: 'episode', name: 'Episodio', show: { name: 'Podcast' }, images: [{ url: 'javascript:bad' }] } }));
  await f.spotify.health(); assert.equal(f.spotify.state().playback.artist, 'Podcast'); assert.equal(f.spotify.state().playback.image, '');
});
test('Spotify disconnect prevents in-flight responses restoring playback or tokens', async t => {
  const f = fixture(t); await f.authorize(); f.advance(3600000);
  let resolve; f.replies.push(() => new Promise(r => { resolve = r; }));
  const poll = f.spotify.health(); f.spotify.disconnect(); resolve(response({ access_token: 'late-secret', refresh_token: 'late-refresh', expires_in: 3600 })); await poll;
  assert.equal(f.spotify.state().connected, false); assert.equal(f.spotify.state().playback, null);
  assert.equal(JSON.parse(fs.readFileSync(path.join(f.dataDir, 'spotify.json'))).auth, null);
});
test('Spotify prevents overlapping polls and invalidates sessions on client change', async t => {
  const f = fixture(t); await f.authorize(); f.advance(5000);
  let resolve; f.replies.push(() => new Promise(r => { resolve = r; }));
  const poll = f.spotify.health(); await f.spotify.health(); assert.equal(f.calls.length, 3);
  f.spotify.save({ clientId: 'b'.repeat(32) }); resolve(response(song)); await poll;
  assert.equal(f.spotify.state().connected, false); assert.equal(f.spotify.state().playback, null);
  assert.throws(() => f.spotify.save({ clientId: 'bad' }));
});
test('Spotify invalid refresh requires reconnection without leaking response body', async t => {
  const f = fixture(t); await f.authorize(); f.advance(3600000);
  f.replies.push(response({ error: 'secret-provider-body' }, 400)); await f.spotify.health();
  assert.equal(f.spotify.state().connected, false); assert.doesNotMatch(f.spotify.state().error, /secret-provider-body/);
});
test('Spotify HTTP connect requires CSRF token and callback validates OAuth state', async t => {
  const f = fixture(t);
  const center = new Center({ root: path.resolve('.'), dataDir: f.dataDir, tools: {}, processes: { close: async () => {}, stop: async () => {} } });
  const app = createDashboardServer(center);
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve)); t.after(() => app.close());
  const origin = 'http://127.0.0.1:' + app.server.address().port;
  const snapshot = await (await fetch(origin + '/api/state')).json();
  assert.equal((await fetch(origin + '/api/spotify/connect', { method: 'POST' })).status, 403);
  const result = await (await fetch(origin + '/api/spotify/connect', { method: 'POST', headers: { 'X-Studio': snapshot.token }, body: '{}' })).json();
  const url = new URL(result.authorizationUrl);
  assert.equal(url.searchParams.get('redirect_uri'), origin + '/api/spotify/callback');
  assert.equal((await fetch(origin + '/api/spotify/callback?state=wrong&code=bad')).status, 400);
  const cancelled = await fetch(origin + '/api/spotify/callback?' + new URLSearchParams({ state: url.searchParams.get('state'), error: 'access_denied' }), { redirect: 'manual' });
  assert.equal(cancelled.status, 303); assert.equal(cancelled.headers.get('location'), '/music');
  assert.equal((await fetch(origin + '/music')).status, 200);
  assert.equal((await fetch(origin + '/cancion-actual')).url, origin + '/music');
  assert.equal((await fetch(origin + '/output/cancion-actual')).url, origin + '/output/music');
  assert.equal((await fetch(origin + '/spotify', { redirect: 'manual' })).headers.get('location'), '/music');
});

test('Spotify appearance persists and rejects unsafe media settings', t => {
  const f = fixture(t);
  f.spotify.save({ clientId, mode:'api', playerStyle:'gallery', coverStyle:'canvas', canvasUrl:'https://example.com/loop.mp4', coverGlow:true, coverBlur:true, magicColors:true, tintColor:'#aa3377', revealAnimation:'swing-left', exitAnimation:'tilt-right', idleCover:'data:image/png;base64,YQ==' });
  const restored = createSpotifyModule(f.options); t.after(() => restored.close());
  assert.equal(restored.state().config.playerStyle,'gallery');
  assert.equal(restored.state().config.coverGlow,true);
  assert.equal(restored.state().config.exitAnimation,'tilt-right');
  for (const invalid of [{canvasUrl:'javascript:alert(1)'},{idleCover:'data:image/svg+xml;base64,YQ=='},{playerStyle:'bad'},{tintColor:'red'},{coverGlow:'true'}]) assert.throws(() => f.spotify.save({clientId,...invalid}));
  assert.equal(f.spotify.state().config.playerStyle,'gallery');
});

test('Spotify persists per-skin CSS and canvas dimensions with bounded settings', t => {
  const f = fixture(t);
  const customCss = { compact:'.spotify-title { color: coral; }', gallery:'.spotify-now { height: 500px; }' };
  f.spotify.save({clientId, mode:'api', customCss, cssEnabled:false, outputWidth:720, outputHeight:520});
  const restored = createSpotifyModule(f.options); t.after(() => restored.close());
  assert.deepEqual(restored.state().config.customCss, customCss);
  assert.equal(restored.state().config.cssEnabled,false);
  assert.equal(restored.state().config.outputWidth,720);
  assert.equal(restored.state().config.outputHeight,520);
  for (const invalid of [{customCss:null},{customCss:[]},{customCss:{invalid:''}},{customCss:{compact:12}},{customCss:{compact:'x'.repeat(12001)}},{outputWidth:79},{outputHeight:2561},{outputWidth:100.5},{cssEnabled:'true'}]) assert.throws(() => f.spotify.save({clientId,...invalid}));
  assert.deepEqual(f.spotify.state().config.customCss,customCss);
});

test('Spotify keeps colored themes, vinyl and tint after reopening', t => {
  const f = fixture(t);
  for (const theme of ['dark','light','tinted','gradient','transparent']) {
    f.spotify.save({ clientId, mode:'api', theme, tintColor:'#7944a1', coverStyle:'vinyl', playerStyle:'gallery' });
    const reopened = createSpotifyModule(f.options);
    try {
      assert.equal(reopened.state().config.theme,theme);
      assert.equal(reopened.state().config.tintColor,'#7944a1');
      assert.equal(reopened.state().config.coverStyle,'vinyl');
      assert.equal(reopened.state().config.playerStyle,'gallery');
    } finally { reopened.close(); }
  }
  assert.throws(() => f.spotify.save({clientId,theme:'invalid'}));
});
