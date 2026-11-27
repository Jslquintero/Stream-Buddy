import path from 'node:path';
import { EventEmitter } from 'node:events';
import { SettingsStore } from './settings.js';
import { ProcessManager } from './processes.js';
import { TTSModule } from './modules/tts.js';
import { createLayoutModule } from './modules/layout.js';
import { createAdsModule } from './modules/ads.js';
import { createNotificationsModule } from '../modules/notifications/index.js';
import { createLikesModule } from '../modules/likes/index.js';
import { createGiftersModule } from '../modules/gifters/index.js';
import { createAuctionModule } from '../modules/auction/index.js';
import { createCommandsModule } from '../modules/commands/index.js';
import { resolveCommandImages } from '../modules/commands/tenor.js';
import { validateCommands } from '../modules/commands/config.js';
import { createSpotifyModule } from './modules/spotify.js';
import { createSocialModule } from '../modules/social/index.js';
import { createBannersModule } from '../modules/banners/index.js';

export class Center extends EventEmitter {
  constructor({ root, dataDir = path.join(root, 'data'), processes, tools, legacyFile = path.resolve(root, '..', 'tts', 'settings.json'), desktop } = {}) {
    super(); this.root = root; this.events = []; this.closing = false;
    this.settings = new SettingsStore(dataDir, legacyFile, desktop ? 'PocketTTS' : 'Windows');
    this.processes = processes || new ProcessManager(text => this.log(text));
    const context = { root, dataDir, desktop, settings: this.settings, processes: this.processes, log: text => this.log(text), changed: () => this.changed() };
    this.notifications = createNotificationsModule(context);
    this.spotify = createSpotifyModule(context);
    this.likes = createLikesModule(context);
    this.gifters = createGiftersModule(context);
    this.auction = createAuctionModule(context);
    this.social = createSocialModule(context);
    this.banners = createBannersModule(context);
    this.commands = createCommandsModule({ ...context, reply: messages => this.tts.sendChat(messages) });
    this.tts = new TTSModule({ ...context, onComment: event => this.commands.receive(event), onLiveEvent: event => {
      const owner = this.settings.read().Username;
      if (event.kind === 'like') this.likes.receive(event, owner);
      else if (event.kind === 'gift') { this.gifters.receive(event, owner); this.auction.receive(event, owner); this.notifications.enqueue(event.kind, event); }
      else this.notifications.enqueue(event.kind, event);
    } });
    this.tools = { ...(tools || { layout: createLayoutModule(context), ads: createAdsModule(context) }), notifications: this.notifications, likes:this.likes, gifters:this.gifters, auction:this.auction, commands:this.commands, spotify: this.spotify, social: this.social, banners: this.banners };
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
  async command(action, body, { origin } = {}) {
    if (this.closing) throw new Error('El centro se está cerrando');
    if (['tts/refresh', 'tts/install-pocket'].includes(action) && this.tts.resources.task?.running) throw new Error('Espera a que termine la tarea actual');
    switch (action) {
      case 'spotify/save': this.spotify.save(body); break;
      case 'spotify/connect': return this.spotify.connect(origin);
      case 'spotify/disconnect': this.spotify.disconnect(); break;
      case 'tiktok/session': await this.tts.applySession(body); break;
      case 'commands/save': this.commands.save(await resolveCommandImages(validateCommands(body))); break;
      case 'commands/test': await this.commands.test(body.id); break;
      case 'commands/clear': this.commands.clear(); break;
      case 'likes/save': this.likes.save(body);return {notificationRevision:this.likes.state().revision};
      case 'likes/export': return this.likes.scoreboard();
      case 'likes/reset': this.likes.reset();break;
      case 'gifters/save': this.gifters.save(body);return {notificationRevision:this.gifters.state().revision};
      case 'gifters/export': return this.gifters.scoreboard();
      case 'gifters/reset': this.gifters.reset();break;
      case 'auction/save': this.auction.save(body);return {notificationRevision:this.auction.state().revision};
      case 'auction/start': this.auction.begin();break;
      case 'auction/end': this.auction.end();break;
      case 'auction/next': this.auction.next();break;
      case 'auction/reset': this.auction.reset();break;
      case 'auction/export': return this.auction.results();
      case 'social/save': this.social.save(body);return {notificationRevision:this.social.state().revision};
      case 'social/upload': return this.social.assets.upload(body);
      case 'banners/save': this.banners.save(body);return {notificationRevision:this.banners.state().revision};
      case 'banners/upload': return this.banners.assets.upload(body);
      case 'notifications/fonts/install': return await this.notifications.fonts.install(body.name);
      case 'notifications/upload': return this.notifications.assets.upload(body);
      case 'notifications/save': this.notifications.save(body); break;
      case 'notifications/test':
        if (!this.notifications.enqueue(body.type, { user: 'Usuario de prueba', gift: 'Rosa', count: 3 }, body.config)) throw new Error('Activa esta notificación o libera espacio en la cola');
        break;
      case 'notifications/clear': this.notifications.clear(); break;
      case 'notifications/skip': this.notifications.skip(); break;
      case 'layout/save': this.tools.layout.save(body); break;
      case 'layout/create': return this.tools.layout.create(body);
      case 'layout/save-composition': return this.tools.layout.saveComposition(body);
      case 'layout/rename': return this.tools.layout.rename(body);
      case 'layout/delete': this.tools.layout.deleteComposition(body); break;
      case 'settings': this.settings.save(body); this.log('Configuración de voz guardada'); break;
      case 'tts/preview': this.tts.preview(body.text, body.settings); break;
      case 'tts/remove': this.tts.remove(body.id); break;
      case 'tts/clear': this.tts.queue.length = 0; break;
      case 'tts/windows-voices': this.processes.start('explorer.exe', ['ms-settings:speech']); break;
      case 'tts/refresh': void this.tts.resources.refresh(); break;
      case 'tts/install-pocket':
        if (this.tts.speaker) throw new Error('Espera a que termine la lectura antes de preparar Pocket TTS');
        void this.tts.resources.installPocket(); break;
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
    this.spotify.close();
    this.notifications.close();
    this.likes.close();
    this.gifters.close();
    this.auction.close();
    this.social.close();
    this.banners.close();
    this.commands.close();
    await this.tts.close();
    await this.processes.close();
    this.removeAllListeners();
  }
}
