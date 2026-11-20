import { EventEmitter } from 'node:events';
import { spawn } from 'node:child_process';
import fs from 'node:fs';

// Browser automation over inherited pipes. No debugging port and no HTTP proxy.
export class BrowserPipe extends EventEmitter {
  constructor(browser, profile, { headless = false } = {}) {
    super(); this.pending = new Map(); this.sequence = 0; this.buffer = Buffer.alloc(0); this.closed = false;
    fs.mkdirSync(profile, { recursive: true });
    this.child = spawn(browser, ['--remote-debugging-pipe', '--user-data-dir=' + profile, '--no-first-run', '--no-default-browser-check', '--disable-background-mode', '--disable-features=msEdgeSidebarV2', '--mute-audio', ...(headless ? ['--headless', '--disable-gpu'] : []), 'about:blank'], { windowsHide: headless, stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] });
    this.child.stdio[4].on('data', chunk => this.read(chunk));
    this.child.stdio[3].on('error', () => this.finish('Se cerró la conexión con el navegador'));
    this.child.once('error', () => this.finish('No se pudo abrir Edge/Chrome'));
    this.child.once('close', () => this.finish('Se cerró el navegador de TikTok'));
  }
  read(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    if (this.buffer.length > 32 * 1024 * 1024) return this.finish('Respuesta del navegador demasiado grande');
    let end;
    while ((end = this.buffer.indexOf(0)) >= 0) {
      const line = this.buffer.subarray(0, end); this.buffer = this.buffer.subarray(end + 1);
      try {
        const message = JSON.parse(line.toString('utf8'));
        if (message.id) {
          const pending = this.pending.get(message.id); if (!pending) continue;
          this.pending.delete(message.id); clearTimeout(pending.timer);
          message.error ? pending.reject(new Error('El navegador no pudo ejecutar ' + pending.method)) : pending.resolve(message.result);
        } else this.emit('event', message);
      } catch { /* Ignore incomplete/unrelated browser diagnostics. */ }
    }
  }
  call(method, params = {}, sessionId) {
    if (this.closed) return Promise.reject(new Error('El navegador está cerrado'));
    return new Promise((resolve, reject) => {
      const id = ++this.sequence;
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error('Tiempo agotado: ' + method)); }, 12000);
      this.pending.set(id, { resolve, reject, timer, method });
      this.child.stdio[3].write(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }) + '\0');
    });
  }
  finish(reason) {
    if (this.closed) return; this.closed = true;
    for (const request of this.pending.values()) { clearTimeout(request.timer); request.reject(new Error(reason)); }
    this.pending.clear(); this.emit('closed', reason);
  }
  async close() {
    if (!this.closed) await this.call('Browser.close').catch(() => {});
    this.child.kill(); this.finish('Navegador cerrado');
  }
}
