import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EventEmitter } from 'node:events';
import { defaults, SettingsStore, validateSettings } from '../backend/settings.js';
import { TTSModule, filterText } from '../backend/modules/tts.js';
import { LocalToolModule } from '../backend/modules/local-tool.js';
import { ProcessManager } from '../backend/processes.js';
import { Center } from '../backend/center.js';
import { createDashboardServer } from '../backend/http.js';
import { createLayoutModule } from '../backend/modules/layout.js';
import { defaultLayout } from '../shared/layout.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function scratch(t) {
  const dir = path.join(root, 'tests', `scratch-${crypto.randomUUID()}`);
  fs.mkdirSync(dir);
  t.after(() => {
    // Only known flat test files are removed; never recurse over user data.
    for (const file of fs.readdirSync(dir)) {
      if(file==='notification-assets'){const assets=path.join(dir,file);for(const name of fs.readdirSync(assets))fs.unlinkSync(path.join(assets,name));fs.rmdirSync(assets);}
      else fs.unlinkSync(path.join(dir, file));
    }
    fs.rmdirSync(dir);
  });
  return dir;
}
class FakeProcesses {
  constructor() { this.children = new Set(); this.starts = []; }
  start(command, args, onLine) {
    const child = new EventEmitter(); child.onLine = onLine;
    this.children.add(child); this.starts.push({ command, args, child }); return child;
  }
  async stop(child) { if (child) { this.children.delete(child); child.emit('close', 0); } }
  async close() { for (const child of this.children) await this.stop(child); }
}
function ttsFixture(t, config = {}) {
  const dataDir = scratch(t), settings = new SettingsStore(dataDir);
  settings.save({ ...defaults, Cooldown: 0, ...config });
  const processes = new FakeProcesses();
  const module = new TTSModule({ root, dataDir, settings, processes, log() {}, changed() {} });
  return { module, settings, processes };
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('filters preserve named command boundaries, symbols, blocked words and links', () => {
  const s = { ...defaults, Command: '!tts', Blocked: ['spam'] };
  for (const text of ['!ttss hola', '!tts ', '!tts www.test.com', '!tts SPAM']) assert.equal(filterText(text, s), null);
  assert.equal(filterText('!TTS hola', s), 'hola');
  assert.equal(filterText('!hola', { ...s, Command: '!' }), 'hola');
  assert.equal(filterText('hola', { ...s, ReadAll: true }), 'hola');
});
test('settings reject invalid ranges, unsupported engines and voices, booleans and noninteger cooldowns', () => {
  for (const value of [{ Speed: NaN }, { Volume: 101 }, { Volume: true }, { Cooldown: .5 }, { ReadAll: 'true' }, { Engine: 'other' }, { PocketVoice: 'other' }, { Blocked: [1] }]) {
    assert.throws(() => validateSettings({ ...defaults, ...value }));
  }
});
test('existing UTF-8 BOM configuration is loaded without rewriting; saves are atomic', t => {
  const dir = scratch(t), file = path.join(dir, 'tts.json');
  const original = '\uFEFF' + JSON.stringify({ ...defaults, Username: 'usuario', Engine: 'Piper', Model: 'missing', PiperExe: 'missing' });
  fs.writeFileSync(file, original);
  const settings = new SettingsStore(dir);
  assert.equal(settings.read().Username, 'usuario');
  assert.equal(settings.read().Engine, 'PocketTTS');
  assert.equal(fs.readFileSync(file, 'utf8'), original);
  settings.save({ ...settings.read(), Engine: 'Windows', Volume: 55 });
  assert.equal(new SettingsStore(dir).read().Volume, 55);
  assert.equal(fs.existsSync(file + '.tmp'), false);
});
test('cooldowns and maximum queue length are enforced', t => {
  const { module, settings } = ttsFixture(t, { Cooldown: 5 }); module.paused = true;
  module.enqueue('same', '!hola'); assert.match(module.enqueue('same', '!otra'), /Espera/);
  settings.save({ ...settings.read(), Cooldown: 0 });
  for (let i = 0; i < 49; i++) module.enqueue(String(i), '!hola');
  assert.equal(module.queue.length, 50); assert.match(module.enqueue('extra', '!hola'), /llena/);
});
test('speech is serial, pause holds queued messages and skip starts the next job', async t => {
  const { module, processes } = ttsFixture(t); module.paused = true;
  module.enqueue('1', '!primero'); module.enqueue('2', '!segundo');
  await tick(); assert.equal(processes.starts.length, 0);
  module.pause(); assert.equal(processes.starts.length, 1); assert.equal(module.queue.length, 1);
  await module.stop(false); await tick();
  assert.equal(processes.starts.length, 2); assert.equal(module.queue.length, 0);
  await module.close();
});
test('stop clears queued messages and prevents an unintended next speech', async t => {
  const { module, processes } = ttsFixture(t);
  module.enqueue('1', '!primero'); module.enqueue('2', '!segundo'); await tick();
  await module.stop(true); await tick();
  assert.equal(processes.starts.length, 1); assert.equal(module.queue.length, 0); assert.equal(module.speaker, null);
});
test('connector forwards chat to the queue and resets state after exit', async t => {
  const { module, processes } = ttsFixture(t, { Username: 'test' }); module.paused = true;
  const alerts=[];module.onLiveEvent=event=>alerts.push(event);
  module.connectorPython = () => 'fake-python';
  module.connect(); const child = processes.starts[0].child;
  child.onLine(JSON.stringify({ kind: 'status', text: 'Conectado al directo @test' }));
  child.onLine(JSON.stringify({ kind: 'comment', user: 'u', text: '!hola' }));
  for(const kind of ['follow','gift','share','superfan','like']) child.onLine(JSON.stringify({kind,user:'u',gift:'Rosa',count:3}));
  assert.deepEqual(alerts.map(event=>event.kind),['follow','gift','share','superfan','like']);
  assert.equal(module.connected, true); assert.equal(module.queue.length, 1);
  assert.throws(() => module.connect(), /activa/);
  await module.disconnect(); assert.equal(module.connected, false); assert.equal(module.bridge, null);
});
test('tool reuses external instances and never takes ownership of them', async () => {
  const processes = new FakeProcesses();
  const tool = new LocalToolModule({ id: 'test', name: 'Test', url: 'http://127.0.0.1:1', requiredFile: root, processes, changed() {}, log() {} });
  tool.health = async () => { tool.running = true; return true; };
  await Promise.all([tool.start(), tool.start()]);
  assert.equal(processes.starts.length, 0); assert.equal(tool.state().managed, false);
  await tool.close();
});

test('connector reports missing Python and preserves explicit TikTok errors', t => {
  const {module,processes}=ttsFixture(t,{Username:'test'});
  module.connectorPython=()=> 'fake-python';module.connect();
  const child=processes.starts[0].child;
  child.onLine("did not find executable at 'old/python.exe'");child.onLine('');child.emit('close',1);
  assert.match(module.lastError,/Preparar/);assert.equal(module.state().connecting,false);
  module.connect();const second=processes.starts[1].child;
  second.onLine(JSON.stringify({kind:'error',text:'Error de TikTok específico'}));second.emit('close',1);
  assert.equal(module.lastError,'Error de TikTok específico');
});

test('connector repair uses system Python instead of a broken sibling environment and checks imports', async t => {
  const {module,processes}=ttsFixture(t);const calls=[];
  module.connectorPython=()=> 'broken-python';
  processes.run=async(command,args)=>calls.push({command,args});
  await module.install();
  assert.equal(calls[0].command,'py.exe');assert.deepEqual(calls[0].args.slice(0,3),['-3','-m','venv']);
  assert.equal(calls[1].args[1],'pip');assert.match(calls[2].args[1],/SuperFanEvent/);
  assert.equal(module.lastError,null);assert.equal(module.installing,false);
});
test('missing tools fail before spawning a process', async () => {
  const processes = new FakeProcesses();
  const tool = new LocalToolModule({ name: 'Missing', url: 'http://127.0.0.1:1', requiredFile: path.join(root, 'not-present.exe'), processes, changed() {}, log() {} });
  tool.health = async () => false;
  await assert.rejects(tool.start(), /No se encuentra/); assert.equal(processes.starts.length, 0);
});
test('process manager reports spawn failures and cleans its registry', async () => {
  const logs = [], processes = new ProcessManager(text => logs.push(text));
  await assert.rejects(processes.run(path.join(root, 'missing-program.exe'), []));
  await tick(); await tick();
  assert.ok(logs.length); await processes.close();
});
test('HTTP serves dashboard, validates origin/token, persists settings and streams updates', async t => {
  const dataDir = scratch(t), processes = new FakeProcesses();
  const tools = Object.fromEntries(['layout', 'ads'].map(id => [id, { state: () => ({ running: false, available: true }), health: async () => false, start: async () => {} }]));
  const center = new Center({ root, dataDir, processes, tools, legacyFile: path.join(dataDir, 'absent') });
  center.tools.layout=createLayoutModule({dataDir,changed:()=>center.changed(),log:()=>{}});
  const dashboard = createDashboardServer(center);
  await new Promise(resolve => dashboard.server.listen(0, '127.0.0.1', resolve));
  t.after(() => dashboard.close());
  const base = `http://127.0.0.1:${dashboard.server.address().port}`;
  assert.match(await (await fetch(base)).text(), /LIVE STUDIO/);
  const html = await (await fetch(base)).text();
  for (const route of ['/tts', '/layout', '/layout/', '/output/layout', '/ads', '/notifications', '/likes']) {
    const page = await fetch(base + route);
    assert.equal(page.status, 200);
    assert.equal(await page.text(), html);
    assert.equal(page.headers.get('cache-control'), 'no-store');
  }
  for (const route of ['/unknown', '/api/missing', '/package.json']) assert.equal((await fetch(base + route)).status, 404);
  const script = html.match(/src="([^"]+\.js)"/)[1];
  const asset = await fetch(base + script);
  assert.equal(asset.status, 200);
  assert.match(asset.headers.get('content-type'), /javascript/);
  assert.match(asset.headers.get('cache-control'), /immutable/);
  for (const route of ['/?spotify-output=1', '/?notifications-output=1', '/commands?commands-output=1', '/output/layout', script]) {
    const page = await fetch(base + route);
    const head = await fetch(base + route, { method: 'HEAD' });
    assert.equal(head.status, 200, route);
    assert.equal(head.headers.get('content-type'), page.headers.get('content-type'));
    assert.equal(Number(head.headers.get('content-length')), (await page.arrayBuffer()).byteLength);
    assert.equal(await head.text(), '');
  }
  assert.equal((await fetch(base + '/api/events', { method: 'HEAD' })).status, 404);
  assert.equal((await fetch(base + '/assets/missing.js')).status, 404);
  assert.equal((await fetch(base + '/assets/%2e%2e%2f%2e%2e%2fpackage.json')).status, 404);
  const state = await (await fetch(base + '/api/state')).json(); assert.equal(state.backend, 'node');
  const post = (action, body, headers = {}) => fetch(base + '/api/' + action, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  assert.equal((await post('settings', defaults)).status, 403);
  assert.equal((await post('settings', defaults, { 'X-Studio': state.token, Origin: 'https://example.com' })).status, 403);
  assert.equal((await post('settings', { ...defaults, Volume: 101 }, { 'X-Studio': state.token })).status, 400);
  assert.equal((await post('settings', { ...defaults, Volume: 33 }, { 'X-Studio': state.token })).status, 200);
  assert.equal(center.settings.read().Volume, 33);
  const gif='R0lGODlhAQABAIAAAAAAAP///yH5BAAAAAAALAAAAAABAAEAAAIBRAA7';
  assert.equal((await post('notifications/upload',{data:'data:image/gif;base64,'+gif})).status,403);
  const upload=await post('notifications/upload',{data:'data:image/gif;base64,'+gif},{'X-Studio':state.token});
  assert.equal(upload.status,200);
  const uploaded=await upload.json();assert.match(uploaded.image,/\.gif$/);
  const image=await fetch(base+uploaded.image);
  assert.equal(image.headers.get('content-type'),'image/gif');
  assert.deepEqual(Buffer.from(await image.arrayBuffer()),Buffer.from(gif,'base64'));
  const partial=await fetch(base+uploaded.image,{headers:{Range:'bytes=2-5'}});
  assert.equal(partial.status,206);assert.deepEqual(Buffer.from(await partial.arrayBuffer()),Buffer.from(gif,'base64').subarray(2,6));
  assert.equal((await fetch(base+uploaded.image,{headers:{Range:'bytes=999999-'}})).status,416);
  assert.equal((await fetch(base+'/notification-assets/not-an-image')).status,404);
  assert.equal((await post('notifications/test', {type:'gift'}, {'X-Studio':state.token})).status,200);
  assert.equal(center.notifications.state().current.type,'gift');
  assert.equal((await post('notifications/clear', {}, {'X-Studio':state.token})).status,200);
  center.tts.onLiveEvent({kind:'follow',user:'Nuevo seguidor'});
  center.tts.onLiveEvent({kind:'like',userId:'viewer-1',user:'Ana',count:12,messageId:'like-1'});
  assert.equal(center.likes.state().ranking[0].likes,12);
  const likesSaved=await post('likes/save',{...center.likes.state().config,title:'Top de prueba'},{'X-Studio':state.token});
  assert.equal(likesSaved.status,200);assert.ok((await likesSaved.json()).notificationRevision);
  assert.equal((await post('likes/export',{})).status,403);
  const scoreboard=await post('likes/export',{}, {'X-Studio':state.token});
  assert.equal(scoreboard.status,200);assert.equal((await scoreboard.json()).users[0].likes,12);
  assert.match(center.notifications.state().current.message,/Nuevo seguidor/);
  const revisionBefore=center.tools.layout.state().revision;
  const saved=await post('layout/save',{...defaultLayout,theme:'custom-http',customThemes:[{id:'custom-http',name:'HTTP theme',css:'.layout-title { color: cyan; }'}]},{'X-Studio':state.token});
  assert.equal(saved.status,200);
  const receipt=await saved.json();assert.ok(receipt.layoutRevision>revisionBefore);
  assert.equal(receipt.layoutRevision,center.tools.layout.state().revision);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dataDir,'layout.json'),'utf8')).customThemes[0].name,'HTTP theme');
  const portable={...defaultLayout,backgroundImage:'data:image/png;base64,'+'AAAA'.repeat(6000)};
  assert.equal((await post('layout/create',{name:'Privada',document:portable})).status,403);
  const created=await post('layout/create',{name:'Mi composición',document:portable},{'X-Studio':state.token});
  assert.equal(created.status,200,'Composition images may exceed the generic 20 KB request limit');
  const {compositionId}=await created.json();assert.ok(compositionId);
  assert.equal((await fetch(base+'/layout/'+compositionId)).status,200);
  const output = await fetch(base+'/output/layout/'+compositionId);
  assert.equal(output.status,200);
  assert.equal(output.headers.get('cache-control'),'no-store');
  assert.match(output.headers.get('content-type'),/^text\/html/);
  const updated=await post('layout/save-composition',{id:compositionId,document:portable},{'X-Studio':state.token});
  assert.equal(updated.status,200);assert.ok((await updated.json()).layoutRevision);
  assert.equal((await post('layout/rename',{id:compositionId,name:'Nuevo nombre'},{'X-Studio':state.token})).status,200);
  assert.equal(center.tools.layout.state().compositions[0].name,'Nuevo nombre');
  const replacement=await post('layout/create',{name:'Otra composición',document:defaultLayout},{'X-Studio':state.token});
  const survivingId=(await replacement.json()).compositionId;
  assert.equal((await post('layout/delete',{id:compositionId})).status,403);
  assert.equal((await post('layout/delete',{id:compositionId},{'X-Studio':state.token})).status,200);
  assert.equal((await post('layout/delete',{id:compositionId},{'X-Studio':state.token})).status,400);
  assert.deepEqual(center.tools.layout.state().compositions.map(item=>item.id),[survivingId]);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dataDir,'layout-compositions.json'),'utf8')).map(item=>item.id),[survivingId]);
  assert.equal(center.tools.layout.state().document.theme,'custom-http');
  assert.equal((await post('start', { tool: 'unknown' }, { 'X-Studio': state.token })).status, 400);
  const controller = new AbortController();
  const stream = await fetch(base + '/api/events', { signal: controller.signal });
  assert.match(stream.headers.get('content-type'), /event-stream/);
  const reader = stream.body.getReader();
  const decoder = new TextDecoder();
  const readUntil = async pattern => {
    let text = '';
    while (!pattern.test(text)) {
      const update = await Promise.race([reader.read(), new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('SSE no respondió')), 3000); timer.unref(); })]);
      if (update.done) break;
      text += decoder.decode(update.value, { stream: true });
    }
    return text;
  };
  const initial = await readUntil(/"Volume":33/); assert.match(initial, /"Volume":33/);
  center.log('evento de prueba');
  assert.match(await readUntil(/evento de prueba/), /evento de prueba/);
  controller.abort(); await reader.cancel().catch(() => {});
  const outputStream = await fetch(base + '/api/events?output=likes', { signal: AbortSignal.timeout(5000) });
  assert.equal(outputStream.status, 200);
  const outputEvents = await outputStream.text();
  const firstOutput = JSON.parse(outputEvents.match(/^data: (.+)$/m)[1]);
  assert.deepEqual(Object.keys(firstOutput), ['tools']);
  assert.deepEqual(Object.keys(firstOutput.tools), ['likes']);
  assert.match(outputEvents, /^retry: 350$/m);
  assert.match(outputEvents, /event: rotate\ndata: \{\}\n\n$/);
});
