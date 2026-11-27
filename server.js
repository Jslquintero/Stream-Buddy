import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { importStudioData } from './backend/import-data.js';
import { StudioProfiles } from './backend/profiles.js';
import { createDashboardServer } from './backend/http.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const desktop = process.argv.includes('--desktop');
if (desktop) {
  // The launcher attaches this process to its Windows job before sending start.
  const start = await Promise.race([
    once(process.stdin, 'data').then(([chunk]) => chunk.toString() === 'start\n'),
    once(process.stdin, 'end').then(() => false),
  ]);
  if (!start || process.stdin.readableEnded) process.exit(1);
}
const port = Number(desktop ? 17900 : process.env.STUDIO_PORT || 17900);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('STUDIO_PORT debe estar entre 1024 y 65535');
let profiles;
try {
  const dataDir = process.env.STUDIO_DATA_DIR;
  if (desktop && (!dataDir || !process.env.STUDIO_TIKTOK_EXE)) throw new Error('Faltan rutas de la instalación de Stream Buddy.');
  if (desktop && process.env.STUDIO_IMPORT_FROM) importStudioData(root, process.env.STUDIO_IMPORT_FROM, dataDir);
  profiles = new StudioProfiles(root, desktop ? { dataDir, desktop: { connector: process.env.STUDIO_TIKTOK_EXE } } : undefined);
} catch (error) {
  if (desktop) console.log('STUDIO_ERROR ' + error.message.replace(/[\r\n]/g, ' '));
  throw error;
}
const center = profiles.open();
const dashboard = createDashboardServer(center, profiles);
dashboard.server.once('error', async error => {
  if (desktop) console.log('STUDIO_ERROR ' + (error.code === 'EADDRINUSE'
    ? `El puerto ${port} está ocupado. Cierra el programa que lo utiliza y vuelve a abrir Stream Buddy.`
    : error.message));
  console.error(error.code === 'EADDRINUSE' ? `El puerto ${port} está ocupado. Cierra la versión anterior antes de iniciar Node.` : error.message);
  await close(1);
});
dashboard.server.listen(port, '127.0.0.1', () => {
  if (desktop) console.log('STUDIO_READY');
  const url = `http://127.0.0.1:${port}`;
  console.log(`Stream Buddy · Node ${process.versions.node}\n${url}\nCtrl+C para cerrar el centro y sus procesos.`);
  center.log('Centro Node iniciado · módulos TTS, Layout y AdQueue disponibles');
  void center.poll();
  if (!desktop && !process.argv.includes('--no-browser') && process.platform === 'win32') {
    const browser = spawn('rundll32.exe', ['url.dll,FileProtocolHandler', url], { windowsHide: true, stdio: 'ignore' });
    browser.on('error', error => center.log(`Abre el panel manualmente: ${url} (${error.message})`));
    browser.unref();
  }
});
let closing = false;
async function close(code = 0) {
  if (closing) return; closing = true;
  console.log('Cerrando Stream Buddy…');
  await dashboard.close();
  if (desktop) process.exit(code);
  process.exitCode = code;
}
process.on('SIGINT', () => close()); process.on('SIGTERM', () => close());
if (desktop) {
  process.stdin.once('end', close);
  if (process.stdin.readableEnded) void close();
}
