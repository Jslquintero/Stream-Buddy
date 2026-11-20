import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import { defaults } from '../backend/settings.js';
import { defaultNotifications } from '../modules/notifications/config.js';
import { defaultLikes } from '../modules/likes/config.js';
import { defaultCommands } from '../modules/commands/config.js';
const pause = () => new Promise(resolve => setTimeout(resolve,30));
test('command dashboard preserves the chosen view and saves public descriptions', async t => {
  const {window,publish,requests}=await mount(t,'/commands');
  window.localStorage.setItem('studio.commands.view','list');
  publish({token:'test',settings:defaults,tts:{resources:{}},events:[],tools:{layout:{},ads:{},commands:{config:structuredClone(defaultCommands)}}});
  await until(()=>window.document.querySelector('.commands-view-list'));
  const label=Array.from(window.document.querySelectorAll('label')).find(el=>el.textContent==='Descripción corta');
  const input=window.document.getElementById(label.htmlFor);
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(input,'Invoca a Aatrox'); input.dispatchEvent(new window.Event('input',{bubbles:true}));await pause();
  Array.from(window.document.querySelectorAll('button')).find(el=>el.textContent==='Cuadrícula').click();await until(()=>window.document.querySelector('.commands-view-grid'));
  assert.equal(window.localStorage.getItem('studio.commands.view'),'grid');assert.equal(input.value,'Invoca a Aatrox');
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
test('command help renders descriptions safely and paginates large lists', async t => {
  const {window,publish}=await mount(t,'/commands?commands-list-output');
  const help=Array.from({length:7},(_,i)=>({command:'!c'+i,description:i===0?'<img src=x>':'Descripción '+i}));
  const visual={id:'help',help,startedAt:Date.now(),expiresAt:Date.now()+30000};
  publish({tools:{commands:{list:visual,visual:{id:'image',image:'https://example.com/a.gif',expiresAt:Date.now()+30000},audio:{id:'sound',src:'https://example.com/a.mp3',expiresAt:Date.now()+30000}}}});await until(()=>window.document.querySelector('.commands-help'));
  assert.equal(window.document.querySelectorAll('.commands-help dt').length,6);assert.equal(window.document.querySelector('.commands-help img'),null);
  visual.startedAt=Date.now()-9000;publish({tools:{commands:{list:visual,visual:{id:'image',image:'https://example.com/a.gif',expiresAt:Date.now()+30000},audio:{id:'sound',src:'https://example.com/a.mp3',expiresAt:Date.now()+30000}}}});await until(()=>window.document.querySelector('.commands-help dt')?.textContent==='!c6');
  assert.equal(window.document.querySelectorAll('.commands-help dt').length,1);
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
async function until(check) { for(let i=0;i<80;i++){if(check())return;await pause();}assert.ok(check()); }
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
  window.Image=class {set src(value){queueMicrotask(()=>this.onload());}};
  const fileInput=window.document.querySelector('.notifications-settings input[type=file]');
  Object.defineProperty(fileInput,'files',{value:[new window.File(['GIF89a'],'alert.gif',{type:'image/gif'})]});
  fileInput.dispatchEvent(new window.Event('change',{bubbles:true}));
  await until(()=>window.document.querySelector('.notification-banner img'));
  assert.match(requests.find(r=>r.url==='/api/notifications/upload').body.data,/^data:image\/gif;base64,/);
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
  await click('Guardar notificaciones');
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
  state.tools.notifications.current={id:'one',type:'gift',title:'<img src=x onerror=alert(1)>',message:'Gracias',style:defaultNotifications,expiresAt:Date.now()+200};
  publish(state);await until(()=>window.document.querySelector('.notification-banner'));
  const banner=window.document.querySelector('.notification-banner');assert.equal(banner.querySelector('img'),null);
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
  assert.equal(window.document.querySelector('.alert-media-picker audio').volume,.35);
  Array.from(window.document.querySelectorAll('button')).find(b=>b.textContent==='Guardar notificaciones').click();await pause();
  const saved=requests.find(r=>r.url==='/api/notifications/save');assert.ok(saved);
  assert.equal(saved.body.events.follow.videoStart,12);assert.equal(saved.body.events.follow.videoEnd,16);assert.equal(saved.body.events.follow.volume,35);
});

test('output starts media at the trim point, never replays on SSE and stops on clear',async t=>{
  const {window,publish}=await mount(t,'/?notifications-output=1');
  const current={id:'media',type:'follow',title:'Hola',message:'Gracias',style:defaultNotifications,video:'/notification-assets/'+'b'.repeat(64)+'.mp4',videoStart:10,videoEnd:16,videoMuted:true,audio:'/notification-assets/'+'c'.repeat(64)+'.mp3',volume:25,expiresAt:Date.now()+6000};
  const state={tools:{notifications:{current}}};publish(state);
  await until(()=>window.document.querySelector('video'));
  const video=window.document.querySelector('video'),audio=window.document.querySelector('audio');
  video.dispatchEvent(new window.Event('loadedmetadata'));audio.dispatchEvent(new window.Event('loadedmetadata'));await pause();
  assert.ok(video.currentTime>=10&&video.currentTime<11);assert.equal(audio.volume,.25);
  assert.equal(video.playCalls,1);assert.equal(audio.playCalls,1);
  publish(state);await pause();assert.equal(video.playCalls,1);assert.equal(audio.playCalls,1);
  video.currentTime=16;video.dispatchEvent(new window.Event('timeupdate'));assert.ok(video.pauseCalls>=1);
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
  await upload('audio','sound.mp3','audio/mpeg');await until(()=>window.document.querySelector('.alert-media-picker audio'));
  Array.from(window.document.querySelectorAll('button')).find(b=>b.textContent==='Guardar notificaciones').click();
  await until(()=>requests.some(r=>r.url==='/api/notifications/save'));
  const event=requests.find(r=>r.url==='/api/notifications/save').body.events.follow;
  assert.equal(event.videoStart,0);assert.equal(event.videoEnd,6);assert.equal(event.videoDuration,43.75);
  assert.equal(event.videoName,'intro.mp4');assert.equal(event.audioName,'sound.mp3');
  assert.match(event.audio,/\.mp3$/);
});

test('direct image and video links are previewed, saved and keep the previous media on failure',async t=>{
  const {window,requests,publish}=await mount(t,'/notifications');
  window.Image=class{set src(value){queueMicrotask(()=>value.includes('broken')?this.onerror?.():this.onload?.());}};
  const create=window.document.createElement.bind(window.document);
  window.document.createElement=(tag,...args)=>{const node=create(tag,...args);if(tag==='video'){
    Object.defineProperty(node,'duration',{get:()=>22.5});
    Object.defineProperty(node,'src',{set(value){node.setAttribute('src',value);queueMicrotask(()=>node.onloadedmetadata?.());},get(){return node.getAttribute('src');}});
  }return node;};
  publish({token:'test',settings:defaults,tts:{resources:{},queued:0},events:[],tools:{layout:{},ads:{},notifications:{config:structuredClone(defaultNotifications),queued:0,current:null}}});
  await until(()=>window.document.querySelector('.alert-media-url'));
  const enter=async(index,url)=>{const input=window.document.querySelectorAll('.alert-media-url input')[index];Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(input,url);input.dispatchEvent(new window.Event('input',{bubbles:true}));await pause();input.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));};
  await enter(0,'https://cdn.example.com/alert.gif?token=test');
  await until(()=>window.document.querySelector('.notification-banner img'));
  assert.equal(window.document.querySelector('.notification-banner img').src,'https://cdn.example.com/alert.gif?token=test');
  await enter(0,'https://cdn.example.com/broken.gif');await until(()=>window.document.querySelector('.alert-media-url .error'));
  assert.equal(window.document.querySelector('.notification-banner img').src,'https://cdn.example.com/alert.gif?token=test');
  await enter(1,'https://cdn.example.com/video.mp4');await until(()=>window.document.querySelector('.alert-video-trimmer'));
  Array.from(window.document.querySelectorAll('button')).find(b=>b.textContent==='Guardar notificaciones').click();
  await until(()=>requests.some(r=>r.url==='/api/notifications/save'));
  const event=requests.find(r=>r.url==='/api/notifications/save').body.events.follow;
  assert.equal(event.video,'https://cdn.example.com/video.mp4');assert.equal(event.videoEnd,6);assert.equal(event.videoDuration,22.5);
  assert.equal(event.image,'https://cdn.example.com/alert.gif?token=test');
  assert.equal(requests.some(r=>r.url==='/api/notifications/upload'),false);
});

