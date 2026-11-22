import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export function createSpotifyLocalReader({ execute = execFile, platform = process.platform } = {}) {
  let child = null, closed = false;
  return {
    read() {
      if (closed) return Promise.reject(new Error('El lector de música local está cerrado.'));
      if (platform !== 'win32') return Promise.reject(new Error('La lectura local de Spotify y AIMP requiere Windows 10 o posterior.'));
      if (child) return Promise.reject(new Error('La lectura de música local sigue en curso.'));
      return new Promise((resolve, reject) => {
        child = execute('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', fileURLToPath(new URL('../../modules/spotify/now-playing.ps1', import.meta.url))], { windowsHide: true, timeout: 12000, maxBuffer: 900000, encoding: 'utf8' }, (error, stdout) => {
          child = null;
          if (closed) return reject(new Error('El lector de música local está cerrado.'));
          if (error) return reject(new Error('No se pudo leer la reproducción local. Abre Spotify de escritorio o AIMP y vuelve a intentarlo.'));
          try {
            const result = JSON.parse(stdout.trim().replace(/^\uFEFF/, ''));
            if (result.error || typeof result.available !== 'boolean') throw new Error();
            resolve(result);
          } catch { reject(new Error('Windows no entregó información válida de reproducción.')); }
        });
      });
    },
    close() { closed = true; child?.kill(); child = null; },
  };
}

export function localPlayback(value, now) {
  if (!value || typeof value.title !== 'string' || !value.title.trim()) return null;
  const duration = Number.isFinite(value.duration) ? Math.max(0, value.duration) : 0;
  return {
    ...(value.source === 'aimp' ? { source: 'aimp' } : {}),
    title: value.title.slice(0, 300), artist: String(value.artist || '').slice(0, 400),
    image: typeof value.image === 'string' && value.image.length <= 700000 && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value.image) ? value.image : '',
    url: '', duration, progress: Number.isFinite(value.progress) ? Math.min(duration, Math.max(0, value.progress)) : 0,
    playing: value.playing === true, updatedAt: now,
  };
}
