import { BrowserPipe } from './cdp.js';
import { decodeFrame } from './protocol.js';
import { chatInputState, isLivePage, isWebcastURL } from './page.js';
import { validateSession } from './session.js';

export class LocalTikTokClient {
  constructor({ browser, profile, username, emit, headless = false }) {
    Object.assign(this, { browser, profile, username, emit, headless });
    this.socketIds = new Set(); this.seen = new Set(); this.chatRequests = new Map();
    this.connected = false; this.closed = false; this.pageOK = false; this.canSend = false; this.events = 0;
    this.readiness = ''; this.startedAt = Date.now(); this.sendTask = null;
  }
  async start() {
    this.pipe = new BrowserPipe(this.browser, this.profile, { headless: this.headless });
    this.pipe.on('closed', () => { if (!this.closed) { this.emit({ kind: 'error', text: 'Se cerró el navegador. Vuelve a conectar TikTok.' }); void this.close(); } });
    this.pipe.on('event', event => { void this.onEvent(event).catch(() => { this.emit({ kind: 'diagnostic', text: 'No se pudo procesar un evento del navegador.' }); }); });
    const targets = await this.pipe.call('Target.getTargets');
    const target = targets.targetInfos.find(target => target.type === 'page');
    const targetId = target?.targetId || (await this.pipe.call('Target.createTarget', { url: 'about:blank' })).targetId;
    this.session = (await this.pipe.call('Target.attachToTarget', { targetId, flatten: true })).sessionId;
    await this.call('Page.enable'); await this.call('Runtime.enable'); await this.call('Network.enable', { maxTotalBufferSize: 8 * 1024 * 1024 });
    // Defense in depth: this profile cannot call a signing intermediary.
    await this.call('Network.setBlockedURLs', { urls: ['*://*.eulerstream.com/*', '*://eulerstream.com/*', '*://*.isaackogan.com/*', '*://isaackogan.com/*'] });
    await this.call('Page.navigate', { url: 'https://www.tiktok.com/@' + this.username + '/live' });
    this.emit({ kind: 'status', text: 'Abriendo TikTok en tu navegador local. Inicia sesión allí para responder al chat.' });
    this.timer = setInterval(() => { void this.poll(); }, 2500);
    await this.poll();
  }
  call(method, params = {}) { return this.pipe.call(method, params, this.session); }
  async evaluate(expression) {
    const value = await this.call('Runtime.evaluate', { expression, returnByValue: true });
    if (value.exceptionDetails) throw new Error('No se pudo leer el chat de TikTok');
    return value.result?.value;
  }
  setConnected(value) {
    if (this.connected === value) return;
    this.connected = value;
    this.emit({ kind: 'status', text: value ? 'Conectado al directo @' + this.username + ' mediante navegador local' : 'Desconectado del directo; esperando a TikTok en el navegador' });
    if (!value) { this.canSend = false; this.rejectSend('Se perdió la conexión antes de confirmar el mensaje'); }
  }
  async poll() {
    if (this.polling || this.closed) return; this.polling = true;
    try {
      this.pageOK = isLivePage(await this.evaluate('location.href'), this.username);
      if (!this.pageOK) this.setConnected(false);
      const cookies = await this.call('Network.getCookies', { urls: ['https://www.tiktok.com/'] });
      const loggedIn = cookies.cookies.some(cookie => ['sessionid', 'sessionid_ss'].includes(cookie.name) && !!cookie.value);
      const input = this.pageOK ? await this.evaluate('(' + chatInputState.toString() + ')()') : null;
      this.canSend = !!(this.pageOK && this.connected && loggedIn && input?.available && !input.draft);
      const status = { kind: 'browser', loggedIn, canSend: this.canSend, events: this.events, message: !this.pageOK ? 'Abre el LIVE de @' + this.username + ' en esa ventana.' : !this.connected ? 'Esperando eventos del LIVE. Si TikTok muestra una verificación, complétala en su ventana.' : !loggedIn ? 'Lectura conectada. La sesión solo es necesaria para enviar respuestas al chat.' : input?.draft ? 'Hay un borrador en el chat; se conserva y no se envían respuestas automáticas.' : !input?.available ? 'TikTok no muestra un cuadro de chat disponible para esta cuenta.' : 'Lectura y envío locales disponibles.' };
      if (this.accessError) status.message = this.accessError;
      const signature = JSON.stringify(status);
      if (signature !== this.readiness) { this.readiness = signature; this.emit(status); }
    } catch { if (!this.closed) { this.canSend = false; this.emit({ kind: 'browser', loggedIn: false, canSend: false, events: this.events, message: 'Esperando a que termine de cargar TikTok…' }); } }
    finally { this.polling = false; }
  }
  async onEvent({ method, params, sessionId }) {
    if (this.closed || sessionId !== this.session) return;
    if (method === 'Page.frameNavigated' && !params.frame.parentId) {
      this.accessError = '';
      this.pageOK = isLivePage(params.frame.url, this.username); this.socketIds.clear(); this.setConnected(false);
    }
    if (method === 'Network.responseReceived' && isWebcastURL(params.response.url) && /\/room\/enter\/?$/.test(new URL(params.response.url).pathname) && [401,403].includes(params.response.status)) {
      const message = 'TikTok rechazó el acceso al LIVE (HTTP ' + params.response.status + '). La lectura local fue rechazada. Este error no demuestra que se necesiten cookies; revisa si TikTok solicita una verificación en su ventana.';
      if (this.connected) return;
      if (this.accessError !== message) this.emit({ kind: 'error', text: message });
      this.accessError = message;
    }
    if (method === 'Network.webSocketCreated' && this.pageOK && isWebcastURL(params.url)) this.socketIds.add(params.requestId);
    if (method === 'Network.webSocketHandshakeResponseReceived' && this.socketIds.has(params.requestId) && params.response.status === 101) this.setConnected(true);
    if (method === 'Network.webSocketClosed' && this.socketIds.delete(params.requestId) && !this.socketIds.size) this.setConnected(false);
    if (method === 'Network.webSocketFrameReceived' && this.pageOK && this.socketIds.has(params.requestId) && params.response.opcode === 2) {
      const payload = params.response.payloadData;
      if (payload.length > 12 * 1024 * 1024) return;
      let events;
      try { events = decodeFrame(Buffer.from(payload, 'base64')); }
      catch {
        if (!this.decodeWarned) { this.decodeWarned = true; this.emit({ kind: 'diagnostic', text: 'TikTok envió una trama no compatible. La conexión sigue abierta; revisa si aumenta el contador de eventos.' }); }
        return;
      }
      for (const event of events) {
        if (event.createdAt && event.createdAt < this.startedAt - 5000) continue;
        if (event.messageId && this.seen.has(event.messageId)) continue;
        if (event.messageId) { this.seen.add(event.messageId); if (this.seen.size > 10000) this.seen.delete(this.seen.values().next().value); }
        if (event.kind === 'ended') { this.setConnected(false); this.emit({ kind: 'diagnostic', text: 'El LIVE ha terminado.' }); continue; }
        this.events++; this.emit(event);
      }
    }
    // Only a successful TikTok chat response confirms delivery. Never retry an
    // ambiguous send automatically, since it may already have been published.
    if (method === 'Network.requestWillBeSent' && this.sendTask && this.sendTask.dispatched && isWebcastURL(params.request.url) && /\/room\/chat\/?$/.test(new URL(params.request.url).pathname)) this.chatRequests.set(params.requestId, this.sendTask);
    if (method === 'Network.loadingFailed' && this.chatRequests.has(params.requestId)) { this.chatRequests.delete(params.requestId); this.rejectSend('TikTok no confirmó el envío. No se reintentó para evitar duplicados.'); }
    if (method === 'Network.loadingFinished' && this.chatRequests.has(params.requestId)) {
      const task = this.chatRequests.get(params.requestId); this.chatRequests.delete(params.requestId);
      if (task !== this.sendTask) return;
      try {
        const response = await this.call('Network.getResponseBody', { requestId: params.requestId });
        const json = JSON.parse(response.base64Encoded ? Buffer.from(response.body, 'base64').toString('utf8') : response.body);
        if (json.status_code !== 0) throw new Error('TikTok rechazó el mensaje. Revisa la sesión o las restricciones del chat.');
        this.sendTask = null; clearTimeout(task.timer); task.resolve();
      } catch (error) { this.rejectSend(error.message.startsWith('TikTok rechazó') ? error.message : 'No se pudo confirmar el envío del mensaje.'); }
    }
  }
  rejectSend(message) {
    const task = this.sendTask; this.sendTask = null;
    if (task) { clearTimeout(task.timer); task.reject(new Error(message)); }
    this.chatRequests.clear();
  }
  async setSession(input) {
    const { sessionId, ttTargetIdc } = validateSession(input);
    if (this.sendTask) throw new Error('Espera a que termine el envío antes de cambiar la sesión');
    const expires = Math.floor(Date.now() / 1000) + 30 * 86400;
    await this.call('Network.setCookies', { cookies: [
      { name: 'sessionid', value: sessionId, domain: '.tiktok.com', path: '/', secure: true, httpOnly: true },
      { name: 'sessionid_ss', value: sessionId, domain: '.tiktok.com', path: '/', secure: true, httpOnly: true },
      { name: 'tt-target-idc', value: ttTargetIdc, domain: '.tiktok.com', path: '/', secure: true, httpOnly: false },
    ].map(cookie => ({ ...cookie, expires })) });
    this.setConnected(false);
    await this.call('Page.navigate', { url: 'https://www.tiktok.com/@' + this.username + '/live' });
    this.emit({ kind: 'browser', loggedIn: true, canSend: false, events: this.events, message: 'Sesión cargada localmente. Esperando que TikTok habilite el chat…' });
  }
  async send(text) {
    if (typeof text !== 'string' || !text.trim() || [...text].length > 150 || /[\r\n]/.test(text)) throw new Error('El mensaje debe tener de 1 a 150 caracteres, sin saltos de línea');
    if (this.sendTask) throw new Error('Hay otro envío pendiente');
    await this.poll();
    if (!this.canSend || !isLivePage(await this.evaluate('location.href'), this.username)) throw new Error('No se puede enviar: inicia sesión y abre el chat del LIVE en la ventana local');
    const input = await this.evaluate('(' + chatInputState.toString() + ')(true)');
    if (!input?.focused || input.draft) throw new Error('El cuadro de chat no está disponible o contiene un borrador');
    await this.call('Input.insertText', { text });
    return new Promise((resolve, reject) => {
      this.sendTask = { resolve, reject, dispatched: true, timer: setTimeout(() => this.rejectSend('TikTok no confirmó el envío; no se reintentó automáticamente.'), 12000) };
      void (async () => {
        await this.call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
        await this.call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
      })().catch(() => this.rejectSend('No se pudo enviar desde el cuadro de chat.'));
    });
  }
  async close() {
    if (this.closed) return; this.closed = true; clearInterval(this.timer);
    this.rejectSend('Conexión cerrada'); this.setConnected(false);
    await this.pipe?.close();
    this.emit({ kind: 'closed' });
  }
}