test('YouTube page URLs use the site player and retain timestamp trimming',async t=>{
  const {window,requests,publish}=await mount(t,'/notifications');const players=[];
  window.YT={Player:class{
    constructor(target,options){this.options=options;this.time=0;const frame=window.document.createElement('iframe');frame.title='YouTube';target.replaceWith(frame);players.push(this);queueMicrotask(()=>options.events.onReady({target:this}));}
    setVolume(value){this.volume=value;}mute(){}unMute(){}getCurrentTime(){return this.time;}pauseVideo(){this.paused=true;}seekTo(value){this.time=value;}
    cueVideoById(value){this.clip=value;}loadVideoById(value){this.clip=value;}destroy(){this.destroyed=true;}
  }};
  publish({token:'test',settings:defaults,tts:{resources:{},queued:0},events:[],tools:{layout:{},ads:{},notifications:{config:structuredClone(defaultNotifications),queued:0,current:null}}});
  await until(()=>window.document.querySelectorAll('.alert-media-url input').length===2);
  const input=window.document.querySelectorAll('.alert-media-url input')[1];
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(input,'https://youtu.be/M7lc1UVf-VE?t=12');input.dispatchEvent(new window.Event('input',{bubbles:true}));await pause();
  input.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
  await until(()=>players.some(p=>p.clip));
  assert.equal(players.find(p=>p.clip).clip.startSeconds,12);assert.equal(players.find(p=>p.clip).clip.endSeconds,18);
  assert.ok(window.document.querySelector('.alert-website-player iframe'));
  assert.equal(window.document.querySelector('.alert-video-trimmer video'),null);
  Array.from(window.document.querySelectorAll('button')).find(b=>b.textContent==='Guardar notificaciones').click();await until(()=>requests.some(r=>r.url==='/api/notifications/save'));
  assert.equal(requests.find(r=>r.url==='/api/notifications/save').body.events.follow.videoStart,12);
  assert.equal(requests.some(r=>r.url==='/api/notifications/upload'),false);
  const player=players.find(p=>p.clip&&!p.destroyed);player.time=19;await until(()=>player.paused);
});

