import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import { defaults } from '../backend/settings.js';
import { defaultNotifications } from '../modules/notifications/config.js';
import { defaultLikes } from '../modules/likes/config.js';
import { defaultGifters } from '../modules/gifters/config.js';
import { defaultAuction } from '../modules/auction/config.js';
import { defaultSocial } from '../modules/social/config.js';
import { defaultCommands } from '../modules/commands/config.js';
const pause = () => new Promise(resolve => setTimeout(resolve,30));
test('Home copies widget URLs and the chosen layout without leaving the overview', async t => {
  const { window, publish, requests } = await mount(t, '/');
  publish({
    token: 'test', settings: defaults, tts: { resources: {} }, events: [],
    tools: {
      layout: { running: true, compositions: [{ id: 'pausa', name: 'Pausa' }] },
      ads: { available: true, running: false, url: 'http://127.0.0.1:17843' },
      notifications: { config: defaultNotifications, url: '/?notifications-output=1#tiktok.studio' },
      likes: { config: defaultLikes, url: '/?likes-output=1#tiktok.studio' },
      gifters: { config: defaultGifters, url: '/?gifters-output=1#tiktok.studio' },
      auction: { config: defaultAuction, url: '/?auction-output=1#tiktok.studio' },
      social: { config: defaultSocial, url: '/?social-output=1#tiktok.studio' },
      commands: {
        config: defaultCommands, url: '/commands?commands-output=1#tiktok.studio',
        listUrl: '/commands?commands-list-output=1#tiktok.studio',
      },
      spotify: { config: { mode: 'local', enabled: false }, url: '/?spotify-output=1#tiktok.studio' },
    },
  });

  const doc = window.document;
  const copied = [];
  let clipboardAvailable = true;
  Object.defineProperty(window.navigator, 'clipboard', { value: { writeText: async url => {
    if (!clipboardAvailable) throw new Error('Clipboard unavailable');
    copied.push(url);
  } } });
  const copy = async (label, url) => {
    const selector = `.home button[aria-label="${label}"]`;
    await until(() => doc.querySelector(selector));
    const previousCount = copied.length;
    doc.querySelector(selector).click();
    await until(() => copied.length > previousCount);
    assert.equal(copied.at(-1), url);
  };
  const origin = window.location.origin;
  await until(() => doc.querySelector('.home select'));
  const menuItems = id => [...doc.querySelectorAll(`nav [aria-labelledby="nav-${id}"] .nav-item`)].map(button => button.textContent);
  assert.deepEqual(menuItems('general'), ['Vista general', 'Voz y chat']);
  assert.deepEqual(menuItems('widgets'), ['Escenas', 'AdQueue', 'Notificaciones', 'Top likes', 'Top gifters', 'Subasta', 'Social Media Rotator', 'Comandos de chat', 'Música']);
  assert.deepEqual([...doc.querySelectorAll('.home-widget-title h3')].map(heading => heading.textContent), menuItems('widgets'));
  const widgetsToggle = doc.querySelector('[aria-labelledby="nav-widgets"] .nav-category-toggle');
  widgetsToggle.click(); await pause();
  assert.equal(doc.querySelector('#nav-widgets-items').hidden, true);
  assert.equal(widgetsToggle.getAttribute('aria-expanded'), 'false');
  assert.match(window.localStorage.getItem('live-studio.sidebar.collapsed.v1'), /"widgets":true/);
  widgetsToggle.click(); await pause();
  assert.equal(doc.querySelector('#nav-widgets-items').hidden, false);
  await copy('Copiar URL de Escenas', origin + '/output/layout#tiktok.studio');
  const select = doc.querySelector('.home select');
  select.value = 'pausa';
  select.dispatchEvent(new window.Event('change', { bubbles: true }));
  await copy('Copiar URL de Pausa', origin + '/output/layout/pausa#tiktok.studio');
  await copy('Copiar URL de AdQueue', 'http://127.0.0.1:17843/output#tiktok.studio');
  await copy('Copiar URL de Notificaciones', origin + '/?notifications-output=1#tiktok.studio');
  await copy('Copiar URL de Top likes', origin + '/?likes-output=1#tiktok.studio');
  await copy('Copiar URL de Top gifters', origin + '/?gifters-output=1#tiktok.studio');
  await copy('Copiar URL de Subasta', origin + '/?auction-output=1#tiktok.studio');
  await copy('Copiar URL de Social Media Rotator', origin + '/?social-output=1#tiktok.studio');
  await copy('Copiar URL de Comandos de chat', origin + '/commands?commands-output=1#tiktok.studio');
  await copy('Copiar URL de la lista de comandos', origin + '/commands?commands-list-output=1#tiktok.studio');
  await copy('Copiar URL de Música', origin + '/?spotify-output=1#tiktok.studio');
  const spotifyCopy = doc.querySelector('.home button[aria-label="Copiar URL de Música"]');
  await until(() => spotifyCopy.textContent === 'Copiada');
  clipboardAvailable = false;
  spotifyCopy.click();
  await until(() => doc.querySelector('.home-copy-fallback code')?.textContent === origin + '/?spotify-output=1#tiktok.studio');
  assert.equal(doc.querySelectorAll('.home .home-copy-actions button').length, 10);
  assert.equal(window.location.pathname, '/');
  assert.equal(requests.length, 0);

  const homeButtons = [...doc.querySelectorAll('.home button')];
  assert.ok(!homeButtons.some(button => button.textContent.includes('Iniciar herramientas')));
  assert.doesNotMatch(doc.querySelector('.home').textContent, /Voz y chat|Configurar voz/);
  homeButtons.find(button => button.textContent === 'AdQueue').click();
  await until(() => requests.some(request => request.url === '/api/start' && request.body.tool === 'ads'));
  assert.equal(window.location.pathname, '/ads');
});

