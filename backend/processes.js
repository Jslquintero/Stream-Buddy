import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

export class ProcessManager {
  constructor(log) { this.children = new Set(); this.log = log; this.closing = false; }
  start(command, args = [], onLine, { input = false, env } = {}) {
    if (this.closing) throw new Error('El centro se está cerrando');
    let child;
    try { child = spawn(command, args, { env, windowsHide: true, shell: false, stdio: [input ? 'pipe' : 'ignore', 'pipe', 'pipe'] }); }
    catch (error) { this.log(`No se pudo iniciar ${command}: ${error.message}`); throw error; }
    this.children.add(child);
    child.once('error', error => this.log(`No se pudo iniciar ${command}: ${error.message}`));
    child.once('close', () => this.children.delete(child));
    for (const stream of [child.stdout, child.stderr]) {
      createInterface({ input: stream }).on('line', line => {
        if (onLine) onLine(line); else if (line.trim()) this.log(line);
      });
    }
    return child;
  }
  async run(command, args, onLine) {
    const child = this.start(command, args, onLine);
    await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('close', code => code === 0 ? resolve() : reject(new Error(`${command} terminó con código ${code}`)));
    });
  }
  async stop(child) {
    if (!child || !this.children.has(child)) return;
    if (process.platform === 'win32' && child.pid) {
      await new Promise(resolve => {
        const killer = spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
        killer.once('error', () => { child.kill(); resolve(); });
        killer.once('close', resolve);
      });
    } else child.kill();
    if (this.children.has(child)) await new Promise(resolve => {
      const timer = setTimeout(resolve, 3000);
      child.once('close', () => { clearTimeout(timer); resolve(); });
    });
  }
  async close() {
    this.closing = true;
    await Promise.all([...this.children].map(child => this.stop(child)));
  }
}
