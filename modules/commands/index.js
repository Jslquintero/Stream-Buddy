import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { defaultCommands, validateCommands, commandsOutputPath, commandsListOutputPath } from './config.js';

export function createCommandsModule({ dataDir, changed }) {
  const file = path.join(dataDir, 'commands.json');
  let config = structuredClone(defaultCommands), visual = null, audio = null, list = null, error = '';
  const timers = {};
  const cooldowns = new Map();
  try { config = validateCommands(JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''))); }
  catch (e) { if (e.code !== 'ENOENT') error = 'No se pudieron cargar los comandos: ' + e.message; }
  function clear() { clearTimeout(timers.list); list = null; clearTimeout(timers.visual); clearTimeout(timers.audio); visual = null; audio = null; changed(); }
  function showHelp(page = null) {
    const help = config.commands.filter(row => row.enabled).map(row => ({ command: row.command, description: row.description || '' }));
    const startedAt = Date.now(), duration = config.listAlwaysVisible ? null : 12000;
    clearTimeout(timers.list);
    list = { id: randomUUID(), help, page, startedAt, expiresAt: duration ? startedAt + duration : null };
    if (duration) {
      timers.list = setTimeout(() => { list = null; changed(); }, duration);
      timers.list.unref();
    }
    changed(); return true;
  }
  function trigger(row, user) {
    const now = Date.now(), id = randomUUID();
    if (row.image || row.video || row.text) {
      clearTimeout(timers.visual);
      visual = { id, video: row.video || '', volume: row.volume, image: row.image, text: row.text, user, expiresAt: now + row.duration * 1000 };
      timers.visual = setTimeout(() => { visual = null; changed(); }, row.duration * 1000); timers.visual.unref();
    }
    if (row.audio || row.video) {
      clearTimeout(timers.audio);
      audio = { id, src: row.audio || '', volume: row.volume, expiresAt: now + 120000 };
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
      const [keyword, ...args] = name.split(/\s+/);
      const isList = keyword === config.listCommand.toLowerCase() && (args.length === 0 || (args.length === 1 && /^\d+$/.test(args[0])));
      const page = isList && args.length ? Number(args[0]) : null;
      if (isList && page !== null && (!Number.isSafeInteger(page) || page < 1 || page > Math.max(1, Math.ceil(config.commands.filter(row => row.enabled).length / 6)))) return true;
      const row = config.commands.find(row => row.enabled && row.command.toLowerCase() === name);
      if (!isList && !row) return false;
      const now = Date.now();
      for (const [key, expiresAt] of cooldowns) {
        if (expiresAt <= now) cooldowns.delete(key);
      }
      const user = String(event.userId || event.user || 'usuario').trim().toLowerCase();
      const key = JSON.stringify([user, isList ? 'list' : row.id]);
      if (cooldowns.has(key)) return true;
      const cooldown = isList ? config.listCooldown : row.cooldown;
      if (cooldown > 0) cooldowns.set(key, now + cooldown * 1000);
      return isList ? showHelp(page) : trigger(row, String(event.user || 'usuario').slice(0, 80));
    },
    test(id) {
      if (id === '!comandos') return showHelp();
      const row = config.commands.find(row => row.id === id);
      if (!row || (!row.image && !row.video && !row.audio && !row.text)) throw new Error('Configura y guarda un recurso antes de probar');
      trigger(row, 'Usuario de prueba');
    },
  };
}
