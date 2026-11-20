import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { defaultCommands, validateCommands, commandsOutputPath, commandsListOutputPath } from './config.js';

export function createCommandsModule({ dataDir, changed }) {
  const file = path.join(dataDir, 'commands.json');
  let config = structuredClone(defaultCommands), visual = null, audio = null, list = null, error = '';
  const timers = {};
  try { config = validateCommands(JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''))); }
  catch (e) { if (e.code !== 'ENOENT') error = 'No se pudieron cargar los comandos: ' + e.message; }
  function clear() { clearTimeout(timers.list); list = null; clearTimeout(timers.visual); clearTimeout(timers.audio); visual = null; audio = null; changed(); }
  function showHelp() {
    const help = config.commands.filter(row => row.enabled).map(row => ({ command: row.command, description: row.description || (row.image ? 'Muestra una imagen o GIF' : row.audio ? 'Reproduce un sonido' : 'Muestra una notificación') }));
    const startedAt = Date.now(), duration = Math.max(12000, Math.ceil(help.length / 6) * 8000);
    clearTimeout(timers.list);
    list = { id: randomUUID(), help, startedAt, expiresAt: startedAt + duration };
    timers.list = setTimeout(() => { list = null; changed(); }, duration); timers.list.unref();
    changed(); return true;
  }
  function trigger(row, user) {
    const now = Date.now(), id = randomUUID();
    if (row.image || row.text) {
      clearTimeout(timers.visual);
      visual = { id, image: row.image, text: row.text, user, expiresAt: now + row.duration * 1000 };
      timers.visual = setTimeout(() => { visual = null; changed(); }, row.duration * 1000); timers.visual.unref();
    }
    if (row.audio) {
      clearTimeout(timers.audio);
      audio = { id, src: row.audio, volume: row.volume, expiresAt: now + 120000 };
      timers.audio = setTimeout(() => { audio = null; changed(); }, 120000); timers.audio.unref();
    }
    changed(); return true;
  }
  return {
    state: () => ({ available: true, running: true, config, visual, audio, list, error, url: commandsOutputPath, listUrl: commandsListOutputPath }),
    health: async () => {}, start: async () => changed(), close: clear, clear,
    save(value) {
      const next = validateCommands(value);
      fs.mkdirSync(dataDir, { recursive: true });
      fs.writeFileSync(file + '.tmp', JSON.stringify(next, null, 2)); fs.renameSync(file + '.tmp', file);
      config = next; error = ''; clear();
    },
    receive(event) {
      if (!config.enabled || event.kind !== 'comment' || typeof event.text !== 'string') return false;
      const name = event.text.trim().toLowerCase();
      if (name === '!comandos') return showHelp();
      const row = config.commands.find(row => row.enabled && row.command.toLowerCase() === name);
      return row ? trigger(row, String(event.user || 'usuario').slice(0, 80)) : false;
    },
    test(id) {
      if (id === '!comandos') return showHelp();
      const row = config.commands.find(row => row.id === id);
      if (!row || (!row.image && !row.audio && !row.text)) throw new Error('Configura y guarda un recurso antes de probar');
      trigger(row, 'Usuario de prueba');
    },
  };
}
