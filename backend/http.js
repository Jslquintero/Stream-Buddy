import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

const mimeTypes = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };

export function createDashboardServer(center) {
  const token = randomBytes(32).toString('hex');
  const clients = new Set();
  let publishTimer;
  const snapshot = () => ({ ...center.snapshot(), token });
  const publish = () => {
    if (publishTimer) return;
    publishTimer = setTimeout(() => {
      publishTimer = null;
      const data = `data: ${JSON.stringify(snapshot())}\n\n`;
      // Slow tabs receive the latest state on the next update, without buffering
      // every download-progress event or dropping large catalog snapshots.
      for (const client of clients) if (!client.writableNeedDrain && !client.destroyed) client.write(data);
    }, 30);
  };
  center.on('state', publish);
  function json(res, code, value) {
    res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(JSON.stringify(value));
  }
  const server = http.createServer(async (req, res) => {
    const host = `127.0.0.1:${server.address().port}`;
    const origin = `http://${host}`;
    if (req.headers.host !== host || (req.headers.origin && req.headers.origin !== origin)) return json(res, 403, { error: 'Solicitud no autorizada' });
    try {
      const url = new URL(req.url, origin);
      if (req.method === 'GET') {
        if (url.pathname === '/api/state') return json(res, 200, snapshot());
        if (url.pathname === '/api/events') {
          if (clients.size >= 20) return json(res, 503, { error: 'Demasiadas conexiones' });
          res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Content-Type-Options': 'nosniff' });
          res.write(`data: ${JSON.stringify(snapshot())}\n\n`);
          clients.add(res); res.on('close', () => clients.delete(res)); return;
        }
        const publicRoot = path.resolve(center.root, 'dist');
        const pathname = decodeURIComponent(url.pathname);
        const file = path.resolve(publicRoot, '.' + (pathname === '/' ? '/index.html' : pathname));
        const relative = path.relative(publicRoot, file);
        if (relative.startsWith('..') || path.isAbsolute(relative) || (pathname !== '/' && !pathname.startsWith('/assets/'))) return json(res, 404, { error: 'No encontrado' });
        let content;
        try { content = await fs.readFile(file); }
        catch (error) { if (error.code === 'ENOENT' || error.code === 'EISDIR') return json(res, 404, { error: pathname === '/' ? 'Compila el frontend con npm run build.' : 'No encontrado' }); throw error; }
        const mime = mimeTypes[path.extname(file)];
        if (!mime) return json(res, 404, { error: 'No encontrado' });
        res.writeHead(200, { 'Content-Type': mime + '; charset=utf-8', 'Cache-Control': pathname === '/' ? 'no-store' : 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin' });
        return res.end(content);
      }
      if (req.method !== 'POST') return json(res, 405, { error: 'Método no permitido' });
      if (req.headers['x-studio'] !== token) return json(res, 403, { error: 'Solicitud no autorizada' });
      let bytes = 0; const chunks = [];
      for await (const chunk of req) {
        bytes += chunk.length;
        if (bytes > (url.pathname === '/api/layout/save' ? 8000000 : 20000)) { json(res, 413, { error: 'Solicitud demasiado grande' }); return; }
        chunks.push(chunk);
      }
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Solicitud inválida');
      const action = url.pathname.startsWith('/api/') ? url.pathname.slice(5) : '';
      if (!await center.command(action, body)) return json(res, 404, { error: 'No encontrado' });
      json(res, 200, { ok: true, ...(action==='layout/save'?{layoutRevision:center.tools.layout.state().revision}:{}) });
    } catch (error) {
      if (!res.headersSent) json(res, 400, { error: error.message });
      else res.end();
    }
  });
  server.requestTimeout = 15000; server.headersTimeout = 10000;
  const heartbeat = setInterval(() => { for (const client of clients) if (!client.writableNeedDrain) client.write(': heartbeat\n\n'); }, 15000);
  heartbeat.unref();
  const poller = setInterval(() => center.poll().catch(error => center.log(error.message)), 2500);
  poller.unref();
  return {
    server,
    async close() {
      clearInterval(heartbeat); clearInterval(poller); clearTimeout(publishTimer);
      center.off('state', publish);
      for (const client of clients) client.end();
      const closed = new Promise(resolve => server.close(resolve));
      server.closeAllConnections();
      await center.close(); await closed;
    }
  };
}
