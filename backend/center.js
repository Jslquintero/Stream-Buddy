import path from 'node:path';
import { EventEmitter } from 'node:events';
import { SettingsStore } from './settings.js';
import { ProcessManager } from './processes.js';
import { TTSModule } from './modules/tts.js';
import { createLayoutModule } from './modules/layout.js';
import { createAdsModule } from './modules/ads.js';
import { createNotificationsModule } from '../modules/notifications/index.js';
import { createLikesModule } from '../modules/likes/index.js';

export class Center extends EventEmitter {
  constructor({ root, dataDir = path.join(root, 'data'), processes, tools, legacyFile } = {}) {
    super(); this.root = root; this.events = []; this.closing = false;
    this.settings = new SettingsStore(dataDir, legacyFile ?? path.resolve(root, '..', 'tts', 'settings.json'));
    this.processes = processes || new ProcessManager(text => this.log(text));
    const context = { root, dataDir, settings: this.settings, processes: this.processes, log: text => this.log(text), changed: () => this.changed() };
    this.notifications = createNotificationsModule(context);
    this.likes = createLikesModule(context);
    this.tts = new TTSModule({ ...context, onLiveEvent: event => event.kind==='like'?this.likes.receive(event,this.settings.read().Username):this.notifications.enqueue(event.kind, event) });
    this.tools = { ...(tools || { layout: createLayoutModule(context), ads: createAdsModule(context) }), notifications: this.notifications, likes:this.likes };
  }
  log(text) {
    this.events.push({ time: new Date().toLocaleTimeString('es-PA', { hour12: false }), text: String(text).slice(0, 1500) });
    if (this.events.length > 80) this.events.shift();
    this.changed();
  }
  changed() { if (!this.closing) this.emit('state'); }
  snapshot() {
    return { backend: 'node', settings: this.settings.read(), tools: Object.fromEntries(Object.entries(this.tools).map(([key, value]) => [key, value.state()])), tts: this.tts.state(), events: [...this.events] };
  }
  async poll() {
    if (this.polling || this.closing) return;
    this.polling = true;
    try { await Promise.all(Object.values(this.tools).map(tool => tool.health())); this.changed(); }
    finally { this.polling = false; }
  }
  async command(action, body) {
    if (this.closing) throw new Error('El centro se está cerrando');
    if (['tts/refresh', 'tts/catalog', 'tts/download', 'tts/pick', 'tts/install-piper'].includes(action) && this.tts.resources.task?.running) throw new Error('Espera a que termine la tarea actual');
    if (['tts/download', 'tts/pick', 'tts/install-piper'].includes(action) && this.tts.speaker) throw new Error('Detén la voz antes de modificar los archivos de Piper');
    switch (action) {
      case 'likes/save': this.likes.save(body);return {notificationRevision:this.likes.state().revision};
      case 'likes/export': return this.likes.scoreboard();
      case 'likes/reset': this.likes.reset();break;
      case 'notifications/fonts/install': return await this.notifications.fonts.install(body.name);
      case 'notifications/upload': return this.notifications.assets.upload(body);
      case 'notifications/save': this.notifications.save(body); break;
      case 'notifications/test':
        if (!this.notifications.enqueue(body.type, { user: 'Usuario de prueba', gift: 'Rosa', count: 3 }, body.config)) throw new Error('Activa esta notificación o libera espacio en la cola');
        break;
      case 'notifications/clear': this.notifications.clear(); break;
      case 'notifications/skip': this.notifications.skip(); break;
      case 'layout/save': this.tools.layout.save(body); break;
      case 'settings': this.settings.save(body); this.log('Configuración de voz guardada'); break;
      case 'tts/preview': this.tts.preview(body.text, body.settings); break;
      case 'tts/remove': this.tts.remove(body.id); break;
      case 'tts/clear': this.tts.queue.length = 0; break;
      case 'tts/windows-voices': this.processes.start('explorer.exe', ['ms-settings:speech']); break;
      case 'tts/refresh': void this.tts.resources.refresh(); break;
      case 'tts/catalog': void this.tts.resources.loadCatalog(); break;
      case 'tts/download': void this.tts.resources.downloadVoice(body.id); break;
      case 'tts/pick': void this.tts.resources.pick(body.kind); break;
      case 'tts/install-piper':
        if (this.tts.speaker) throw new Error('Detén la voz antes de instalar Piper');
        void this.tts.resources.installPiper(body.language); break;
      case 'test':
        if (typeof body.text !== 'string') throw new Error('El comentario debe ser texto');
        this.log(this.tts.enqueue('prueba', body.text)); break;
      case 'pause': this.tts.pause(); break;
      case 'skip': await this.tts.stop(false); break;
      case 'stop': await this.tts.stop(true); break;
      case 'connect': this.tts.connect(); break;
      case 'disconnect': await this.tts.disconnect(); break;
      case 'install':
        if (this.tts.bridge) throw new Error('Desconecta el LIVE antes de instalar');
        void this.tts.install(); break;
      case 'start': {
        if (!Object.hasOwn(this.tools, body.tool)) throw new Error('Herramienta desconocida');
        // The request acknowledges launch; readiness is reported in the event stream.
        void this.tools[body.tool].start().catch(error => this.log(error.message)); break;
      }
      default: return false;
    }
    this.changed(); return true;
  }
  async close() {
    this.closing = true;
    this.notifications.close();
    this.likes.close();
    await this.tts.close();
    await this.processes.close();
    this.removeAllListeners();
  }
}
