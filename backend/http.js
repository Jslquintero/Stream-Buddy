import http from 'node:http';
import { viewForPath } from '../shared/routes.js';
import { layoutOutputId } from '../shared/layout-url.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

const mimeTypes = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
const outputTools = new Set(['spotify', 'likes', 'gifters', 'notifications', 'commands', 'layout', 'social']);
const outputStreamLifetime = 3000;

export function createDashboardServer(center) {
  const token = randomBytes(32).toString('hex');
  const clients = new Map();
  let publishTimer;
  const snapshot = () => ({ ...center.snapshot(), token });
  const eventData = output => {
    const data = output ? { tools: { [output]: center.tools[output].state() } } : snapshot();
    return `data: ${JSON.stringify(data)}\n\n`;
  };
  const publish = () => {
    if (publishTimer) return;
    publishTimer = setTimeout(() => {
      publishTimer = null;
      if (!clients.size) return;
      const messages = new Map();
      // Slow tabs receive the latest state on the next update, without buffering
      // every download-progress event or dropping large catalog snapshots.
      for (const [client, output] of clients) {
        if (client.writableNeedDrain || client.destroyed || client.writableEnded) continue;
        if (!messages.has(output)) messages.set(output, eventData(output));
        client.write(messages.get(output));
      }
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
        if (url.pathname === '/api/spotify/callback') {
          await center.spotify.callback(url.searchParams);
          res.writeHead(303, { Location: '/spotify', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
          return res.end();
        }
        if(url.pathname.startsWith('/notification-fonts/')){
          const font=center.notifications.fonts.read(url.pathname.slice('/notification-fonts/'.length));
          if(!font)return json(res,404,{error:'Fuente no encontrada'});
          res.writeHead(200,{'Content-Type':font.mime,'Cache-Control':'public, max-age=31536000, immutable','X-Content-Type-Options':'nosniff'});return res.end(font.bytes);
        }
        if (url.pathname.startsWith('/notification-assets/')) {
          const asset = center.notifications.assets.read(url.pathname.slice('/notification-assets/'.length));
          if (!asset) return json(res,404,{error:'Imagen no encontrada'});
          const headers={'Content-Type':asset.mime,'Content-Length':asset.bytes.length,'Cache-Control':'public, max-age=31536000, immutable','X-Content-Type-Options':'nosniff','Accept-Ranges':'bytes'};
          if(req.headers.range){
            const match=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
            const start=match?(match[1]?Number(match[1]):Math.max(0,asset.bytes.length-Number(match[2]))):NaN;
            const end=match?(match[1]&&match[2]?Math.min(Number(match[2]),asset.bytes.length-1):asset.bytes.length-1):NaN;
            if(!match||(!match[1]&&!match[2])||!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=asset.bytes.length){res.writeHead(416,{'Content-Range':`bytes */${asset.bytes.length}`});return res.end();}
            res.writeHead(206,{...headers,'Content-Length':end-start+1,'Content-Range':`bytes ${start}-${end}/${asset.bytes.length}`});return res.end(asset.bytes.subarray(start,end+1));
          }
          res.writeHead(200, headers);
          return res.end(asset.bytes);
        }
        if (url.pathname === '/api/state') return json(res, 200, snapshot());
        if (url.pathname === '/api/events') {
          if (clients.size >= 20) return json(res, 503, { error: 'Demasiadas conexiones' });
          const output = url.searchParams.get('output');
          if (output !== null && !outputTools.has(output)) return json(res, 400, { error: 'Salida no válida' });
          res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Content-Type-Options': 'nosniff' });
          if (output) res.write('retry: 350\n\n');
          res.write(eventData(output));
          clients.set(res, output);
          // Leave a gap for document and asset requests when Chromium fills its HTTP/1.1 connection pool.
          const rotation = output ? setTimeout(() => res.end('event: rotate\ndata: {}\n\n'), outputStreamLifetime) : null;
          res.on('close', () => {
            clearTimeout(rotation);
            clients.delete(res);
          });
          return;
        }
      }
      if (req.method === 'GET' || req.method === 'HEAD') {
        const publicRoot = path.resolve(center.root, 'dist');
        const pathname = decodeURIComponent(url.pathname);
        const isPage = viewForPath(pathname) !== null || layoutOutputId(pathname) !== undefined;
        const file = path.resolve(publicRoot, '.' + (isPage ? '/index.html' : pathname));
        const relative = path.relative(publicRoot, file);
        if (relative.startsWith('..') || path.isAbsolute(relative) || (!isPage && !pathname.startsWith('/assets/'))) return json(res, 404, { error: 'No encontrado' });
        let content;
        try { content = await fs.readFile(file); }
        catch (error) { if (error.code === 'ENOENT' || error.code === 'EISDIR') return json(res, 404, { error: isPage ? 'Compila el frontend con npm run build.' : 'No encontrado' }); throw error; }
        const mime = mimeTypes[path.extname(file)];
        if (!mime) return json(res, 404, { error: 'No encontrado' });
        res.writeHead(200, { 'Content-Type': mime + '; charset=utf-8', 'Content-Length': content.length, 'Cache-Control': isPage ? 'no-store' : 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin' });
        if (req.method === 'HEAD') return res.end();
        return res.end(content);
      }
      if (req.method !== 'POST') return json(res, 405, { error: 'Método no permitido' });
      if (req.headers['x-studio'] !== token) return json(res, 403, { error: 'Solicitud no autorizada' });
      let bytes = 0; const chunks = [];
      for await (const chunk of req) {
        bytes += chunk.length;
        if (bytes > (url.pathname==='/api/notifications/upload'?43000000:['/api/layout/save','/api/layout/create','/api/layout/save-composition'].includes(url.pathname)?8000000:url.pathname==='/api/spotify/save'?850000:url.pathname==='/api/commands/save'?600000:url.pathname==='/api/social/save'?80000:20000)) { json(res, 413, { error: 'Solicitud demasiado grande' }); return; }
        chunks.push(chunk);
      }
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Solicitud inválida');
      const action = url.pathname.startsWith('/api/') ? url.pathname.slice(5) : '';
      const result = await center.command(action, body, { origin });
      if (!result) return json(res, 404, { error: 'No encontrado' });
      json(res, 200, { ok: true, ...(['spotify/connect','notifications/upload','notifications/fonts/install','likes/save','likes/export','gifters/save','gifters/export','social/save','layout/create','layout/save-composition','layout/rename'].includes(action)?result:{}), ...(action==='notifications/save'?{notificationRevision:center.notifications.state().revision}:{}), ...(action==='layout/save'?{layoutRevision:center.tools.layout.state().revision}:{}) });
    } catch (error) {
      if (!res.headersSent) json(res, 400, { error: error.message });
      else res.end();
    }
  });
  server.requestTimeout = 15000; server.headersTimeout = 10000;
  const heartbeat = setInterval(() => { for (const [client, output] of clients) if (!output && !client.writableNeedDrain && !client.writableEnded) client.write(': heartbeat\n\n'); }, 15000);
  heartbeat.unref();
  const poller = setInterval(() => center.poll().catch(error => center.log(error.message)), 2500);
  poller.unref();
  return {
    server,
    async close() {
      clearInterval(heartbeat); clearInterval(poller); clearTimeout(publishTimer);
      center.off('state', publish);
      for (const client of clients.keys()) client.end();
      const closed = new Promise(resolve => server.close(resolve));
      server.closeAllConnections();
      await center.close(); await closed;
    }
  };
}
