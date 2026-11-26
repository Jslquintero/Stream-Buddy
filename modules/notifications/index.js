import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { defaultNotifications, validateNotifications, migrateNotifications, notificationText, eventNames, notificationOutputPath, notificationDesign } from './config.js';
import { notificationAssets } from './assets.js';
import { notificationFonts } from './fonts.js';

export function createNotificationsModule({ dataDir, changed, log }) {
  const file = path.join(dataDir, 'notifications.json');
  const fonts=notificationFonts(dataDir,changed);
  let revision=Date.now();
  let config = structuredClone(defaultNotifications), error = '', current = null, timer = null, closed = false;
  const queue = [];
  const read=target=>migrateNotifications(JSON.parse(fs.readFileSync(target,'utf8').replace(/^\uFEFF/,'')));
  try { config = read(file);revision=fs.statSync(file).mtimeMs; }
  catch (e) { if (e.code !== 'ENOENT') {error = 'No se pudo cargar la configuración de notificaciones: ' + e.message;try{config=read(file+'.bak');error='Configuración recuperada de la copia local.';}catch{}} }
  function next() {
    clearTimeout(timer); current = queue.shift() || null;
    if (current) {
      current.expiresAt = Date.now() + current.style.duration * 1000;
      timer = setTimeout(next, current.style.duration * 1000); timer.unref();
    }
    changed();
  }
  return {
    assets: notificationAssets(dataDir),
    fonts,
    state: () => ({ available: true, running: true, config, revision, fonts:fonts.state(), current, queued: queue.length, error, url: notificationOutputPath }),
    health: async () => {}, start: async () => { changed(); },
    save(value) {
      const validated = validateNotifications(value);
      fs.mkdirSync(dataDir, { recursive: true });
      fs.writeFileSync(file + '.tmp', JSON.stringify(validated, null, 2));
      if(fs.existsSync(file)){try{read(file);fs.copyFileSync(file,file+'.bak');}catch{}}
      fs.renameSync(file + '.tmp', file); config = validated; revision=Math.max(Date.now(),revision+1);error = '';
      if(!fs.existsSync(file+'.bak'))fs.copyFileSync(file,file+'.bak');
      if (!config.enabled) { queue.length = 0; clearTimeout(timer); current = null; }
      changed();
    },
    enqueue(type, data = {}, draft) {
      if (!Object.hasOwn(eventNames, type)) throw new Error('Tipo de notificación inválido');
      const style = draft ? validateNotifications(draft) : config;
      if (closed || !style.enabled || !style.events[type].enabled) return false;
      if (queue.length >= 30) return false;
      const template = style.events[type];
      queue.push({ id: randomUUID(), type, image: template.image || '', video:template.video||'', videoStart:template.videoStart??0, videoEnd:template.videoEnd??6, videoMuted:template.videoMuted??true, audio: template.audio || '', audioStart:template.audioStart??0, audioEnd:template.audioEnd??0, audioDuration:template.audioDuration??0, volume: template.volume ?? 80, title: notificationText(template.title, data), message: notificationText(template.message, data), style: structuredClone(notificationDesign(style,type)) });
      if (!current) next(); else changed();
      return true;
    },
    clear() { queue.length = 0; clearTimeout(timer); current = null; changed(); },
    skip: next,
    close() { closed = true; clearTimeout(timer); queue.length = 0; current = null; },
  };
}
