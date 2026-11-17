import fs from 'node:fs';
import path from 'node:path';

export const defaults = { Username: '', Command: '!', ReadAll: false, Engine: 'Windows', Voice: '', Model: '', PiperExe: '', Speed: 1, Volume: 80, Cooldown: 8, MaxLength: 200, Blocked: [], Enabled: true, AudioDevice: '', MaxQueue: 50, BlockLinks: true, BlockedUsers: [], Speaker: 0 };
export function validateSettings(input, checkFiles = true) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Configuración inválida');
  const s = { ...defaults, ...Object.fromEntries(Object.keys(defaults).filter(key => Object.hasOwn(input, key)).map(key => [key, input[key]])) };
  for (const [key, min, max] of [['Speed', .5, 2], ['Volume', 0, 100], ['Cooldown', 0, 3600], ['MaxLength', 1, 500], ['MaxQueue', 1, 200], ['Speaker', 0, 10000]]) {
    const n = s[key];
    if (typeof n !== 'number' || !Number.isFinite(n) || n < min || n > max || (key !== 'Speed' && !Number.isInteger(n))) throw new Error(`Valor inválido: ${key}`);
  }
  for (const key of ['Username', 'Command', 'Voice', 'PiperExe', 'Model', 'AudioDevice']) {
    if (typeof s[key] !== 'string' || s[key].length > 4096) throw new Error(`${key} debe ser texto válido`);
  }
  if (!['Windows', 'Piper'].includes(s.Engine) || typeof s.ReadAll !== 'boolean') throw new Error('Motor o modo inválido');
  if (typeof s.Enabled !== 'boolean' || typeof s.BlockLinks !== 'boolean') throw new Error('Los interruptores deben ser booleanos');
  s.Command = s.Command.trim();
  if (!s.ReadAll && (!s.Command || s.Command.length > 30 || /\s/u.test(s.Command))) throw new Error('El comando debe tener de 1 a 30 caracteres sin espacios');
  if (!Array.isArray(s.Blocked) || s.Blocked.length > 1000 || s.Blocked.some(w => typeof w !== 'string')) throw new Error('Palabras bloqueadas inválidas');
  s.Blocked = [...new Set(s.Blocked.map(w => w.trim()).filter(Boolean))];
  if (!Array.isArray(s.BlockedUsers) || s.BlockedUsers.length > 1000 || s.BlockedUsers.some(w => typeof w !== 'string')) throw new Error('Usuarios bloqueados inválidos');
  s.BlockedUsers = [...new Set(s.BlockedUsers.map(w => w.trim().replace(/^@/, '').toLowerCase()).filter(Boolean))];
  if (checkFiles && s.Engine === 'Piper') {
    for (const key of ['Model', 'PiperExe']) {
      try { if (!fs.statSync(s[key]).isFile()) throw new Error(); }
      catch { throw new Error(`No se encuentra ${key}. Revisa la ruta o selecciona Windows.`); }
    }
    if (!fs.existsSync(s.Model + '.json')) throw new Error('El modelo necesita su archivo .onnx.json al lado');
    const config = JSON.parse(fs.readFileSync(s.Model + '.json', 'utf8').replace(/^\uFEFF/, ''));
    if (s.Speaker >= (config.num_speakers || 1)) throw new Error('El hablante seleccionado no existe en ese modelo');
  }
  return s;
}

export class SettingsStore {
  constructor(dataDir, legacyFile) {
    fs.mkdirSync(dataDir, { recursive: true });
    this.file = path.join(dataDir, 'tts.json');
    if (!fs.existsSync(this.file)) {
      if (legacyFile && fs.existsSync(legacyFile)) fs.copyFileSync(legacyFile, this.file);
      else this.save({ ...defaults });
    }
    this.current = validateSettings(JSON.parse(fs.readFileSync(this.file, 'utf8').replace(/^\uFEFF/, '')), false);
  }
  read() { return structuredClone(this.current); }
  save(input) {
    const value = validateSettings(input);
    fs.writeFileSync(this.file + '.tmp', JSON.stringify(value, null, 2), 'utf8');
    fs.renameSync(this.file + '.tmp', this.file);
    this.current = value;
  }
}