test('Vimeo output seeks to the segment, stops at its end and destroys on clear',async t=>{
  const {window,publish}=await mount(t,'/?notifications-output=1');let player;
  window.Vimeo={Player:class{
    constructor(target,options){player=this;this.options=options;this.events={};}on(name,handler){this.events[name]=handler;}ready(){return Promise.resolve();}
    setVolume(value){this.volume=value;return Promise.resolve();}setCurrentTime(value){this.time=value;return Promise.resolve();}play(){this.played=true;return Promise.resolve();}pause(){this.paused=true;return Promise.resolve();}destroy(){this.destroyed=true;return Promise.resolve();}
  }};
  const state={tools:{notifications:{current:{id:'vimeo',type:'follow',title:'Hola',message:'Gracias',style:defaultNotifications,video:'https://vimeo.com/123456789',videoStart:20,videoEnd:26,videoMuted:true,expiresAt:Date.now()+6000}}}};
  publish(state);await until(()=>player?.played);assert.ok(player.time>=20&&player.time<21);assert.equal(player.volume,0);
  assert.equal(player.options.controls,false);assert.equal(player.options.title,false);
  player.events.playing();await pause();assert.equal(window.document.querySelector('.alert-website-player').style.visibility,'');
  player.events.timeupdate({seconds:26});assert.equal(player.paused,true);
  await pause();assert.equal(window.document.querySelector('.alert-website-player').style.visibility,'hidden');
  publish({tools:{notifications:{current:null}}});await until(()=>player.destroyed);
});

