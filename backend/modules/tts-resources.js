import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const VOICES = 'https://huggingface.co/rhasspy/piper-voices/resolve/main/';
export class TTSResources {
  constructor(context) {
    Object.assign(this, context);
    this.directory = path.join(this.root, 'modules', 'tts');
    this.voices = []; this.devices = []; this.models = []; this.catalog = [];
    this.task = null; this.error = null; this.picked = null; this.catalogData = {};
    this.scan();
  }
  scan() {
    const s = this.settings.read();
    const found = new Map();
    const folders = [path.join(this.directory, 'voices'), path.resolve(this.root, '..', 'tts', 'voices')];
    if (s.Model) folders.push(path.dirname(s.Model));
    for (const folder of new Set(folders)) {
      if (!fs.existsSync(folder)) continue;
      for (const name of fs.readdirSync(folder)) {
        const file = path.join(folder, name);
        if (name.endsWith('.onnx') && fs.statSync(file).isFile() && fs.existsSync(file + '.json')) {
          try {
            const config = JSON.parse(fs.readFileSync(file + '.json', 'utf8').replace(/^\uFEFF/, ''));
            const labels = Object.fromEntries(Object.entries(config.speaker_id_map || {}).map(([label, id]) => [id, label]));
            const speakers = Array.from({ length: Math.max(1, Math.min(config.num_speakers || 1, 10000)) }, (_, id) => ({ id: String(id), name: labels[id] || `Hablante ${id + 1}` }));
            found.set(file, { path: file, name: name.replace(/\.onnx$/, ''), managed: folder === folders[0], speakers });
          } catch { /* Incomplete or invalid companion files cannot be selected. */ }
        }
      }
    }
    this.models = [...found.values()];
    this.piperPath = [s.PiperExe, path.join(this.directory, 'tools', 'piper', 'piper.exe'), path.resolve(this.root, '..', 'tts', 'tools', 'piper', 'piper.exe')].find(file => file && fs.existsSync(file)) || '';
  }
  state() { return { voices: this.voices, devices: this.devices, models: this.models, catalog: this.catalog, piperPath: this.piperPath, task: this.task, error: this.error, picked: this.picked }; }
  async jsonScript(name, args = []) {
    const lines = [];
    await this.processes.run('powershell.exe', ['-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass', '-File', path.join(this.directory, name), ...args], line => lines.push(line));
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
  progress(message, progress = 0) { this.task = { ...this.task, message, progress }; this.changed(); }
  refresh() {
    return this.runTask('Detectar voces y audio', async () => {
      this.scan();
      const result = await this.jsonScript('discover.ps1');
      this.voices = result.voices || []; this.devices = result.devices || [];
      if (result.warnings?.length) { this.error = result.warnings.join(' · '); this.log(this.error); }
    });
  }
  pick(kind) {
    if (!['piper', 'model'].includes(kind)) throw new Error('Tipo de archivo inválido');
    return this.runTask('Seleccionar archivo', async () => {
      const result = await this.jsonScript('pick.ps1', ['-Kind', kind]);
      if (!result.path) return;
      if (!fs.statSync(result.path).isFile()) throw new Error('El archivo no existe');
      let selected = result.path;
      if (kind === 'model') {
        if (!selected.endsWith('.onnx') || !fs.existsSync(selected + '.json')) throw new Error('Selecciona un .onnx con su .onnx.json al lado');
        JSON.parse(fs.readFileSync(selected + '.json', 'utf8'));
        const folder = path.join(this.directory, 'voices'); fs.mkdirSync(folder, { recursive: true });
        const destination = path.join(folder, path.basename(selected));
        if (path.resolve(selected) !== path.resolve(destination)) {
          fs.copyFileSync(selected + '.json', destination + '.json'); fs.copyFileSync(selected, destination);
        }
        selected = destination;
      } else if (path.basename(selected).toLowerCase() !== 'piper.exe') throw new Error('Selecciona piper.exe');
      this.scan();
      if (kind === 'piper') this.piperPath = selected;
      this.picked = { kind, path: selected, id: Date.now() };
    });
  }
  installPiper() {
    return this.runTask('Instalar Piper', async () => {
      this.progress('Descargando e instalando Piper para Windows…');
      const target = path.join(this.directory, 'tools');
      await this.processes.run('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(this.directory, 'install-piper.ps1'), '-Destination', target]);
      this.scan(); this.picked = { kind: 'piper', path: this.piperPath, id: Date.now() };
    });
  }
  loadCatalog() {
    return this.runTask('Consultar catálogo de voces', async signal => {
      const response = await fetch(VOICES + 'voices.json', { signal: AbortSignal.any([signal, AbortSignal.timeout(30000)]) });
      if (!response.ok) throw new Error(`No se pudo consultar el catálogo (${response.status})`);
      this.catalogData = await response.json();
      this.catalog = Object.entries(this.catalogData).filter(([key]) => /^[a-zA-Z0-9_-]+$/.test(key)).map(([key, voice]) => ({ id: key, name: `${voice.language.name_native} · ${voice.name} · ${voice.quality}`, language: voice.language.code, size: Math.round(Object.values(voice.files).reduce((sum, file) => sum + file.size_bytes, 0) / 1048576), source: 'https://huggingface.co/rhasspy/piper-voices/tree/main/' + Object.keys(voice.files)[0].split('/').slice(0, -1).join('/') }));
    });
  }
  downloadVoice(id) {
    if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(id) || !Object.hasOwn(this.catalogData, id)) throw new Error('Consulta el catálogo y elige una voz');
    return this.runTask('Descargar voz ' + id, async signal => {
      const voice = this.catalogData[id];
      const folder = path.join(this.directory, 'voices'); fs.mkdirSync(folder, { recursive: true });
      const pending = [];
      try {
        for (const [remote, metadata] of Object.entries(voice.files)) {
          if (!/^[a-zA-Z0-9_./-]+$/.test(remote) || remote.split('/').includes('..')) throw new Error('Ruta del catálogo inválida');
          const name = path.basename(remote) === 'MODEL_CARD' ? `${id}.MODEL_CARD.txt` : path.basename(remote);
          if (![`${id}.onnx`, `${id}.onnx.json`, `${id}.MODEL_CARD.txt`].includes(name)) throw new Error('Archivo de voz inesperado en el catálogo');
          const destination = path.join(folder, name), partial = destination + '.download';
          pending.push({ destination, partial });
          const response = await fetch(VOICES + remote, { signal: AbortSignal.any([signal, AbortSignal.timeout(300000)]) });
          if (!response.ok) throw new Error(`Descarga fallida (${response.status})`);
          const hash = createHash('md5'); let received = 0, previous = 0;
          const fd = fs.openSync(partial, 'w');
          try {
            for await (const chunk of response.body) {
              received += chunk.length;
              if (received > metadata.size_bytes || received > 600 * 1048576) throw new Error('Tamaño de descarga inválido');
              hash.update(chunk); fs.writeSync(fd, chunk);
              if (Date.now() - previous > 250) { this.progress(`Descargando ${name}`, Math.min(99, Math.round(received / metadata.size_bytes * 100))); previous = Date.now(); }
            }
          } finally { fs.closeSync(fd); }
          if (received !== metadata.size_bytes || hash.digest('hex') !== metadata.md5_digest) throw new Error('La descarga no coincide con el catálogo; vuelve a intentar');
        }
        // Publish the ONNX last so incomplete downloads never appear in the selector.
        for (const file of pending.sort((a, b) => Number(a.destination.endsWith('.onnx')) - Number(b.destination.endsWith('.onnx')))) fs.renameSync(file.partial, file.destination);
        this.scan();
        const model = pending.find(file => file.destination.endsWith('.onnx'));
        if (model) this.picked = { kind: 'model', path: model.destination, id: Date.now() };
      } finally { for (const file of pending) fs.rmSync(file.partial, { force: true }); }
    });
  }
  close() { this.abort?.abort(); }
}
