import fs from 'node:fs';

export class LocalToolModule {
  constructor({ id, name, url, command, args, requiredFile, processes, log, changed, healthPath = '/' }) {
    Object.assign(this, { id, name, url, command, args, requiredFile, processes, log, changed, healthPath });
    this.child = null; this.running = false; this.starting = false; this.error = null; this.pending = null;
  }
  state() { return { id: this.id, name: this.name, url: this.url, running: this.running, starting: this.starting, managed: !!this.child, available: fs.existsSync(this.requiredFile), error: this.error }; }
  async health() {
    try {
      const response = await fetch(this.url + this.healthPath, { signal: AbortSignal.timeout(700) });
      this.running = response.ok;
      await response.body?.cancel();
    } catch { this.running = false; }
    return this.running;
  }
  async start() {
    if (this.pending) return this.pending;
    this.pending = this.launch().finally(() => { this.pending = null; });
    return this.pending;
  }
  async launch() {
    if (await this.health()) { this.changed(); return; }
    if (this.child) return;
    if (!fs.existsSync(this.requiredFile)) throw new Error(`No se encuentra ${this.name}: ${this.requiredFile}`);
    this.starting = true; this.error = null; this.changed();
    let child;
    try { child = this.processes.start(this.command, this.args); }
    catch (error) { this.starting = false; this.error = error.message; this.changed(); throw error; }
    this.child = child;
    let failed = false;
    const finish = error => {
      failed = true;
      if (this.child === child) { this.child = null; this.running = false; this.starting = false; }
      if (error instanceof Error) this.error = error.message;
      this.changed();
    };
    child.once('error', finish); child.once('close', finish);
    this.log(`Iniciando ${this.name}`);
    for (let i = 0; i < 25 && !failed; i++) {
      if (await this.health()) { this.starting = false; this.changed(); return; }
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    this.starting = false;
    if (!this.running) this.error ||= `${this.name} no respondió. Revisa la actividad y sus dependencias.`;
    this.changed();
  }
  async close() { await this.processes.stop(this.child); }
}