test('YouTube alert output hides controls and loading or paused player screens',async t=>{
  const {window,publish}=await mount(t,'/?notifications-output=1');let player;
  window.YT={Player:class{
    constructor(target,options){player=this;this.options=options;this.time=12;target.replaceWith(window.document.createElement('iframe'));queueMicrotask(()=>options.events.onReady({target:this}));}
    setVolume(){}mute(){}unMute(){}loadVideoById(){}cueVideoById(){}getCurrentTime(){return this.time;}seekTo(){}pauseVideo(){}destroy(){}
  }};
  publish({tools:{notifications:{current:{id:'clean',type:'follow',title:'Hola',message:'Gracias',style:defaultNotifications,video:'https://youtube.com/watch?v=M7lc1UVf-VE',videoStart:12,videoEnd:18,videoMuted:true,expiresAt:Date.now()+6000}}}});
  await until(()=>player);assert.equal(player.options.playerVars.controls,0);assert.equal(player.options.playerVars.fs,0);
  assert.equal(window.document.querySelector('.alert-website-player').style.visibility,'hidden');
  player.options.events.onStateChange({data:1,target:player});await pause();assert.equal(window.document.querySelector('.alert-website-player').style.visibility,'');
  player.options.events.onStateChange({data:2,target:player});await pause();assert.equal(window.document.querySelector('.alert-website-player').style.visibility,'hidden');
  assert.equal(window.document.querySelector('button'),null);
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
  Array.from(second.window.document.querySelectorAll('button')).find(b=>b.textContent==='Guardar notificaciones').click();await until(()=>saved);
  await until(()=>!second.window.localStorage.getItem('live-studio.notifications.pending.v1'));
  second.publish(state);await pause();assert.equal(restored.value,'Recuperado tras recargar');
  const third=await mount(t,'/notifications');third.publish({...state,tools:{...state.tools,notifications:{...state.tools.notifications,config:saved,revision:200}}});await until(()=>third.window.document.querySelector('.notifications-settings'));
  assert.equal(third.window.document.querySelector('.notifications-settings input:not([type])').value,'Recuperado tras recargar');
});

test('transparent border, animations and installed fonts are retained by autosave',async t=>{
  const {window,requests,publish}=await mount(t,'/notifications');const fontId='a'.repeat(24);
  publish({token:'test',settings:defaults,tts:{resources:{},queued:0},events:[],tools:{layout:{},ads:{},notifications:{config:structuredClone(defaultNotifications),fonts:{items:[{id:fontId,name:'Montserrat'}]},revision:1,queued:0,current:null}}});
  await until(()=>window.document.querySelector('.notifications-settings'));
  const field=label=>{const node=Array.from(window.document.querySelectorAll('label')).find(l=>l.textContent===label);assert.ok(node,label);return window.document.getElementById(node.htmlFor);};
  field('Borde transparente').click();await pause();
  for(const [label,value] of [['Animación de entrada','bounce'],['Tipografía','google:'+fontId]]){const select=field(label);select.value=value;select.dispatchEvent(new window.Event('change',{bubbles:true}));await pause();}
  assert.equal(window.document.querySelector('.notification-banner').style.borderColor,'rgba(185, 246, 120, 0)');
  assert.ok(window.document.querySelector('.notification-banner.animate-bounce'));
  assert.ok(window.document.head.querySelector('link[href="/notification-fonts/'+fontId+'.css"]'));
  await until(()=>requests.some(r=>r.url==='/api/notifications/save'));
  const saved=requests.filter(r=>r.url==='/api/notifications/save').at(-1).body;assert.equal(saved.borderOpacity,0);assert.equal(saved.fontFamily,'google:'+fontId);assert.equal(saved.animation,'bounce');
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