test('Top likes applies custom CSS inside an isolated output and changes sides live',async t=>{
  const {window,publish}=await mount(t,'/?likes-output=1');
  const config={...defaultLikes,style:'medals',width:380,position:'top-left',showTitle:false,customCss:'.likes-name { color: red; }'};
  const state={tools:{likes:{config,ranking:[{id:'1',name:'Ana',likes:10}],total:10}}};
  publish(state);
  await until(()=>window.document.querySelector('.likes-css-surface')?.shadowRoot?.querySelector('.likes-name'));
  const root=window.document.querySelector('.likes-css-surface').shadowRoot;
  assert.equal(root.querySelector('.likes-name').textContent,'Ana');
  assert.equal(root.querySelector('.likes-board header'),null);
  assert.equal(root.querySelector('.likes-rank').textContent,'🥇');
  assert.equal(root.querySelectorAll('style')[1].textContent,config.customCss);
  assert.ok(window.document.querySelector('.likes-stage.top-left'));
  config.position='bottom-right';publish(state);
  await until(()=>window.document.querySelector('.likes-stage.bottom-right'));
  config.customCss='';publish(state);
  await until(()=>window.document.querySelector('.likes-board'));
  assert.equal(window.document.querySelector('.likes-css-surface'),null);
});
test('command dashboard preserves the chosen view and saves descriptions', async t => {
  const {window,publish,requests}=await mount(t,'/commands');
  window.localStorage.setItem('studio.commands.view','list');
  publish({token:'test',settings:defaults,tts:{resources:{}},events:[],tools:{layout:{},ads:{},commands:{config:structuredClone(defaultCommands)}}});
  await until(()=>window.document.querySelector('.commands-view-list'));
  window.document.querySelector('.command-row-main').click();
  await until(()=>window.document.querySelector('.commands-dialog-editor'));
  const label=Array.from(window.document.querySelectorAll('label')).find(el=>el.textContent==='Descripción corta');
  const input=window.document.getElementById(label.htmlFor);
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(input,'Invoca a Aatrox'); input.dispatchEvent(new window.Event('input',{bubbles:true}));await pause();
  Array.from(window.document.querySelectorAll('button')).find(el=>el.getAttribute('aria-label')==='Vista de cuadrícula').click();await until(()=>window.document.querySelector('.commands-view-grid'));
  assert.equal(window.localStorage.getItem('studio.commands.view'),'grid');assert.equal(input.value,'Invoca a Aatrox');
  window.document.querySelector('[aria-label="Cerrar editor"]').click();await pause();
  Array.from(window.document.querySelectorAll('button')).find(el=>el.textContent==='Guardar comandos').click();
  await until(()=>requests.some(r=>r.url==='/api/commands/save'));
  assert.equal(requests.find(r=>r.url==='/api/commands/save').body.commands[0].description,'Invoca a Aatrox');
  const opened=[];window.open=(...args)=>{opened.push(args);return {focus(){}};};
  await pause();
  Array.from(window.document.querySelectorAll('button')).find(el=>el.textContent==='Probar !comandos').click();
  await until(()=>requests.some(r=>r.url==='/api/commands/test'));
  assert.match(opened[0][0],/\/commands\?commands-list-output=1#tiktok.studio$/);
  assert.equal(requests.find(r=>r.url==='/api/commands/test').body.id,'!comandos');
});
test('dropping audio on a command uploads it through the audio field', async t => {
  const { window, publish, requests } = await mount(t, '/commands');
  publish({ token: 'test', settings: defaults, tts: { resources: {} }, events: [],
    tools: { layout: {}, ads: {}, commands: { config: structuredClone(defaultCommands) } } });
  const field = () => window.document.querySelector('.commands-dialog-editor section[aria-label="Sonido"]');
  await until(() => window.document.querySelector('.command-row-main'));
  window.document.querySelector('.command-row-main').click();
  await until(field);
  const drop = new window.Event('drop', { bubbles: true, cancelable: true });
  Object.defineProperty(drop, 'dataTransfer', { value: { files: [new window.File(['audio'], 'alerta.mp3', { type: 'audio/mpeg' })] } });
  field().dispatchEvent(drop);
  await until(() => requests.some(request => request.url === '/api/notifications/upload'));
  const upload = requests.find(request => request.url === '/api/notifications/upload');
  assert.equal(upload.body.kind, 'audio');
  assert.match(upload.body.data, /^data:audio\/mpeg;base64,/);
  assert.equal(drop.defaultPrevented, true);
});
test('command dialogs add, duplicate and delete commands before saving', async t => {
  const { window, publish, requests } = await mount(t, '/commands');
  publish({ token: 'test', settings: defaults, tts: { resources: {} }, events: [],
    tools: { layout: {}, ads: {}, commands: { config: structuredClone(defaultCommands) } } });
  await until(() => window.document.querySelector('.commands-savebar'));
  const click = text => {
    const button = Array.from(window.document.querySelectorAll('button')).find(item => item.textContent.trim() === text);
    assert.ok(button, 'Missing button: ' + text);
    button.click();
  };
  Array.from(window.document.querySelectorAll('button')).find(button => button.textContent.includes('Nuevo comando')).click();
  await until(() => window.document.querySelector('.commands-dialog-editor'));
  assert.equal(window.document.querySelectorAll('.command-row').length, 3);
  const label = Array.from(window.document.querySelectorAll('label')).find(element => element.textContent === 'Palabra del comando');
  const input = window.document.getElementById(label.htmlFor);
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, '!Nuevo');
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
  await pause();
  click('Duplicar');
  await pause();
  assert.equal(window.document.querySelectorAll('.command-row').length, 4);
  window.document.querySelector('[aria-label="Cerrar editor"]').click();
  await pause();
  const rows = window.document.querySelectorAll('.command-row');
  rows[rows.length - 1].querySelector('[aria-label^="Eliminar"]').click();
  await until(() => window.document.querySelector('.commands-dialog-confirm'));
  click('Eliminar comando');
  await pause();
  assert.equal(window.document.querySelectorAll('.command-row').length, 3);
  assert.match(window.document.querySelector('.commands-savebar').textContent, /Cambios sin guardar/);
  click('Guardar comandos');
  await until(() => requests.some(request => request.url === '/api/commands/save'));
  const saved = requests.find(request => request.url === '/api/commands/save').body;
  assert.deepEqual(saved.commands.map(row => row.command), ['!Aatrox', '!Sion', '!Nuevo']);
});
test('command help lists only command names and paginates large lists', async t => {
  const {window,publish}=await mount(t,'/commands?commands-list-output');
  const names=['!score','!send [amount] [username]','!spin','!c3','!c4','!c5','!c6'];
  const help=names.map(command=>({command,description:'Descripción oculta'}));
  const visual={id:'help',help,startedAt:Date.now(),expiresAt:Date.now()+30000};
  publish({tools:{commands:{list:visual,visual:{id:'image',image:'https://example.com/a.gif',expiresAt:Date.now()+30000},audio:{id:'sound',src:'https://example.com/a.mp3',expiresAt:Date.now()+30000}}}});await until(()=>window.document.querySelector('.commands-help'));
  const list=window.document.querySelector('.commands-help');
  assert.equal(list.querySelector('h2').textContent,'Commands:');
  assert.deepEqual(Array.from(list.querySelectorAll('li'), item=>item.textContent),names.slice(0,6));
  assert.doesNotMatch(list.textContent,/Descripción oculta/);
  visual.startedAt=Date.now()-9000;publish({tools:{commands:{list:visual,visual:{id:'image',image:'https://example.com/a.gif',expiresAt:Date.now()+30000},audio:{id:'sound',src:'https://example.com/a.mp3',expiresAt:Date.now()+30000}}}});await until(()=>window.document.querySelector('.commands-help li')?.textContent==='!c6');
  assert.equal(window.document.querySelectorAll('.commands-help li').length,1);
  assert.equal(window.document.querySelector('audio'),null);
  assert.equal(window.document.querySelector('.command-visual img'),null);
});
test('command output replaces media, interrupts old audio and clears on disconnect', async t => {
  const {window,publish,disconnect}=await mount(t,'/commands?commands-output');
  const state={tools:{commands:{visual:{id:'1',image:'https://example.com/a.gif',text:'Aatrox',expiresAt:Date.now()+10000},audio:{id:'1',src:'https://example.com/a.mp3',volume:35,expiresAt:Date.now()+10000}}}};
  state.tools.commands.list={id:'list',help:[{command:'!a',description:'Example'}],startedAt:Date.now(),expiresAt:Date.now()+30000};
  publish(state);await until(()=>window.document.querySelector('audio')?.playCalls);
  assert.equal(window.document.querySelector('.commands-help'),null);
  const old=window.document.querySelector('audio');assert.equal(old.volume,.35);
  state.tools.commands.visual={...state.tools.commands.visual,id:'2',image:'https://example.com/b.gif',text:'Otro'};
  state.tools.commands.audio={...state.tools.commands.audio,id:'2',src:'https://example.com/b.mp3'};
  publish(state);await until(()=>window.document.querySelector('audio')!==old);
  assert.ok(old.pauseCalls);assert.equal(window.document.querySelectorAll('audio').length,1);
  assert.equal(window.document.querySelectorAll('.command-visual').length,1,window.document.body.innerHTML);
  assert.equal(window.document.querySelector('.command-visual img').src,'https://example.com/b.gif');
  disconnect();await until(()=>!window.document.querySelector('audio'));
  assert.equal(window.document.querySelector('.command-visual'),null);
});
test('likes animate overtakes and demo changes stay out of the real scoreboard',async t=>{
  const {window,publish,requests}=await mount(t,'/likes');const animations=[];
  Object.defineProperty(window.HTMLElement.prototype,'offsetTop',{get(){return this.tagName==='LI'?Array.from(this.parentNode.children).indexOf(this)*80:0;}});
  window.HTMLElement.prototype.animate=function(frames){animations.push({id:this.dataset.userId,frames});return {cancel(){}};};
  const tool={config:structuredClone(defaultLikes),ranking:[{id:'1',name:'Ana',likes:100},{id:'2',name:'Luis',likes:90}],total:190,participants:2};
  const state={token:'test',settings:defaults,tts:{resources:{},queued:0},events:[],tools:{layout:{},ads:{},likes:tool}};
  publish(state);await until(()=>window.document.querySelector('.likes-board li'));animations.length=0;
  const luis=window.document.querySelector('[data-user-id="2"]');
  tool.ranking=[{id:'2',name:'Luis',likes:120},{id:'1',name:'Ana',likes:100}];publish(state);
  await until(()=>window.document.querySelector('.likes-board li')===luis);
  assert.ok(animations.some(a=>a.id==='2'&&a.frames[0].transform==='translateY(80px)'));
  assert.ok(luis.querySelector('.likes-crown'));
  await until(()=>luis.querySelector('.likes-counter>span').textContent==='120');
  const count=animations.length;publish(state);await pause();assert.equal(animations.length,count);
  const label=Array.from(window.document.querySelectorAll('label')).find(el=>el.textContent==='Ver ejemplo (solo vista previa)');
  window.document.getElementById(label.htmlFor).click();await pause();
  assert.equal(window.document.querySelector('.likes-name').textContent,'María');
  await until(()=>window.document.querySelector('.likes-name').textContent==='Carlos');
  assert.equal(requests.length,0);
  window.document.getElementById(label.htmlFor).click();await pause();assert.equal(window.document.querySelector('.likes-name').textContent,'Luis');
});
test('Top likes route autosaves design without losing edits on live updates; preview stays local',async t=>{
  const {window,publish,requests}=await mount(t,'/likes');
  const state={token:'test',settings:defaults,tts:{resources:{},queued:0},events:[],tools:{layout:{},ads:{},likes:{config:structuredClone(defaultLikes),ranking:[],total:0,participants:0}}};
  publish(state);await until(()=>window.document.querySelector('.likes-settings'));
  assert.equal(window.document.querySelector('.nav-item.active').textContent,'Top likes');
  assert.ok([...window.document.querySelectorAll('.likes-settings details')].every(section => !section.open));
  assert.ok(![...window.document.querySelectorAll('.likes-settings button')].some(button => button.textContent === 'Guardar diseño'));
  const mobileMonitor = [...window.document.querySelectorAll('.editor-mobile-view button')].find(button => button.textContent === 'Vista previa y conteo');
  mobileMonitor.click();
  await until(() => window.document.querySelector('.editor-workspace-grid').dataset.view === 'monitor');
  window.document.querySelector('.editor-mobile-view button').click();
  await until(() => window.document.querySelector('.editor-workspace-grid').dataset.view === 'editor');
  const title=window.document.querySelector('.likes-settings input:not([type])');
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(title,'Mi comunidad');title.dispatchEvent(new window.Event('input',{bubbles:true}));await pause();
  state.tools.likes.ranking=[{id:'1',name:'Ana',likes:14}];state.tools.likes.total=14;publish(state);await pause();assert.equal(title.value,'Mi comunidad');
  assert.match(window.document.querySelector('.likes-board').textContent,/Ana/);
  const demoLabel=Array.from(window.document.querySelectorAll('label')).find(el=>el.textContent==='Ver ejemplo (solo vista previa)');window.document.getElementById(demoLabel.htmlFor).click();await pause();
  assert.match(window.document.querySelector('.likes-board').textContent,/Carlos/);
  await until(()=>requests.some(r=>r.url==='/api/likes/save'));
  assert.equal(requests.find(r=>r.url==='/api/likes/save').body.title,'Mi comunidad');
  assert.equal(requests.some(r=>r.url==='/api/likes/reset'),false);
});
test('Top likes output updates ranks, escapes names and hides when disconnected or disabled',async t=>{
  const {window,publish,disconnect}=await mount(t,'/?likes-output=1');
  const state={tools:{likes:{config:defaultLikes,ranking:[{id:'1',name:'<img src=x>',likes:12}],total:12}}};
  publish(state);await until(()=>window.document.querySelector('.likes-board'));
  assert.equal(window.document.querySelector('.likes-board img'),null);assert.equal(window.document.documentElement.style.colorScheme,'normal');
  state.tools.likes.ranking=[{id:'2',name:'Luis',likes:20,avatar:'https://example.com/luis.jpg'}];publish(state);await until(()=>window.document.querySelector('.likes-name')?.textContent==='Luis');
  const avatar=window.document.querySelector('.likes-avatar img');assert.equal(avatar.src,'https://example.com/luis.jpg');
  avatar.dispatchEvent(new window.Event('error'));await until(()=>!window.document.querySelector('.likes-avatar img'));assert.equal(window.document.querySelector('.likes-avatar').textContent,'L');
  state.tools.likes.ranking[0].avatar='https://example.com/luis-new.jpg';publish(state);await until(()=>window.document.querySelector('.likes-avatar img')?.src==='https://example.com/luis-new.jpg');
  state.tools.likes.config={...defaultLikes,enabled:false};publish(state);await until(()=>!window.document.querySelector('.likes-board'));
  state.tools.likes.config=defaultLikes;publish(state);await until(()=>window.document.querySelector('.likes-board'));disconnect();await until(()=>!window.document.querySelector('.likes-board'));
});
test('Top gifters output switches metrics, renders gifts and hides when disconnected',async t=>{
  const {window,publish,disconnect}=await mount(t,'/?gifters-output=1');
  const ranking=[{id:'1',name:'Ana',gifts:2,diamonds:50,avatar:'https://example.com/ana.jpg'},{id:'2',name:'Luis',gifts:9,diamonds:20}];
  const state={tools:{gifters:{config:{...defaultGifters,metric:'diamonds'},ranking,total:50,totalGifts:11,totalDiamonds:70}}};
  publish(state);await until(()=>window.document.querySelector('.gifters-board'));
  assert.deepEqual([...window.document.querySelectorAll('.gifters-name')].map(name=>name.textContent),['Ana','Luis']);
  assert.equal(window.document.querySelector('.gifters-avatar img').src,'https://example.com/ana.jpg');
  assert.equal(window.document.querySelector('.gifters-gift').textContent,'◆');
  assert.match(window.document.querySelector('.gifters-board footer').textContent,/50 diamantes/);
  assert.equal(window.document.documentElement.classList.contains('gifters-output'),true);
  state.tools.gifters.config={...defaultGifters,metric:'gifts'};state.tools.gifters.total=11;
  state.tools.gifters.ranking=[{id:'2',name:'Luis',gifts:9,diamonds:20},{id:'1',name:'Ana',gifts:2,diamonds:50,avatar:'https://example.com/ana.jpg'}];
  publish(state);await until(()=>window.document.querySelector('.gifters-gift').textContent==='🎁');
  assert.deepEqual([...window.document.querySelectorAll('.gifters-name')].map(name=>name.textContent),['Luis','Ana']);
  assert.match(window.document.querySelector('.gifters-board footer').textContent,/11 regalos/);
  disconnect();await until(()=>!window.document.querySelector('.gifters-board'));
});
test('Top gifters route exposes the design editor and autosaves the chosen metric',async t=>{
  const {window,publish,requests}=await mount(t,'/gifters');
  const state={token:'test',settings:defaults,tts:{resources:{},queued:0},events:[],tools:{layout:{},ads:{},gifters:{config:structuredClone(defaultGifters),ranking:[],total:0,totalGifts:0,totalDiamonds:0,participants:0}}};
  publish(state);await until(()=>window.document.querySelector('.gifters-settings'));
  assert.equal(window.document.querySelector('.nav-item.active').textContent,'Top gifters');
  const label=Array.from(window.document.querySelectorAll('.gifters-settings label')).find(el=>el.textContent==='Métrica');assert.ok(label);
  const select=window.document.getElementById(label.htmlFor);select.value='diamonds';select.dispatchEvent(new window.Event('change',{bubbles:true}));
  await until(()=>requests.some(r=>r.url==='/api/gifters/save'));
  assert.equal(requests.find(r=>r.url==='/api/gifters/save').body.metric,'diamonds');
});
test('Auction output shows the leading bid, countdown and winner, then hides when disabled or disconnected',async t=>{
  const {window,publish,disconnect}=await mount(t,'/?auction-output=1');
  const leader={id:'1',name:'Ana',diamonds:2500,gifts:6};
  const state={tools:{auction:{config:{...defaultAuction,style:'spotlight'},status:'live',round:2,itemTitle:'Guitarra',endsAt:Date.now()+60000,ranking:[leader,{id:'2',name:'Luis',diamonds:900,gifts:3}],leader,total:3400,participants:2,winner:null}}};
  publish(state);await until(()=>window.document.querySelector('.auction-board'));
  const board=window.document.querySelector('.auction-board');
  assert.equal(window.document.querySelector('.auction-title').textContent,defaultAuction.title);
  assert.match(board.textContent,/Guitarra/);assert.match(board.textContent,/Ronda 2/);
  assert.equal(board.querySelector('.auction-winner').textContent,'Ana');
  assert.match(board.querySelector('.auction-clock').textContent,/\d+:\d{2}/);
  assert.equal(board.querySelector('.auction-status').textContent,'En vivo');
  assert.equal(window.document.documentElement.classList.contains('auction-output'),true);
  assert.deepEqual([...board.querySelectorAll('.auction-name')].map(name=>name.textContent),['Ana','Luis']);
  state.tools.auction.status='ended';state.tools.auction.winner=leader;state.tools.auction.endsAt=0;
  publish(state);await until(()=>window.document.querySelector('.auction-status')?.textContent==='Cerrada');
  assert.match(window.document.querySelector('.auction-sold').textContent,/Gana Ana/);
  state.tools.auction.config={...defaultAuction,enabled:false};publish(state);await until(()=>!window.document.querySelector('.auction-board'));
  state.tools.auction.config=defaultAuction;publish(state);await until(()=>window.document.querySelector('.auction-board'));
  disconnect();await until(()=>!window.document.querySelector('.auction-board'));
});

