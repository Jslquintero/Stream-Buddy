import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import { defaults } from '../backend/settings.js';
const pause = () => new Promise(resolve => setTimeout(resolve, 30));
async function until(check) { for (let i=0;i<100;i++){if(check())return;await pause();}assert.ok(check(),'La interfaz no respondió a tiempo'); }
test('React dashboard preserves edits across SSE, previews draft settings and controls queue', async t => {
 const dom=new JSDOM('<div id="root"></div>',{url:'http://127.0.0.1:17900',runScripts:'outside-only',pretendToBeVisual:true});t.after(()=>dom.window.close());const {window}=dom;let stream;const requests=[];
 window.EventSource=class{constructor(url){assert.equal(url,'/api/events');stream=this;}close(){}};
 window.fetch=async(url,options)=>{requests.push({url,...options});return {ok:true,json:async()=>({ok:true})};};
 window.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};
 window.HTMLElement.prototype.scrollIntoView=function(){};
 const html=fs.readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');const asset=html.match(/src="([^"]+\.js)"/)[1];window.eval(fs.readFileSync(new URL('../dist'+asset,import.meta.url),'utf8'));
 await until(()=>stream);const state={token:'test-token',settings:{...defaults,Username:'usuario'},tools:{layout:{running:false,available:true},ads:{running:true,available:true}},tts:{queued:2,connected:false,connector:true,resources:{voices:[],devices:[],models:[],catalog:[]}},events:[]};
 stream.onmessage({data:JSON.stringify(state)});await until(()=>window.document.body.textContent.includes('@usuario'));
 const buttons=()=>Array.from(window.document.querySelectorAll('button'));const click=async text=>{const b=buttons().find(b=>b.textContent.trim()===text);assert.ok(b,'Botón '+text);b.click();await pause();};
 await click('Configurar voz');await until(()=>window.document.querySelector('input[type="number"]'));
 const input=window.document.querySelector('input[type="number"]');Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(input,'1.4');input.dispatchEvent(new window.Event('input',{bubbles:true}));await pause();
 state.tts.connected=true;stream.onmessage({data:JSON.stringify(state)});await pause();assert.equal(window.document.querySelector('input[type="number"]').value,'1.4');
 await click('Probar estos ajustes');const preview=requests.find(r=>r.url==='/api/tts/preview');assert.ok(preview);assert.equal(JSON.parse(preview.body).settings.Speed,1.4);assert.equal(preview.headers['X-Studio'],'test-token');assert.equal(state.settings.Speed,1);
 await click('Pausar');assert.ok(requests.some(r=>r.url==='/api/pause'));
 await click('Guardar cambios');assert.equal(JSON.parse(requests.find(r=>r.url==='/api/settings').body).Speed,1.4);
 stream.onerror();await until(()=>window.document.body.textContent.includes('Sin conexión con Live Studio'));
});
