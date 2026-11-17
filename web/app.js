let state, view = 'home', discoveredTTS = false;
const $ = selector => document.querySelector(selector);
const titles = { home: 'Centro de stream', tts: 'Dale voz a tu comunidad.', layout: 'Diseña tu próxima escena.', ads: 'Tus anuncios, en orden.' };
function notice(text) { $('#notice').textContent = text; }
function show(name) {
  view = name;
  document.querySelectorAll('.view').forEach(e => { e.hidden = e.id !== name; });
  document.querySelectorAll('nav button').forEach(e => e.classList.toggle('active', e.dataset.view === name));
  $('#title').textContent = titles[name]; loadFrames();
  if (name === 'tts' && !discoveredTTS && state && !state.tts.resources?.task?.running) { discoveredTTS = true; void api('tts/refresh'); }
}
function loadFrames() {
  if (!state) return;
  document.querySelectorAll('iframe').forEach(frame => {
    const key = frame.dataset.tool;
    if (!state.tools[key].running && frame.getAttribute('src')) frame.removeAttribute('src');
    if (view === key && state.tools[key].running && !frame.getAttribute('src')) frame.src = state.tools[key].url;
  });
}
function render(next) {
  state = next;
  ttsUI.render(state);
  for (const key of ['layout', 'ads']) {
    const tool = state.tools[key];
    $('#' + key + '-status').textContent = tool.running ? '● En ejecución' : tool.starting ? '◌ Iniciando…' : !tool.available ? '○ Archivos no encontrados' : tool.error ? '○ Revisa la actividad' : '○ Detenido';
    $('#' + key + '-status').classList.toggle('on', tool.running);
  }
  const t = state.tts;
  $('#tts-status').textContent = t.connected ? '● Conectado al LIVE' : '● Motor de voz disponible';
  $('#tts-status').classList.add('on');
  $('#connection').textContent = t.installing ? 'Instalando… revisa la actividad.' : t.connected ? 'Conectado al LIVE' : t.connecting ? 'Conectando al LIVE…' : t.connector ? 'Conector disponible. Guarda tu usuario y conecta.' : 'Instala el conector para recibir comentarios.';
  $('#install').disabled = t.installing || t.connected || t.connecting;
  $('#install').textContent = t.connector ? 'Reinstalar conector' : 'Instalar conector';
  $('#connect').disabled = t.connected || t.connecting || !t.connector || t.installing;
  $('#disconnect').disabled = !t.connected && !t.connecting;
  $('#queue').textContent = `${t.queued} en cola · ${t.paused ? 'Pausado' : t.speaking ? 'Reproduciendo' : 'Listo para leer'}`;
  $('#pause').textContent = t.paused ? 'Reanudar' : 'Pausar';
  if ($('#global-account')) {
    $('#global-account').textContent = state.settings.Username ? '@' + state.settings.Username.replace(/^@/, '') : 'TikTok LIVE';
    $('#global-connection').textContent = t.connected ? 'Conectado' : t.connecting ? 'Conectando…' : 'Sin conectar';
    $('#global-dot').classList.toggle('online', t.connected);
  }
  $('#events').replaceChildren(...state.events.slice().reverse().map(event => {
    const p = document.createElement('p'), time = document.createElement('time');
    time.textContent = event.time; p.append(time, document.createTextNode(event.text)); return p;
  }));
  loadFrames();
}
async function refresh() {
  const response = await fetch('/api/state');
  if (!response.ok) throw new Error('No se pudo consultar el servidor');
  render(await response.json());
}
async function api(action, body = {}) {
  try {
    if (!state) await refresh();
    const response = await fetch('/api/' + action, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Studio': state.token }, body: JSON.stringify(body) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    return true;
  } catch (error) { notice(error.message); return false; }
}
document.querySelectorAll('[data-view]').forEach(b => { b.onclick = () => show(b.dataset.view); });
document.querySelectorAll('[data-open]').forEach(b => { b.onclick = async () => { show(b.dataset.open); await api('start', { tool: b.dataset.open }); }; });
document.querySelectorAll('[data-start]').forEach(b => { b.onclick = () => api('start', { tool: b.dataset.start }); });
for (const action of ['install', 'disconnect', 'pause', 'skip', 'stop']) $('#' + action).onclick = () => api(action);
const ttsUI = createTTSController({ api, getState: () => state, notice });
$('#test').onclick = () => api('test', { text: $('#test-text').value });
$('#start-all').onclick = async () => {
  const layout = await api('start', { tool: 'layout' }), ads = await api('start', { tool: 'ads' });
  if (layout && ads) notice('Inicio solicitado. El estado y los errores aparecerán en tiempo real.');
};
$('#copy-output').onclick = async () => {
  const url = 'http://127.0.0.1:17843/output#tiktok.studio';
  try { await navigator.clipboard.writeText(url); notice('Enlace de salida copiado. Pégalo en tu fuente Link de LIVE Studio.'); }
  catch { notice('Enlace: ' + url); }
};
const stream = new EventSource('/api/events');
stream.onmessage = event => {
  render(JSON.parse(event.data));
  if ($('#notice').dataset.disconnected) { notice('Conexión con el centro restablecida.'); delete $('#notice').dataset.disconnected; }
};
stream.onerror = () => { $('#notice').dataset.disconnected = 'true'; notice('Sin conexión con Live Studio. Abre Iniciar.cmd; el panel se reconectará automáticamente.'); };
