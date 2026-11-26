import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { Center } from './backend/center.js';
import { createDashboardServer } from './backend/http.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.STUDIO_PORT || 17900);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('STUDIO_PORT debe estar entre 1024 y 65535');
const center = new Center({ root });
const dashboard = createDashboardServer(center);
dashboard.server.once('error', async error => {
  console.error(error.code === 'EADDRINUSE' ? `El puerto ${port} está ocupado. Cierra la versión anterior antes de iniciar Node.` : error.message);
  await dashboard.close(); process.exitCode = 1;
});
dashboard.server.listen(port, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${port}`;
  console.log(`Stream Buddy · Node ${process.versions.node}\n${url}\nCtrl+C para cerrar el centro y sus procesos.`);
  center.log('Centro Node iniciado · módulos TTS, Layout y AdQueue disponibles');
  void center.poll();
  if (!process.argv.includes('--no-browser') && process.platform === 'win32') {
    const browser = spawn('rundll32.exe', ['url.dll,FileProtocolHandler', url], { windowsHide: true, stdio: 'ignore' });
    browser.on('error', error => center.log(`Abre el panel manualmente: ${url} (${error.message})`));
    browser.unref();
  }
});
let closing = false;
async function close() {
  if (closing) return; closing = true;
  console.log('Cerrando Stream Buddy…');
  await dashboard.close();
}
process.on('SIGINT', close); process.on('SIGTERM', close);