test('Auction route exposes the design editor, autosaves the lot title and starts a round',async t=>{
  const {window,publish,requests}=await mount(t,'/auction');
  const state={token:'test',settings:defaults,tts:{resources:{},queued:0},events:[],tools:{layout:{},ads:{},auction:{config:structuredClone(defaultAuction),revision:1,status:'idle',round:0,itemTitle:'',ranking:[],total:0,totalGifts:0,participants:0,winner:null}}};
  publish(state);await until(()=>window.document.querySelector('.auction-settings'));
  assert.equal(window.document.querySelector('.nav-item.active').textContent,'Subasta');
  const label=Array.from(window.document.querySelectorAll('.auction-settings label')).find(el=>el.textContent==='Título del lote');assert.ok(label);
  const input=window.document.getElementById(label.htmlFor);
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(input,'Guitarra');
  input.dispatchEvent(new window.Event('input',{bubbles:true}));
  await until(()=>requests.some(r=>r.url==='/api/auction/save'));
  assert.equal(requests.find(r=>r.url==='/api/auction/save').body.itemTitle,'Guitarra');
  const start=Array.from(window.document.querySelectorAll('button')).find(b=>b.textContent==='Iniciar subasta');assert.ok(start);
  start.click();await until(()=>requests.some(r=>r.url==='/api/auction/start'));
});

