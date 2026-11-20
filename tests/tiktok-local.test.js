import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { fields, decodeFrame, decodeEvent } from '../modules/tiktok/protocol.js';
import { isLivePage, isWebcastURL } from '../modules/tiktok/page.js';
import { LocalTikTokClient } from '../modules/tiktok/local-client.js';
import { commandHelpMessages } from '../modules/commands/chat-help.js';
import { validateSession } from '../modules/tiktok/session.js';
import { chatInputState } from '../modules/tiktok/page.js';
import { JSDOM } from 'jsdom';
const varint = value => { let n=BigInt(value); const out=[]; do { let byte=Number(n&127n); n>>=7n; if(n)byte|=128;out.push(byte); } while(n); return Buffer.from(out); };
const integer = (key,value) => Buffer.concat([varint(key*8),varint(value)]);
const bytes = (key,value) => { const b=Buffer.isBuffer(value)?value:Buffer.from(value);return Buffer.concat([varint(key*8+2),varint(b.length),b]); };
const join = (...values) => Buffer.concat(values);
const user = join(integer(1, '9007199254740999'),bytes(3,'Ana'),bytes(38,'ana'),bytes(9,bytes(1,'https://example.com/ana.png')));
const envelope = (method,data,id='9007199254740998',history=false) => join(bytes(1,method),bytes(2,data),integer(3,id),integer(6,history?1:0));
const frame = (...envelopes) => join(bytes(6,'pb'),bytes(7,'msg'),bytes(8,gzipSync(join(...envelopes.map(e=>bytes(1,e))))));
test('anonymous reading remains connected without session cookies and a room-enter rejection cannot disconnect active events', async () => {
  const events=[];const client=new LocalTikTokClient({username:'ana',emit:e=>events.push(e)});
  client.session='page';client.pageOK=true;client.socketIds.add('ws');
  await client.onEvent({sessionId:'page',method:'Network.webSocketHandshakeResponseReceived',params:{requestId:'ws',response:{status:101}}});
  client.evaluate=async expression=>expression==='location.href'?'https://www.tiktok.com/@ana/live':{available:false};
  client.call=async()=>({cookies:[]});await client.poll();
  assert.equal(client.connected,true);assert.equal(client.canSend,false);assert.match(events.at(-1).message,/Lectura conectada/);
  await client.onEvent({sessionId:'page',method:'Network.responseReceived',params:{response:{url:'https://webcast.tiktok.com/webcast/room/enter/',status:403}}});
  assert.equal(client.connected,true);
});
test('session import validates values and only applies them to the local TikTok browser', async () => {
  for(const value of [{},{sessionId:'bad',ttTargetIdc:'useast1a'},{sessionId:'a'.repeat(32),ttTargetIdc:'<script>'}])assert.throws(()=>validateSession(value));
  const events=[],calls=[];const client=new LocalTikTokClient({username:'ana',emit:e=>events.push(e)});
  client.call=async(method,params)=>{calls.push({method,params});return {};};
  await client.setSession({sessionId:'a'.repeat(32),ttTargetIdc:'useast1a'});
  assert.deepEqual(calls.map(c=>c.method),['Network.setCookies','Page.navigate']);
  assert.equal(calls[0].params.cookies.length,3);assert.ok(calls[0].params.cookies.every(cookie=>cookie.domain==='.tiktok.com'&&cookie.secure&&cookie.expires>Date.now()/1000));
  assert.equal(calls[1].params.url,'https://www.tiktok.com/@ana/live');
  assert.equal(JSON.stringify(events).includes('a'.repeat(32)),false);
});
test('current TikTok room input is recognized while disabled chat remains unavailable', () => {
  const dom=new JSDOM('<div data-e2e="room-chat-input-field" contenteditable="true"></div>',{runScripts:'outside-only'});
  try {
    const input=dom.window.document.querySelector('div');input.getClientRects=()=>[{}];
    const inspect=dom.window.eval('('+chatInputState.toString()+')');
    assert.equal(inspect(true).available,true);
    input.textContent='Mi borrador';assert.equal(inspect().draft,true);
    input.setAttribute('contenteditable','false');assert.equal(inspect().available,false);
  } finally { dom.window.close(); }
});
test('local Webcast reader decodes gzip, preserves IDs and ignores history and unknown messages', () => {
  const chat=join(bytes(2,user),bytes(3,'!Aatrox'));
  const events=decodeFrame(frame(envelope('WebcastChatMessage',chat),envelope('WebcastChatMessage',chat,'2',true),envelope('FutureMessage',chat,'3')));
  assert.equal(events.length,1);assert.equal(events[0].text,'!Aatrox');assert.equal(events[0].user,'ana');
  assert.equal(events[0].userId,'9007199254740999');assert.equal(events[0].messageId,'9007199254740998');
  assert.equal(events[0].avatar,'https://example.com/ana.png');
  assert.throws(()=>fields(Buffer.from([10,255])));assert.throws(()=>fields(Buffer.from([0])));
});
test('local event mapping counts likes and final gift streaks and separates follows from shares', () => {
  assert.equal(decodeEvent('WebcastLikeMessage',join(integer(2,12),bytes(5,user))).count,12);
  assert.equal(decodeEvent('WebcastSocialMessage',join(integer(4,1),bytes(2,user))).kind,'follow');
  assert.equal(decodeEvent('WebcastSocialMessage',join(integer(4,3),bytes(2,user))).kind,'share');
  const gift=join(integer(11,1),bytes(16,'Rosa'));
  assert.equal(decodeEvent('WebcastGiftMessage',join(bytes(7,user),bytes(15,gift),integer(5,4))),null);
  const final=decodeEvent('WebcastGiftMessage',join(bytes(7,user),bytes(15,gift),integer(5,4),integer(9,1)));
  assert.equal(final.gift,'Rosa');assert.equal(final.count,4);
  const superfan=join(bytes(24,join(bytes(1,'ttlive_superfan_purchase'),bytes(4,bytes(21,bytes(1,user))))));
  assert.equal(decodeEvent('WebcastBarrageMessage',superfan).kind,'superfan');
  assert.equal(decodeEvent('WebcastBarrageMessage',bytes(5,bytes(1,'ttlive_superfan_commentnotif_superfanjoined'))),null);
  assert.equal(decodeEvent('WebcastControlMessage',integer(2,3)).kind,'ended');
});
test('browser integration restricts automation and observed traffic to the selected TikTok LIVE', () => {
  assert.ok(isLivePage('https://www.tiktok.com/@Ana/live?x=1','ana'));
  for(const url of ['https://www.tiktok.com/@other/live','https://tiktok.com.evil.test/@ana/live','https://www.tiktok.com/login','http://www.tiktok.com/@ana/live'])assert.equal(isLivePage(url,'ana'),false);
  assert.ok(isWebcastURL('wss://webcast-ws.tiktok.com/webcast/im/push/v2/'));
  assert.equal(isWebcastURL('https://eulerstream.com/webcast/im/push/'),false);
});
test('help splits long descriptions without truncating commands or unicode', () => {
  const config={enabled:true,commands:Array.from({length:10},(_,i)=>({enabled:true,command:'!c'+i,description:'🎮'.repeat(60)}))};
  const messages=commandHelpMessages(config);assert.ok(messages.every(text=>[...text].length<=150));
  for(const row of config.commands)assert.ok(messages.some(text=>text.includes(row.command+': '+row.description)));
  assert.throws(()=>commandHelpMessages({...config,enabled:false}));
});
test('passive client deduplicates frames and never replays old comments', async () => {
  const emitted=[];const client=new LocalTikTokClient({username:'ana',emit:event=>emitted.push(event)});
  client.session='page';client.pageOK=true;client.socketIds.add('ws');
  const payload=frame(envelope('WebcastChatMessage',join(bytes(2,user),bytes(3,'!Aatrox')))).toString('base64');
  const event={sessionId:'page',method:'Network.webSocketFrameReceived',params:{requestId:'ws',response:{opcode:2,payloadData:payload}}};
  await client.onEvent(event);await client.onEvent(event);assert.equal(emitted.length,1);
  await client.onEvent({...event,params:{...event.params,requestId:'other'}});assert.equal(emitted.length,1);
});
test('chat sender requires confirmation from TikTok and rejects drafts without typing', async () => {
  const client=new LocalTikTokClient({username:'ana',emit(){}});client.session='page';client.canSend=true;
  client.poll=async()=>{};client.evaluate=async expression=>expression==='location.href'?'https://www.tiktok.com/@ana/live':{focused:true,draft:true};
  const calls=[];client.call=async(method,params)=>{calls.push({method,params});if(method==='Network.getResponseBody')return {body:'{"status_code":0}'};return {};};
  await assert.rejects(client.send('hola'),/borrador/);assert.equal(calls.length,0);
  client.evaluate=async expression=>expression==='location.href'?'https://www.tiktok.com/@ana/live':{focused:true,draft:false};
  let resolved=false;const sent=client.send('hola').then(()=>{resolved=true;});
  await new Promise(resolve=>setImmediate(resolve));assert.equal(resolved,false);
  assert.ok(calls.some(call=>call.method==='Input.insertText'&&call.params.text==='hola'));
  await client.onEvent({sessionId:'page',method:'Network.requestWillBeSent',params:{requestId:'send1',request:{url:'https://webcast.tiktok.com/webcast/room/chat/'}}});
  await client.onEvent({sessionId:'page',method:'Network.loadingFinished',params:{requestId:'send1'}});
  await sent;assert.equal(resolved,true);assert.equal(client.sendTask,null);
});
test('chat rejection does not retry and closes the pending confirmation', async () => {
  const client=new LocalTikTokClient({username:'ana',emit(){}});client.session='page';client.canSend=true;client.poll=async()=>{};
  client.evaluate=async expression=>expression==='location.href'?'https://www.tiktok.com/@ana/live':{focused:true,draft:false};
  let typed=0;client.call=async method=>{if(method==='Input.insertText')typed++;return method==='Network.getResponseBody'?{body:'{"status_code":5}'}:{};};
  const sending=client.send('hola');const rejected=assert.rejects(sending,/rechazó/);await new Promise(resolve=>setImmediate(resolve));
  await client.onEvent({sessionId:'page',method:'Network.requestWillBeSent',params:{requestId:'send1',request:{url:'https://webcast.tiktok.com/webcast/room/chat/'}}});
  await client.onEvent({sessionId:'page',method:'Network.loadingFinished',params:{requestId:'send1'}});
  await rejected;assert.equal(typed,1);assert.equal(client.sendTask,null);
});
