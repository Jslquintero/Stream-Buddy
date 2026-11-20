import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { validateSettings } from '../settings.js';
import { TTSResources } from './tts-resources.js';
import { preparePiperConfig } from './piper-config.js';

export function filterText(text, s) {
  text = text.trim();
  const command = s.Command;
  const match = command && text.toLowerCase().startsWith(command.toLowerCase()) &&
    (!/[\p{L}\p{N}]/u.test(command) || text.length === command.length || /\s/u.test(text[command.length]));
  if (!s.ReadAll && !match) return null;
  if (match) text = text.slice(command.length).trim();
  if (!text || [...text].length > s.MaxLength || (s.BlockLinks !== false && /https?:\/\/|www\./i.test(text)) || s.Blocked.some(w => w.trim() && text.toLowerCase().includes(w.toLowerCase()))) return null;
  return text;
}

export class TTSModule {
  constructor({ root, dataDir, settings, processes, log, changed, onLiveEvent = () => {}, onComment = () => false }) {
    this.onLiveEvent = onLiveEvent;
    this.onComment = onComment;
    Object.assign(this, { root, dataDir, settings, processes, log, changed });
    this.queue = []; this.cooldowns = new Map(); this.paused = false;
    this.speaker = null; this.bridge = null; this.installing = false; this.connected = false; this.closing = false; this.stopping = false;
    this.moduleDir = path.join(root, 'modules', 'tts');
    this.resources = new TTSResources({ root, settings, processes, log, changed: () => { changed(); if (!this.resources?.task?.running) queueMicrotask(() => this.pump()); } });
    this.current = null; this.lastError = null; this.metrics = { accepted: 0, filtered: 0, completed: 0 };
  }
  connectorPython() {
    return [path.join(this.moduleDir, '.venv', 'Scripts', 'python.exe'), path.join(this.root, '..', 'tts', '.venv', 'Scripts', 'python.exe')].find(file => fs.existsSync(file)) || null;
  }
  state() { return { connectorMode: 'euler', queued: this.queue.length, paused: this.paused, speaking: !!this.speaker, connected: this.connected, connecting: !!this.bridge && !this.connected, connector: !!this.connectorPython(), installing: this.installing, items: this.queue.map(job => ({ id: job.id, user: job.user, text: job.Text, preview: !!job.preview })), current: this.current, lastError: this.lastError, metrics: { ...this.metrics }, resources: this.resources.state() }; }
  enqueue(user, raw) {
    const s = this.settings.read();
    if (!s.Enabled) return 'TTS desactivado';
    const text = filterText(raw, s);
    if (!text || s.BlockedUsers.includes(user.replace(/^@/, '').toLowerCase())) { this.metrics.filtered++; this.changed(); return 'Ignorado por comando o filtros'; }
    const now = Date.now();
    for (const [key, time] of this.cooldowns) if (now - time >= 3600000) this.cooldowns.delete(key);
    if (now - (this.cooldowns.get(user) ?? -Infinity) < s.Cooldown * 1000) return 'Espera por usuario activa';
    if (this.queue.length >= s.MaxQueue) return `Cola llena (${s.MaxQueue} mensajes)`;
    this.queue.push({ ...s, Text: text, id: randomUUID(), user }); this.metrics.accepted++; this.cooldowns.set(user, now); this.changed();
    queueMicrotask(() => this.pump());
    return 'Mensaje añadido a la cola';
  }
  preview(text, input) {
    if (typeof text !== 'string' || !text.trim() || text.length > 500) throw new Error('Escribe de 1 a 500 caracteres para probar');
    const s = validateSettings(input);
    if (this.queue.length >= s.MaxQueue) throw new Error('La cola está llena');
    this.queue.push({ ...s, Text: text.trim(), id: randomUUID(), user: 'Prueba de voz', preview: true });
    this.changed(); this.pump();
  }
  remove(id) {
    const index = this.queue.findIndex(job => job.id === id);
    if (index < 0) throw new Error('El mensaje ya no está en la cola');
    this.queue.splice(index, 1); this.changed();
  }
  pump() {
    if (this.closing || this.stopping || this.paused || this.resources.task?.running || this.speaker || !this.queue.length) return;
    const job = this.queue.shift();
    this.current = { id: job.id, user: job.user, text: job.Text, preview: !!job.preview }; this.lastError = null;
    const file = path.join(this.dataDir, 'speech.json');
    try {
      if (job.Engine === 'Piper') {
        const config = preparePiperConfig(job.Model, this.dataDir);
        job.PiperConfig = config.path;
        if (config.adapted) this.log('Compatibilidad Piper Windows aplicada a ' + path.basename(job.Model));
      }
      fs.writeFileSync(file, JSON.stringify(job), 'utf8');
      fs.rmSync(file + '.error', { force: true });
      const child = this.processes.start('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(this.moduleDir, 'speech.ps1'), '-JobFile', file]);
      this.speaker = child; this.changed();
      let finished = false;
      const finish = code => {
        if (finished) return; finished = true;
        if (fs.existsSync(file + '.error')) { this.lastError = fs.readFileSync(file + '.error', 'utf8').replace(/^\uFEFF/, ''); this.log(this.lastError); }
        else if (!this.stopping && !this.closing) {
          if (code === 0) this.metrics.completed++;
          else { this.lastError = code instanceof Error ? code.message : `El motor de voz terminó con código ${code}`; this.log(this.lastError); }
        }
        if (this.speaker === child) this.speaker = null;
        this.current = null;
        this.changed(); setImmediate(() => this.pump());
      };
      child.once('error', finish); child.once('close', finish);
    } catch (error) { this.current = null; this.lastError = error.message; this.log(error.message); this.changed(); setImmediate(() => this.pump()); }
  }
  pause() { this.paused = !this.paused; this.changed(); this.pump(); }
  async stop(clear = true) {
    if (clear) this.queue.length = 0;
    if (this.stopPromise) return this.stopPromise;
    this.stopPromise = this.interrupt().finally(() => { this.stopPromise = null; });
    return this.stopPromise;
  }
  async interrupt() {
    this.stopping = true;
    try { await this.processes.stop(this.speaker); }
    finally { this.stopping = false; this.changed(); this.pump(); }
  }
  connect() {
    if (this.installing) throw new Error('Espera a que termine la instalación del conector');
    if (this.bridge) throw new Error('Ya hay una conexión activa');
    const python = this.connectorPython();
    if (!python) throw new Error('Instala el conector primero');
    const username = this.settings.read().Username.trim().replace(/^@/, '');
    if (!/^[a-zA-Z0-9_.]{1,64}$/.test(username)) throw new Error('Guarda un usuario de TikTok válido');
    let diagnostic = '';
    const child = this.processes.start(python, [path.join(this.moduleDir, 'bridge.py'), username], line => {
      if (this.bridge !== child) return;
      try {
        const event = JSON.parse(line);
        if (event.kind === 'comment' && !this.onComment(event)) this.enqueue(String(event.user || 'usuario'), String(event.text || ''));
        else if (['follow', 'gift', 'share', 'superfan', 'like'].includes(event.kind)) this.onLiveEvent(event);
        else {
          if (event.kind === 'status') this.connected = String(event.text).startsWith('Conectado al directo');
          if (event.kind === 'error') this.lastError = String(event.text || 'Error del conector');
          this.log((event.text || '') + (event.detail ? ` — ${event.detail}` : ''));
        }
      } catch { if (line.trim()) { diagnostic = line.trim().slice(0,700); this.log(line); } }
      this.changed();
    });
    this.bridge = child; this.lastError = null;
    const finish = code => {
      if (this.bridge !== child) return;
      if (!this.closing && !this.disconnecting && !this.lastError && code !== 0) {
        this.lastError = /did not find executable|No module named|ENOENT/i.test(diagnostic + String(code))
          ? 'El entorno Python del conector está incompleto o cambió de ruta. Pulsa Preparar para repararlo.'
          : 'El conector TikTok terminó inesperadamente: ' + (diagnostic || (code instanceof Error ? code.message : `código ${code}`));
        this.log(this.lastError);
      }
      this.bridge = null; this.connected = false; this.changed();
    };
    child.once('close', finish); child.once('error', finish); this.changed();
  }
  async disconnect() {
    this.disconnecting = true;
    try { await this.processes.stop(this.bridge); }
    finally { this.disconnecting = false; this.connected = false; this.changed(); }
  }
  async install() {
    if (this.installing) return;
    if (this.bridge) throw new Error('Desconecta el LIVE antes de instalar el conector');
    this.installing = true; this.lastError = null; this.changed();
    try {
      const target = path.join(this.moduleDir, '.venv');
      const ownPython = path.join(target, 'Scripts', 'python.exe');
      this.log('Preparando entorno del conector TikTok…');
      // Recreate launchers using the registered Python, never a potentially broken sibling venv.
      await this.processes.run('py.exe', ['-3', '-m', 'venv', target]);
      await this.processes.run(ownPython, ['-m', 'pip', 'install', 'TikTokLive>=6.6.6,<7']);
      await this.processes.run(ownPython, ['-c', 'from TikTokLive import TikTokLiveClient; from TikTokLive.events import SuperFanEvent']);
      this.log('Conector instalado. Ya puedes conectar tu LIVE.');
    } catch (error) { this.lastError = `No se pudo instalar el conector: ${error.message}`; this.log(this.lastError); }
    finally { this.installing = false; this.changed(); }
  }
  async sendChat() { throw new Error('El conector restaurado solo lee el chat; el envio automatico no esta disponible.'); }
  async applySession() { throw new Error('La lectura con Euler no necesita importar cookies.'); }
  async close() { this.closing = true; this.resources.close(); this.queue.length = 0; await Promise.all([this.disconnect(), this.stop()]); }
}