test('Super Fan editor restores older pending settings and sends a customized preview', async t => {
  const {window,requests,publish}=await mount(t,'/notifications');
  const legacy=structuredClone(defaultNotifications);delete legacy.events.superfan;
  legacy.events.follow.title='Mi saludo pendiente';
  window.localStorage.setItem('live-studio.notifications.pending.v1',JSON.stringify({config:legacy}));
  publish({token:'test',settings:defaults,tts:{resources:{},queued:0},events:[],tools:{layout:{},ads:{},notifications:{config:structuredClone(defaultNotifications),queued:0,current:null}}});
  await until(()=>window.document.querySelector('.notifications-settings'));
  assert.equal(window.document.querySelector('.notification-banner strong').textContent,'Mi saludo pendiente');
  const button=Array.from(window.document.querySelectorAll('button')).find(b=>b.textContent==='Super Fan');
  assert.ok(button);button.click();await pause();
  assert.equal(window.document.querySelector('.notification-banner strong').textContent,'¡Nuevo Super Fan!');
  const title=window.document.querySelector('.notifications-settings input:not([type])');
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(title,'Bienvenido {usuario}');
  title.dispatchEvent(new window.Event('input',{bubbles:true}));await pause();
  Array.from(window.document.querySelectorAll('button')).find(b=>b.textContent==='Enviar prueba al directo').click();
  await until(()=>requests.some(r=>r.url==='/api/notifications/test'));
  const preview=requests.find(r=>r.url==='/api/notifications/test').body;
  assert.equal(preview.type,'superfan');assert.equal(preview.config.events.superfan.title,'Bienvenido {usuario}');
  await until(()=>requests.some(r=>r.url==='/api/notifications/save'));
  assert.equal(requests.find(r=>r.url==='/api/notifications/save').body.events.follow.title,'Mi saludo pendiente');
});
async function until(check,attempts=80) { for(let i=0;i<attempts;i++){if(check())return;await pause();}assert.ok(check()); }
async function mount(t, route) {
  const dom = new JSDOM('<div id="root"></div>', {url:'http://127.0.0.1:17900'+route,runScripts:'outside-only',pretendToBeVisual:true});
  t.after(()=>dom.window.close()); const {window}=dom; let stream; const requests=[];
  window.structuredClone=structuredClone;
  window.HTMLMediaElement.prototype.play=function(){this.playCalls=(this.playCalls||0)+1;return Promise.resolve();};
  window.HTMLMediaElement.prototype.pause=function(){this.pauseCalls=(this.pauseCalls||0)+1;};
  window.HTMLMediaElement.prototype.load=function(){};
  window.EventSource=class { constructor(){stream=this;} close(){} };
  window.ResizeObserver=class {observe(){}unobserve(){}disconnect(){}};
  window.fetch=async (url,options)=>{const body=JSON.parse(options.body);requests.push({url,body});const kind=body.kind||'image';return {ok:true,json:async()=>({ok:true,...(url==='/api/notifications/upload'?{[kind]:'/notification-assets/'+'a'.repeat(64)+'.'+({image:'gif',video:'mp4',audio:'mp3'})[kind]}:{})})};};
  const html=fs.readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
  window.eval(fs.readFileSync(new URL('../dist'+html.match(/src="([^"]+\.js)"/)[1],import.meta.url),'utf8'));
  await until(()=>stream);
  return {window,requests,publish:state=>stream.onmessage({data:JSON.stringify(state)}),disconnect:()=>stream.onerror()};
}
test('notification editor preserves drafts, saves configuration and sends explicit previews',async t=>{
  const {window,requests,publish}=await mount(t,'/notifications');
  const state={token:'test',settings:defaults,tts:{resources:{},queued:0},events:[],tools:{layout:{},ads:{},notifications:{config:structuredClone(defaultNotifications),queued:0,current:null}}};
  publish(state);await until(()=>window.document.querySelector('.notifications-settings'));
  assert.equal(window.document.querySelector('.nav-item.active').textContent,'Notificaciones');
  const title=window.document.querySelector('.notifications-settings input:not([type])');
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(title,'Hola {usuario}');
  title.dispatchEvent(new window.Event('input',{bubbles:true}));await pause();
  publish(state);await pause();assert.equal(title.value,'Hola {usuario}');
  assert.equal(window.document.querySelector('.notification-banner strong').textContent,'Hola María');
  const click=async text=>{const button=Array.from(window.document.querySelectorAll('button')).find(b=>b.textContent===text);assert.ok(button);button.click();await pause();};
  assert.equal(window.document.querySelectorAll('.notification-attachments input[type=file]').length,3);
  assert.equal(window.document.querySelector('.notification-attachments input:not([type=file])'),null);
  assert.equal(window.document.querySelector('.notification-attachments input[type=file]').closest('details'),null);
  window.Image=class {set src(value){queueMicrotask(()=>this.onload());}};
  const fileInput=window.document.querySelector('.notifications-settings input[type=file]');
  Object.defineProperty(fileInput,'files',{value:[new window.File(['GIF89a'],'alert.gif',{type:'image/gif'})]});
  fileInput.dispatchEvent(new window.Event('change',{bubbles:true}));
  await until(()=>window.document.querySelector('.notification-banner img'));
  assert.match(requests.find(r=>r.url==='/api/notifications/upload').body.data,/^data:image\/gif;base64,/);
  const designTab = [...window.document.querySelectorAll('[role="tab"]')].find(tab => tab.textContent === 'Diseño');
  designTab.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
  await until(() => designTab.getAttribute('aria-selected') === 'true');
  assert.equal(window.document.querySelector('[data-panel="content"]').hidden,true);
  const custom=Array.from(window.document.querySelectorAll('.notifications-settings label')).find(label=>label.textContent==='Diseño propio para esta alerta');
  window.document.getElementById(custom.htmlFor).click();await pause();
  const layoutLabel=Array.from(window.document.querySelectorAll('.notifications-settings label')).find(label=>label.textContent==='Distribución');
  const layout=window.document.getElementById(layoutLabel.htmlFor);layout.value='top';layout.dispatchEvent(new window.Event('change',{bubbles:true}));await pause();
  assert.ok(window.document.querySelector('.notification-banner.layout-top'));
  await click('Regalo');assert.equal(window.document.querySelector('.notification-banner img'),null);
  assert.ok(window.document.querySelector('.notification-banner.layout-left'));
  await click('Nuevo seguidor');assert.ok(window.document.querySelector('.notification-banner.layout-top img'));
  await click('Enviar prueba al directo');
  const preview=requests.find(r=>r.url==='/api/notifications/test');
  assert.equal(preview.body.type,'follow');assert.equal(preview.body.config.events.follow.title,'Hola {usuario}');
  assert.match(preview.body.config.events.follow.image,/\.gif$/);
  assert.equal(preview.body.config.events.follow.appearance.layout,'top');
  assert.equal(requests.some(r=>r.url==='/api/notifications/save'),false);
  assert.ok(![...window.document.querySelectorAll('button')].some(button=>button.textContent==='Guardar notificaciones'));
  await until(()=>requests.some(r=>r.url==='/api/notifications/save'));
  assert.equal(title.value,'Hola {usuario}','Saving must not revert the draft before SSE acknowledges it');
  const saved=requests.find(r=>r.url==='/api/notifications/save').body;
  state.tools.notifications.config=saved;publish(state);
  await until(()=>window.document.querySelector('.notifications-settings .save-bar span').textContent==='Configuración guardada');
  assert.equal(window.document.querySelector('.notifications-settings .save-bar span').textContent,'Configuración guardada');
  assert.equal(window.document.querySelector('.notifications-toolbar a').href,'http://127.0.0.1:17900/?notifications-output=1#tiktok.studio');
});
test('notification output is empty when idle, renders escaped events and clears expired or disconnected alerts',async t=>{
  const {window,publish,disconnect}=await mount(t,'/?notifications-output=1');
  const state={tools:{notifications:{current:null}}};publish(state);await pause();
  assert.ok(window.document.documentElement.classList.contains('notifications-output'));
  assert.equal(window.document.documentElement.style.colorScheme,'normal','Embedded output must not inherit the dashboard dark color scheme');
  assert.equal(window.document.querySelector('.notification-banner'),null);
  state.tools.notifications.current={id:'one',type:'gift',title:'<img src=x onerror=alert(1)>',message:'Gracias',style:{...defaultNotifications,textShadow:true},expiresAt:Date.now()+200};
  publish(state);await until(()=>window.document.querySelector('.notification-banner'));
  const banner=window.document.querySelector('.notification-banner');assert.equal(banner.querySelector('img'),null);
  assert.ok(banner.querySelector('.notification-copy').style.textShadow);
  publish(state);await pause();assert.equal(window.document.querySelector('.notification-banner'),banner,'SSE must not replay animation');
  await until(()=>!window.document.querySelector('.notification-banner'));
  state.tools.notifications.current={...state.tools.notifications.current,id:'two',expiresAt:Date.now()+6000};publish(state);
  await until(()=>window.document.querySelector('.notification-banner'));disconnect();
  await until(()=>!window.document.querySelector('.notification-banner'));
});

test('video trimmer constrains the selected clip to the alert duration and saves audio volume',async t=>{
  const {window,requests,publish}=await mount(t,'/notifications');
  const config=structuredClone(defaultNotifications);
  Object.assign(config.events.follow,{video:'/notification-assets/'+'b'.repeat(64)+'.mp4',videoDuration:60,videoStart:0,videoEnd:6,audio:'/notification-assets/'+'c'.repeat(64)+'.mp3',volume:35});
  publish({token:'test',settings:defaults,tts:{resources:{},queued:0},events:[],tools:{layout:{},ads:{},notifications:{config,queued:0,current:null}}});
  await until(()=>window.document.querySelector('.alert-video-trimmer'));
  const inputFor=label=>{const node=Array.from(window.document.querySelectorAll('label')).find(l=>l.textContent===label);assert.ok(node,label);return window.document.getElementById(node.htmlFor);};
  const set=async(label,value)=>{const input=inputFor(label);Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(input,String(value));input.dispatchEvent(new window.Event('input',{bubbles:true}));await pause();};
  await set('Inicio · segundos',12);assert.equal(inputFor('Fin · segundos').value,'18');
  await set('Fin · segundos',50);assert.equal(inputFor('Fin · segundos').value,'18');
  await set('Duración · segundos',4);await until(()=>inputFor('Fin · segundos').value==='16');
  assert.equal(inputFor('Volumen: 35%').value,'35');
  await until(()=>requests.some(r=>r.url==='/api/notifications/save'));
  const saved=requests.find(r=>r.url==='/api/notifications/save');assert.ok(saved);
  assert.equal(saved.body.events.follow.videoStart,12);assert.equal(saved.body.events.follow.videoEnd,16);assert.equal(saved.body.events.follow.volume,35);
});

test('audio trimmer saves the selected fragment and respects the alert duration',async t=>{
  const {window,requests,publish}=await mount(t,'/notifications');
  const config=structuredClone(defaultNotifications);
  Object.assign(config.events.follow,{audio:'/notification-assets/'+'c'.repeat(64)+'.mp3',audioName:'voz.mp3',audioDuration:12,audioStart:0,audioEnd:6,volume:55});
  publish({token:'test',settings:defaults,tts:{resources:{},queued:0},events:[],tools:{layout:{},ads:{},notifications:{config,queued:0,current:null}}});
  await until(()=>window.document.querySelector('.alert-audio-trimmer'));
  const inputFor=label=>{const node=Array.from(window.document.querySelectorAll('label')).find(l=>l.textContent===label);assert.ok(node,label);return window.document.getElementById(node.htmlFor);};
  const sliderFor=label=>{const node=window.document.querySelector(`[role="slider"][aria-label="${label}"]`);assert.ok(node,label);return node;};
  const set=async(label,value)=>{const input=inputFor(label);Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(input,String(value));input.dispatchEvent(new window.Event('input',{bubbles:true}));await pause();};
  await set('Inicio del audio · segundos',2);
  assert.equal(inputFor('Fin del audio · segundos').value,'8');
  assert.equal(sliderFor('Inicio del audio').getAttribute('aria-valuenow'),'2');
  assert.equal(sliderFor('Fin del audio').getAttribute('aria-valuenow'),'8');
  await set('Fin del audio · segundos',20);
  assert.equal(inputFor('Fin del audio · segundos').value,'8');
  assert.equal(sliderFor('Fin del audio').getAttribute('aria-valuenow'),'8');
  await set('Fin del audio · segundos',7);
  assert.equal(sliderFor('Fin del audio').getAttribute('aria-valuenow'),'7');
  await until(()=>requests.some(r=>r.url==='/api/notifications/save'&&r.body.events.follow.audioStart===2&&r.body.events.follow.audioEnd===7));
  const saved=requests.find(r=>r.url==='/api/notifications/save'&&r.body.events.follow.audioStart===2&&r.body.events.follow.audioEnd===7).body.events.follow;
  assert.equal(saved.audioStart,2);assert.equal(saved.audioEnd,7);assert.equal(saved.audioDuration,12);assert.equal(saved.volume,55);
});

test('output starts media at the trim point, never replays on SSE and stops on clear',async t=>{
  const {window,publish}=await mount(t,'/?notifications-output=1');
  const current={id:'media',type:'follow',title:'Hola',message:'Gracias',style:defaultNotifications,video:'/notification-assets/'+'b'.repeat(64)+'.mp4',videoStart:10,videoEnd:16,videoMuted:true,audio:'/notification-assets/'+'c'.repeat(64)+'.mp3',audioStart:3,audioEnd:5,audioDuration:10,volume:25,expiresAt:Date.now()+6000};
  const state={tools:{notifications:{current}}};publish(state);
  await until(()=>window.document.querySelector('video'));
  const video=window.document.querySelector('video'),audio=window.document.querySelector('audio');
  video.dispatchEvent(new window.Event('loadedmetadata'));audio.dispatchEvent(new window.Event('loadedmetadata'));await pause();
  assert.ok(video.currentTime>=10&&video.currentTime<11);assert.equal(audio.volume,.25);
  assert.ok(audio.currentTime>=3&&audio.currentTime<4);
  assert.equal(video.playCalls,1);assert.equal(audio.playCalls,1);
  publish(state);await pause();assert.equal(video.playCalls,1);assert.equal(audio.playCalls,1);
  video.currentTime=16;video.dispatchEvent(new window.Event('timeupdate'));assert.ok(video.pauseCalls>=1);
  audio.currentTime=5;audio.dispatchEvent(new window.Event('timeupdate'));assert.ok(audio.pauseCalls>=1);
  publish({tools:{notifications:{current:null}}});await pause();assert.ok(audio.pauseCalls>=1);assert.equal(window.document.querySelector('video'),null);
});

test('video and audio picker uploads attach to their event and initialize a bounded trim',async t=>{
  const {window,requests,publish}=await mount(t,'/notifications');
  const create=window.document.createElement.bind(window.document);
  window.document.createElement=(tag,...args)=>{const node=create(tag,...args);if(tag==='video'){
    Object.defineProperty(node,'duration',{get:()=>43.75});
    Object.defineProperty(node,'src',{set(value){node.setAttribute('src',value);queueMicrotask(()=>node.onloadedmetadata?.());},get(){return node.getAttribute('src');}});
  }return node;};
  publish({token:'test',settings:defaults,tts:{resources:{},queued:0},events:[],tools:{layout:{},ads:{},notifications:{config:structuredClone(defaultNotifications),queued:0,current:null}}});
  await until(()=>window.document.querySelector('.notifications-settings'));
  const upload=async(kind,name,mime)=>{const input=window.document.querySelector(`input[type=file][accept*="${kind}"]`);Object.defineProperty(input,'files',{value:[new window.File(['test'],name,{type:mime})]});input.dispatchEvent(new window.Event('change',{bubbles:true}));};
  await upload('video','intro.mp4','video/mp4');await until(()=>window.document.querySelector('.alert-video-trimmer'));
  assert.match(window.document.querySelector('.alert-video-trimmer').textContent,/43.8 s/);
  await upload('audio','sound.mp3','audio/mpeg');await until(()=>window.document.querySelector('.notifications-settings input[type=range][max="100"]'));

  await until(()=>requests.some(r=>r.url==='/api/notifications/save'));
  const event=requests.find(r=>r.url==='/api/notifications/save').body.events.follow;
  assert.equal(event.videoStart,0);assert.equal(event.videoEnd,6);assert.equal(event.videoDuration,43.75);
  assert.equal(event.videoName,'intro.mp4');assert.equal(event.audioName,'sound.mp3');
  assert.match(event.audio,/\.mp3$/);
});

test('notification output ignores external media from a stale event',async t=>{
  const {window,publish}=await mount(t,'/?notifications-output=1');
  publish({tools:{notifications:{current:{id:'legacy',type:'follow',title:'Hola',message:'Gracias',style:defaultNotifications,
    video:'https://example.com/video.mp4',image:'https://example.com/image.gif',audio:'https://example.com/audio.mp3',expiresAt:Date.now()+6000}}}});
  await until(()=>window.document.querySelector('.notification-banner'));
  assert.equal(window.document.querySelector('.output-stage img, .output-stage video, .output-stage audio, .output-stage iframe'),null);
});

test('local GIF without MIME above 5 MB replaces a previous video and reports bad files inline',async t=>{
  const {window,requests,publish}=await mount(t,'/notifications');
  const config=structuredClone(defaultNotifications);config.events.follow.video='/notification-assets/'+'b'.repeat(64)+'.mp4';
  window.Image=class{set src(value){assert.match(value,/^data:image\/gif;base64,/);queueMicrotask(()=>this.onload?.());}};
  publish({token:'test',settings:defaults,tts:{resources:{},queued:0},events:[],tools:{layout:{},ads:{},notifications:{config,queued:0,current:null}}});
  await until(()=>window.document.querySelector('.notification-banner video'));
  const input=window.document.querySelector('input[type=file][accept*=gif]');
  Object.defineProperty(input,'files',{configurable:true,value:[new window.File(['GIF89a',new Uint8Array(6*1024*1024)],'animation.GIF',{type:''})]});
  input.dispatchEvent(new window.Event('change',{bubbles:true}));
  await until(()=>window.document.querySelector('.notification-banner img'));
  assert.equal(window.document.querySelector('.notification-banner video'),null);
  const uploaded=requests.find(r=>r.url==='/api/notifications/upload');assert.match(uploaded.body.data,/^data:image\/gif;base64,/);
  const before=requests.length;
  Object.defineProperty(input,'files',{configurable:true,value:[new window.File(['not an image'],'bad.gif',{type:'image/gif'})]});
  input.dispatchEvent(new window.Event('change',{bubbles:true}));
  await until(()=>window.document.querySelector('.alert-media-picker .error'));
  assert.match(window.document.querySelector('.alert-media-picker .error').textContent,/contenido/);
  assert.equal(requests.length,before);
  assert.ok(window.document.querySelector('.notification-banner img'));
});

test('pending notification edits survive a page reload and retry saving to disk',async t=>{
  const state={token:'test',settings:defaults,tts:{resources:{},queued:0},events:[],tools:{layout:{},ads:{},notifications:{config:structuredClone(defaultNotifications),revision:100,queued:0,current:null}}};
  const first=await mount(t,'/notifications');first.publish(state);await until(()=>first.window.document.querySelector('.notifications-settings'));
  const input=first.window.document.querySelector('.notifications-settings input:not([type])');
  Object.getOwnPropertyDescriptor(first.window.HTMLInputElement.prototype,'value').set.call(input,'Recuperado tras recargar');input.dispatchEvent(new first.window.Event('input',{bubbles:true}));await pause();
  const backup=first.window.localStorage.getItem('live-studio.notifications.pending.v1');assert.ok(backup);first.window.close();
  const second=await mount(t,'/notifications');second.window.localStorage.setItem('live-studio.notifications.pending.v1',backup);
  let attempts=0;
  second.window.fetch=async()=>{attempts++;return {ok:false,json:async()=>({error:'Disco ocupado'})};};
  second.publish(state);await until(()=>second.window.document.querySelector('.notifications-settings'));
  const restored=second.window.document.querySelector('.notifications-settings input:not([type])');assert.equal(restored.value,'Recuperado tras recargar');
  await until(()=>attempts>0);assert.ok(second.window.localStorage.getItem('live-studio.notifications.pending.v1'));
  second.publish(state);await pause();assert.equal(restored.value,'Recuperado tras recargar');
  let saved;
  second.window.fetch=async(url,options)=>{saved=JSON.parse(options.body);return {ok:true,json:async()=>({ok:true,notificationRevision:200})};};
  await until(()=>saved,200);
  await until(()=>!second.window.localStorage.getItem('live-studio.notifications.pending.v1'));
  second.publish(state);await pause();assert.equal(restored.value,'Recuperado tras recargar');
  const third=await mount(t,'/notifications');third.publish({...state,tools:{...state.tools,notifications:{...state.tools.notifications,config:saved,revision:200}}});await until(()=>third.window.document.querySelector('.notifications-settings'));
  assert.equal(third.window.document.querySelector('.notifications-settings input:not([type])').value,'Recuperado tras recargar');
});

test('text shadow, transparent border, animations and installed fonts are retained by autosave',async t=>{
  const {window,requests,publish}=await mount(t,'/notifications');const fontId='a'.repeat(24);
  publish({token:'test',settings:defaults,tts:{resources:{},queued:0},events:[],tools:{layout:{},ads:{},notifications:{config:structuredClone(defaultNotifications),fonts:{items:[{id:fontId,name:'Montserrat'}]},revision:1,queued:0,current:null}}});
  await until(()=>window.document.querySelector('.notifications-settings'));
  const field=label=>{const node=Array.from(window.document.querySelectorAll('label')).find(l=>l.textContent===label);assert.ok(node,label);return window.document.getElementById(node.htmlFor);};
  const copy=window.document.querySelector('.notification-copy');
  assert.equal(copy.style.textShadow,'');
  field('Sombra del texto').click();await pause();
  assert.ok(copy.style.textShadow);
  field('Borde transparente').click();await pause();
  for(const [label,value] of [['Animación de entrada','bounce'],['Tipografía','google:'+fontId]]){const select=field(label);select.value=value;select.dispatchEvent(new window.Event('change',{bubbles:true}));await pause();}
  assert.equal(window.document.querySelector('.notification-banner').style.borderColor,'rgba(185, 246, 120, 0)');
  assert.ok(window.document.querySelector('.notification-banner.animate-bounce'));
  assert.ok(window.document.head.querySelector('link[href="/notification-fonts/'+fontId+'.css"]'));
  await until(()=>requests.some(r=>r.url==='/api/notifications/save'));
  const saved=requests.filter(r=>r.url==='/api/notifications/save').at(-1).body;assert.equal(saved.borderOpacity,0);assert.equal(saved.fontFamily,'google:'+fontId);assert.equal(saved.animation,'bounce');
  assert.equal(saved.textShadow,true);
  field('Sombra del texto').click();await pause();
  assert.equal(copy.style.textShadow,'');
});

test('notification autosave serializes saves and preserves edits made during a pending request',async t=>{
  const {window,publish}=await mount(t,'/notifications');
  const state={token:'test',settings:defaults,tts:{resources:{},queued:0},events:[],tools:{layout:{},ads:{},notifications:{config:structuredClone(defaultNotifications),revision:1,queued:0,current:null}}};
  const pending=[];
  window.fetch=(url,options)=>new Promise(resolve=>pending.push({url,body:JSON.parse(options.body),resolve}));
  publish(state);await until(()=>window.document.querySelector('.notifications-settings'));
  const title=window.document.querySelector('.notifications-settings input:not([type])');
  const edit=value=>{Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(title,value);title.dispatchEvent(new window.Event('input',{bubbles:true}));};
  edit('Primera edición');await until(()=>pending.length===1);
  edit('Última edición');await pause();assert.equal(pending.length,1);
  pending[0].resolve({ok:true,json:async()=>({ok:true,notificationRevision:2})});
  publish({...state,tools:{...state.tools,notifications:{...state.tools.notifications,config:pending[0].body,revision:2}}});
  await until(()=>pending.length===2);assert.equal(title.value,'Última edición');assert.equal(pending[1].body.events.follow.title,'Última edición');
  pending[1].resolve({ok:true,json:async()=>({ok:true,notificationRevision:3})});
  await until(()=>!window.localStorage.getItem('live-studio.notifications.pending.v1'));
  publish(state);await pause();assert.equal(title.value,'Última edición');
});

test('installing a Google font selects its local family and autosaves it',async t=>{
  const {window,publish}=await mount(t,'/notifications');const requests=[],id='b'.repeat(24);
  window.fetch=async(url,options)=>{requests.push({url,body:JSON.parse(options.body)});return {ok:true,json:async()=>url==='/api/notifications/fonts/install'?{ok:true,id,name:'Montserrat'}:{ok:true,notificationRevision:2}};};
  publish({token:'test',settings:defaults,tts:{resources:{},queued:0},events:[],tools:{layout:{},ads:{},notifications:{config:structuredClone(defaultNotifications),revision:1,fonts:{items:[]},queued:0,current:null}}});
  await until(()=>window.document.querySelector('.notification-font-installer input'));
  const input=window.document.querySelector('.notification-font-installer input');Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(input,'Montserrat');input.dispatchEvent(new window.Event('input',{bubbles:true}));await pause();
  window.document.querySelector('.notification-font-installer button').click();
  await until(()=>requests.some(r=>r.url==='/api/notifications/save'));
  assert.equal(requests.find(r=>r.url==='/api/notifications/fonts/install').body.name,'Montserrat');
  assert.equal(requests.find(r=>r.url==='/api/notifications/save').body.fontFamily,'google:'+id);
  assert.ok(window.document.head.querySelector('link[href="/notification-fonts/'+id+'.css"]'));
});
