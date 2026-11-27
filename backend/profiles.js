import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Center } from './center.js';

const principal = { id: 'default', name: 'Principal' };
const profileId = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;

export class StudioProfiles {
  constructor(root, { dataDir = path.join(root, 'data'), desktop } = {}) {
    this.root = root;
    this.dataDir = dataDir;
    this.desktop = desktop;
    this.file = path.join(this.dataDir, 'profiles.json');
    this.current = { activeId: principal.id, items: [principal] };
    try {
      const saved = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      if (!Array.isArray(saved.items) || saved.items.some(item =>
        !item || (item.id !== principal.id && !profileId.test(item.id)) || typeof item.name !== 'string' || !item.name.trim()) ||
        !saved.items.some(item => item.id === principal.id) || !saved.items.some(item => item.id === saved.activeId)) {
        throw new Error('El registro de perfiles no es válido');
      }
      this.current = saved;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }

  state() { return this.current; }

  save(value) {
    fs.mkdirSync(this.dataDir, { recursive: true });
    fs.writeFileSync(this.file + '.tmp', JSON.stringify(value, null, 2), 'utf8');
    fs.renameSync(this.file + '.tmp', this.file);
    this.current = value;
  }

  create(name) {
    const title = typeof name === 'string' ? name.trim() : '';
    if (!title || title.length > 60 || /[\r\n]/.test(title)) throw new Error('Escribe un nombre de perfil de hasta 60 caracteres');
    if (this.current.items.some(item => item.name.toLowerCase() === title.toLowerCase())) throw new Error('Ya existe un perfil con ese nombre');
    this.save({ ...this.current, items: [...this.current.items, { id: randomUUID(), name: title }] });
  }

  open(id = this.current.activeId) {
    if (!this.current.items.some(item => item.id === id)) throw new Error('Perfil desconocido');
    const primary = id === principal.id;
    return new Center({
      root: this.root,
      dataDir: primary ? this.dataDir : path.join(this.dataDir, 'profiles', id),
      legacyFile: primary && !this.desktop ? undefined : null,
      desktop: this.desktop,
    });
  }

  activate(id) { this.save({ ...this.current, activeId: id }); }

  remove(id) {
    if (id === principal.id) throw new Error('El perfil Principal está protegido');
    if (!this.current.items.some(item => item.id === id)) throw new Error('Perfil desconocido');
    if (this.current.activeId === id) throw new Error('Cambia de perfil antes de eliminarlo');

    const previous = this.current;
    const directory = path.join(this.dataDir, 'profiles', id);
    const archive = path.join(this.dataDir, 'deleted-profiles');
    this.save({ ...previous, items: previous.items.filter(item => item.id !== id) });
    try {
      if (fs.existsSync(directory)) {
        fs.mkdirSync(archive, { recursive: true });
        fs.renameSync(directory, path.join(archive, id));
      }
    } catch (error) {
      this.save(previous);
      throw error;
    }
  }
}
