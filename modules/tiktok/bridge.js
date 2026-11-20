import { createInterface } from 'node:readline';
import path from 'node:path';
import { LocalTikTokClient } from './local-client.js';

const [username, browser, profile] = process.argv.slice(2);
if (!/^[a-zA-Z0-9_.]{1,64}$/.test(username || '') || !browser || !profile || !path.isAbsolute(profile)) throw new Error('Configuración del navegador inválida');
const emit = event => {
  process.stdout.write(JSON.stringify(event) + '\n');
  if (event.kind === 'closed') { input.close(); process.stdin.destroy(); }
};
const client = new LocalTikTokClient({ username, browser, profile, emit });
const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
let ending = false;
async function end() {
  if (ending) return; ending = true;
  await client.close(); input.close(); process.stdin.destroy();
}
input.on('line', line => {
  if (line.length > 10000) return;
  let request; try { request = JSON.parse(line); } catch { return; }
  if (request.action === 'close') { void end(); return; }
  if (request.action === 'send' && typeof request.id === 'string') {
    void client.send(request.text).then(() => emit({ kind: 'sent', id: request.id }), error => emit({ kind: 'send-error', id: request.id, text: error.message }));
  }
  if (request.action === 'set-session' && typeof request.id === 'string') {
    void ready.then(() => client.setSession(request)).then(() => emit({ kind: 'session-applied', id: request.id }), () => emit({ kind: 'session-error', id: request.id, text: 'No se pudo cargar la sesión. Revisa los valores y vuelve a conectar el navegador.' }));
  }
});
input.on('close', () => { void end(); });
process.once('SIGINT', () => { void end(); }); process.once('SIGTERM', () => { void end(); });
const ready = client.start();
try { await ready; }
catch { emit({ kind: 'error', text: 'No se pudo iniciar el navegador local. Cierra la ventana del conector si ya estaba abierta y vuelve a conectar.' }); await end(); process.exitCode = 1; }
