import { songOutputPath } from '../../shared/routes.js';
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { createSpotifyLocalReader, localPlayback } from './spotify-local.js';
import { appearanceDefaults, validateAppearance, spotifyThemes } from '../../shared/spotify.js';

const defaults = { ...appearanceDefaults, mode: 'local', enabled: true, clientId: '', hideWhenPaused: true, theme: 'dark' };
export const spotifyOutputPath = songOutputPath + '#tiktok.studio';
function validate(value) {
  const config = { ...defaults, ...value };
  if (!['local', 'api'].includes(config.mode) || typeof config.enabled !== 'boolean') throw new Error('Modo de Spotify inválido.');
  if (typeof config.clientId !== 'string' || (config.clientId && !/^[a-f0-9]{32}$/i.test(config.clientId))) throw new Error('Introduce el Client ID de Spotify (32 caracteres).');
  if (typeof config.hideWhenPaused !== 'boolean' || !spotifyThemes.includes(config.theme)) throw new Error('Diseño de Spotify inválido.');
  return { ...validateAppearance(config), mode: config.mode, enabled: config.enabled, clientId: config.clientId, hideWhenPaused: config.hideWhenPaused, theme: config.theme };
}
const safeUrl = (value, host) => {
  try { const url = new URL(value); return url.protocol === 'https:' && url.hostname === host ? url.href : ''; } catch { return ''; }
};
export function createSpotifyModule({ dataDir, changed, fetchImpl = fetch, now = Date.now, localReader = createSpotifyLocalReader() }) {
  const file = path.join(dataDir, 'spotify.json');
  let config = { ...defaults }, auth = null, pending = null, playback = null, error = '';
  let generation = 0, busy = false, closed = false, nextPoll = 0, exchanging = null;
  let localAvailable = false;
  try {
    const saved = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
    config = validate(saved.config);
    if (config.clientId && typeof saved.auth?.refreshToken === 'string') auth = saved.auth;
  } catch (e) { if (e.code !== 'ENOENT') error = 'No se pudo cargar la configuración de Spotify. Guarda los ajustes para repararla.'; }
  function persist(nextConfig = config, nextAuth = auth) {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(file + '.tmp', JSON.stringify({ config: nextConfig, auth: nextAuth }, null, 2), { mode: 0o600 });
    fs.renameSync(file + '.tmp', file);
  }
  async function request(url, options = {}) {
    try { return await fetchImpl(url, { ...options, signal: AbortSignal.timeout(10000) }); }
    catch { throw new Error('No se pudo conectar con Spotify. Comprueba tu conexión a Internet.'); }
  }
  function rateLimit(response) {
    const seconds = Number(response.headers.get('retry-after'));
    nextPoll = now() + (Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 60000);
    return new Error('Spotify ha limitado las consultas. Se reintentará automáticamente.');
  }
  async function tokenRequest(params, epoch) {
    const response = await request('https://accounts.spotify.com/api/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: config.clientId, ...params }).toString(),
    });
    if (epoch !== generation || closed) return null;
    if (response.status === 429) throw rateLimit(response);
    if (!response.ok) {
      if (response.status === 400 || response.status === 401) {
        persist(config, null); auth = null;
        throw new Error('La autorización de Spotify venció o no es válida. Vuelve a conectar tu cuenta.');
      }
      throw new Error('Spotify no pudo autorizar la conexión. Inténtalo de nuevo.');
    }
    const data = await response.json();
    if (epoch !== generation || closed) return null;
    if (typeof data.access_token !== 'string' || !Number.isFinite(data.expires_in) || data.expires_in <= 0) throw new Error('Respuesta de autorización de Spotify inválida.');
    const next = { accessToken: data.access_token, refreshToken: data.refresh_token || auth?.refreshToken, expiresAt: now() + data.expires_in * 1000 };
    if (!next.refreshToken) throw new Error('Spotify no entregó una sesión renovable. Vuelve a conectar.');
    persist(config, next); auth = next;
    return auth.accessToken;
  }
  async function health() {
    if (config.mode === 'local') {
      if (closed || busy || !config.enabled || now() < nextPoll) return;
      busy = true;
      const epoch = generation;
      nextPoll = now() + 5000;
      try {
        const result = await localReader.read();
        if (closed || epoch !== generation) return;
        localAvailable = result.available;
        playback = result.available ? localPlayback(result.playback, now()) : null;
        error = '';
      } catch (e) {
        if (!closed && epoch === generation) { localAvailable = false; playback = null; error = e.message; nextPoll = now() + 15000; }
      } finally { busy = false; if (!closed) changed(); }
      return;
    }
    if (pending && pending.expiresAt < now()) { pending = null; error = 'La conexión pendiente venció. Pulsa Conectar Spotify otra vez.'; changed(); }
    if (closed || busy || pending || exchanging !== null || !auth || now() < nextPoll) return;
    busy = true;
    const epoch = generation;
    nextPoll = now() + 5000;
    try {
      let token = auth.accessToken;
      const refresh = () => tokenRequest({ grant_type: 'refresh_token', refresh_token: auth.refreshToken }, epoch);
      if (!token || auth.expiresAt <= now() + 30000) token = await refresh();
      if (!token || epoch !== generation || closed) return;
      let response = await request('https://api.spotify.com/v1/me/player/currently-playing?additional_types=episode', { headers: { Authorization: `Bearer ${token}` } });
      if (epoch !== generation || closed) return;
      if (response.status === 401) {
        token = await refresh();
        if (!token || epoch !== generation || closed) return;
        response = await request('https://api.spotify.com/v1/me/player/currently-playing?additional_types=episode', { headers: { Authorization: `Bearer ${token}` } });
      }
      if (epoch !== generation || closed) return;
      if (response.status === 429) throw rateLimit(response);
      if (response.status === 403) { nextPoll = now() + 60000; throw new Error('Spotify denegó el acceso. Revisa Premium del propietario y Usuarios y acceso en tu app de Spotify.'); }
      if (response.status === 401) { persist(config, null); auth = null; throw new Error('Vuelve a conectar tu cuenta de Spotify.'); }
      if (response.status === 204) playback = null;
      else {
        if (!response.ok) throw new Error('Spotify no pudo consultar la canción. Se reintentará automáticamente.');
        const data = await response.json();
        if (epoch !== generation || closed) return;
        const item = data.item;
        playback = item && ['track', 'episode'].includes(item.type) && !['ad', 'unknown'].includes(data.currently_playing_type) && !data.device?.is_private_session ? {
          title: String(item.name || '').slice(0, 300),
          artist: (item.type === 'episode' ? String(item.show?.name || '') : (item.artists || []).map(a => a.name).join(', ')).slice(0, 400),
          image: safeUrl((item.album?.images || item.images || [])[0]?.url, 'i.scdn.co'),
          url: safeUrl(item.external_urls?.spotify, 'open.spotify.com'),
          duration: Math.max(0, Number(item.duration_ms) || 0), progress: Math.max(0, Number(data.progress_ms) || 0),
          playing: data.is_playing === true, updatedAt: now(),
        } : null;
      }
      error = '';
    } catch (e) {
      if (epoch === generation && !closed) { error = e.message; playback = null; nextPoll = Math.max(nextPoll, now() + 15000); }
    } finally { busy = false; if (!closed) changed(); }
  }
  return {
    state: () => ({ available: true, running: true, connected: config.mode === 'local' ? config.enabled && localAvailable : !!auth, connecting: !!pending || exchanging !== null, config: { ...config }, playback, error, url: spotifyOutputPath }),
    health, start: async () => changed(),
    save(value) {
      const next = validate(value), reset = next.clientId !== config.clientId || next.mode !== config.mode || next.enabled !== config.enabled;
      persist(next, reset ? null : auth);
      if (reset) { generation++; auth = null; pending = null; exchanging = null; playback = null; localAvailable = false; nextPoll = 0; }
      config = next; error = ''; changed();
    },
    connect(origin) {
      if (config.mode === 'local') {
        const next = { ...config, enabled: true }; persist(next, null); config = next;
        generation++; nextPoll = 0; error = ''; changed(); return { local: true };
      }
      if (!config.clientId) throw new Error('Guarda primero el Client ID de tu app de Spotify.');
      if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) throw new Error('Abre el panel desde 127.0.0.1.');
      generation++;
      exchanging = null;
      const verifier = randomBytes(48).toString('base64url');
      pending = { verifier, state: randomBytes(32).toString('hex'), redirectUri: origin + '/api/spotify/callback', expiresAt: now() + 600000 };
      const url = new URL('https://accounts.spotify.com/authorize');
      url.search = new URLSearchParams({ client_id: config.clientId, response_type: 'code', redirect_uri: pending.redirectUri, state: pending.state, scope: 'user-read-currently-playing', code_challenge_method: 'S256', code_challenge: createHash('sha256').update(verifier).digest('base64url') });
      error = ''; playback = null; changed();
      return { authorizationUrl: url.href };
    },
    async callback(params) {
      const state = params.get('state') || '';
      if (!pending || pending.expiresAt < now() || Buffer.byteLength(state) !== Buffer.byteLength(pending.state) || !timingSafeEqual(Buffer.from(state), Buffer.from(pending.state))) throw new Error('Conexión de Spotify inválida o vencida. Vuelve al panel e inténtalo de nuevo.');
      const session = pending, epoch = ++generation;
      pending = null;
      if (params.has('error')) { error = 'No se autorizó la conexión con Spotify.'; changed(); return; }
      const code = params.get('code');
      if (!code || code.length > 4096) throw new Error('Spotify no entregó un código válido.');
      exchanging = epoch;
      try {
        await tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: session.redirectUri, code_verifier: session.verifier }, epoch);
        if (exchanging === epoch) exchanging = null;
        if (epoch === generation && !closed) { nextPoll = 0; error = ''; await health(); }
      } catch (e) { if (epoch === generation && !closed) error = e.message; }
      finally { if (exchanging === epoch) exchanging = null; }
      changed();
    },
    disconnect() {
      const next = { ...config, enabled: false };
      persist(next, null); config = next; generation++; auth = null; pending = null; exchanging = null; playback = null; localAvailable = false; error = ''; nextPoll = 0; changed();
    },
    close() { closed = true; generation++; pending = null; playback = null; localReader.close(); },
  };
}
