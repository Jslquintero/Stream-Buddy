import fs from 'node:fs';
import path from 'node:path';

export class TTSResources {
  constructor(context) {
    Object.assign(this, context);
    this.directory = path.join(this.root, 'modules', 'tts');
    this.pocketDirectory = path.join(this.directory, 'tools', 'pocket-tts');
    this.voices = []; this.devices = [];
    this.task = null; this.error = null;
  }
  pocketPath() {
    const file = path.join(this.pocketDirectory, 'pocket-tts.exe');
    return fs.statSync(file, { throwIfNoEntry: false })?.isFile() ? file : '';
  }
  state() { return { voices: this.voices, devices: this.devices, pocketSetupAvailable: true, pocketInstalled: !!this.pocketPath(), task: this.task, error: this.error, configured: this.configured }; }
  async jsonScript(name) {
    const lines = [];
    await this.processes.run('powershell.exe', ['-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass', '-File', path.join(this.directory, name)], line => lines.push(line));
    const result = lines.map(line => { try { return JSON.parse(line.replace(/^\uFEFF/, '')); } catch { return null; } }).find(value => value && typeof value === 'object');
    if (!result) throw new Error('Windows no devolvió información válida. Revisa la actividad.');
    return result;
  }
  async runTask(name, operation) {
    if (this.task?.running) throw new Error('Espera a que termine la tarea actual');
    this.abort = new AbortController();
    this.task = { name, running: true, progress: 0, message: 'Preparando…' }; this.error = null; this.changed();
    try {
      await operation(this.abort.signal);
      this.task = { name, running: false, progress: 100, message: 'Completado' };
      this.log(`${name}: completado`);
    } catch (error) {
      this.error = error.message;
      this.task = { name, running: false, progress: 0, message: error.message };
      this.log(`${name}: ${error.message}`);
    } finally { this.changed(); }
  }
  progress(message, progress) { this.task = { ...this.task, message, progress }; this.changed(); }
  refresh() {
    return this.runTask('Detectar voces y audio', async () => {
      const result = await this.jsonScript('discover.ps1');
      this.voices = result.voices || []; this.devices = result.devices || [];
      if (result.warnings?.length) { this.error = result.warnings.join(' · '); this.log(this.error); }
    });
  }
  installPocket() {
    return this.runTask('Preparar Pocket TTS', async signal => {
      const tools = path.dirname(this.pocketDirectory);
      fs.mkdirSync(tools, { recursive: true });
      const staging = fs.mkdtempSync(path.join(tools, 'pocket-setup-'));
      try {
        const { PocketVoice } = this.settings.read();
        const installer = path.join(this.directory, 'install-pocket.ps1');
        let failure;
        try {
          await this.processes.run('powershell.exe', [
            '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', installer,
            '-Destination', this.pocketDirectory, '-Staging', staging, '-Voice', PocketVoice,
          ], line => {
            if (line === 'download') this.progress('Descargando el ejecutable oficial para Windows…', 20);
            else if (line === 'model') this.progress('Preparando el modelo en español y comprobando la voz…', 65);
            else if (line.startsWith('error:')) failure = line.slice('error:'.length);
            else if (line.trim()) this.log(line);
          });
        } catch (error) {
          throw failure ? new Error(failure) : error;
        }
        signal.throwIfAborted();
        const downloaded = path.join(staging, 'pocket-tts.exe');
        if (fs.existsSync(downloaded)) {
          fs.mkdirSync(this.pocketDirectory, { recursive: true });
          fs.renameSync(path.join(staging, 'LICENSE'), path.join(this.pocketDirectory, 'LICENSE'));
          fs.renameSync(downloaded, path.join(this.pocketDirectory, 'pocket-tts.exe'));
        }
        if (!this.pocketPath()) throw new Error('La preparación no dejó un ejecutable de Pocket TTS.');
        const settings = { ...this.settings.read(), Engine: 'PocketTTS' };
        this.settings.save(settings);
        this.configured = { id: (this.configured?.id ?? 0) + 1, Engine: settings.Engine, PocketVoice: settings.PocketVoice };
      } finally { fs.rmSync(staging, { recursive: true, force: true }); }
    });
  }
  close() { this.abort?.abort(); }
}
