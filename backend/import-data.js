import fs from 'node:fs';
import path from 'node:path';
import { StudioProfiles } from './profiles.js';
import { validateSettings } from './settings.js';

export function importStudioData(root, selectedFolder, destination) {
  if (fs.existsSync(destination)) return;
  const isDataDirectory = folder => ['profiles.json', 'tts.json'].some(name =>
    fs.statSync(path.join(folder, name), { throwIfNoEntry: false })?.isFile());
  const candidate = isDataDirectory(selectedFolder) ? selectedFolder : path.join(selectedFolder, 'data');
  if (!isDataDirectory(candidate)) throw new Error('Selecciona la carpeta anterior de Stream Buddy o su carpeta data.');

  const parent = fs.realpathSync(path.dirname(destination));
  const source = fs.realpathSync(candidate);
  const relative = path.relative(source, parent);
  if (!relative || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + path.sep))) {
    throw new Error('Selecciona los datos de la instalación anterior en otra carpeta.');
  }

  const staging = fs.mkdtempSync(path.join(parent, 'import-'));
  try {
    fs.cpSync(source, staging, {
      recursive: true,
      filter: entry => {
        const stat = fs.lstatSync(entry);
        return (stat.isDirectory() || stat.isFile()) && !/^speech\.json(?:\.|$)|\.tmp$/i.test(path.basename(entry));
      },
    });
    const profiles = new StudioProfiles(root, { dataDir: staging });
    for (const { id } of profiles.state().items) {
      const folder = id === 'default' ? staging : path.join(staging, 'profiles', id);
      const file = path.join(folder, 'tts.json');
      if (fs.existsSync(file)) validateSettings(JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')));
    }
    if (!fs.existsSync(destination)) fs.renameSync(staging, destination);
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
}
