import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createNotificationsModule } from '../modules/notifications/index.js';
import { defaultNotifications, migrateNotifications, notificationText, validateNotifications, notificationDesign } from '../modules/notifications/config.js';

function fixture(t) {
  const dataDir = fs.mkdtempSync(new URL('./scratch-notifications-', import.meta.url));
  const context = { dataDir, changed() {}, log() {} };
  const module = createNotificationsModule(context);
  t.after(() => { module.close(); for (const name of fs.readdirSync(dataDir)) { const file=path.join(dataDir,name); if(name==='notification-assets'){for(const asset of fs.readdirSync(file))fs.unlinkSync(path.join(file,asset));fs.rmdirSync(file);}else fs.unlinkSync(file); } fs.rmdirSync(dataDir); });
  return { module, context };
}

test('Super Fan migrates existing settings, persists customization and respects its toggle', t => {
  const { module, context } = fixture(t);
  const legacy = structuredClone(defaultNotifications);
  delete legacy.events.superfan;
  delete legacy.textShadow;
  legacy.events.follow.title = 'Mi saludo';
  fs.writeFileSync(path.join(context.dataDir, 'notifications.json'), JSON.stringify(legacy));
  const reopened = createNotificationsModule(context); t.after(() => reopened.close());
  const config = reopened.state().config;
  assert.equal(config.events.follow.title, 'Mi saludo');
  assert.equal(config.events.superfan.enabled, true);
  assert.equal(config.textShadow, false);
  config.events.superfan.message = '{usuario} es Super Fan';
  config.events.superfan.appearance = {...notificationDesign(config), animation:'bounce', borderOpacity:0, textShadow:true};
  reopened.save(config);
  const saved = createNotificationsModule(context); t.after(() => saved.close());
  assert.equal(saved.enqueue('superfan', {user:'Ana'}), true);
  assert.equal(saved.state().current.message, 'Ana es Super Fan');
  assert.equal(saved.state().current.style.borderOpacity, 0);
  assert.equal(saved.state().current.style.textShadow, true);
  assert.equal(saved.state().config.textShadow, false);
  saved.clear(); config.events.superfan.enabled = false; saved.save(config);
  assert.equal(saved.enqueue('superfan', {user:'Ana'}), false);
});
test('notification settings persist and invalid updates preserve the saved config', t => {
  const { module, context } = fixture(t);
  const config = structuredClone(defaultNotifications);
  config.duration = 3; config.events.gift.message = '{usuario}: {cantidad} de {regalo}';
  module.save(config);
  const reopened = createNotificationsModule(context); t.after(() => reopened.close());
  assert.deepEqual(reopened.state().config,config);
  assert.throws(() => module.save({ ...config, duration: -1 }));
  assert.throws(() => validateNotifications({ ...config, accent: 'url(evil)' }));
  assert.throws(() => validateNotifications({ ...config, textShadow: 'true' }), /Sombra del texto/);
  assert.deepEqual(module.state().config,config);
  assert.equal(notificationText('{usuario} {cantidad} {regalo}', { user: '{regalo}', count: 4, gift: '<script>' }), '{regalo} 4 <script>');
});
test('alerts serialize, expire, respect disabled events and clear on disable', t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const { module } = fixture(t);
  assert.equal(module.enqueue('follow',{user:'Ana'}),true);
  const id = module.state().current.id;
  module.enqueue('gift',{user:'Luis',gift:'Rosa',count:5});
  assert.equal(module.state().queued,1);
  assert.equal(module.state().current.id,id);
  t.mock.timers.tick(6001);
  assert.equal(module.state().current.type,'gift');
  assert.match(module.state().current.message,/5 × Rosa/);
  module.skip(); assert.equal(module.state().current,null);
  const config = structuredClone(defaultNotifications); config.events.share.enabled=false;
  module.save(config); assert.equal(module.enqueue('share'),false);
  module.enqueue('follow'); module.enqueue('gift');
  module.save({...config,enabled:false});
  assert.equal(module.state().current,null); assert.equal(module.state().queued,0);
  assert.equal(module.enqueue('follow'),false);
  assert.throws(()=>module.enqueue('unknown'));
});
test('test alerts use draft styles without saving and queue stays bounded', t => {
  const { module } = fixture(t);
  module.enqueue('gift',{}, {...defaultNotifications,accent:'#ff0000'});
  assert.equal(module.state().current.style.accent,'#ff0000');
  assert.equal(module.state().config.accent,defaultNotifications.accent);
  for(let i=0;i<30;i++) assert.equal(module.enqueue('follow'),true);
  assert.equal(module.enqueue('share'),false);
  module.clear(); assert.equal(module.state().queued,0); assert.equal(module.state().current,null);
  module.close(); assert.equal(module.enqueue('follow'),false);
});

test('GIF uploads preserve bytes, persist across restart and reject unsafe formats',t=>{
  const {module,context}=fixture(t);
  const bytes=Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAAAAAAALAAAAAABAAEAAAIBRAA7','base64');
  const data='data:image/gif;base64,'+bytes.toString('base64');
  const uploaded=module.assets.upload({data});
  assert.match(uploaded.image,/\/notification-assets\/[a-f0-9]{64}\.gif$/);
  assert.equal(module.assets.upload({data}).image,uploaded.image);
  const config=structuredClone(defaultNotifications);config.events.gift.image=uploaded.image;
  config.events.gift.appearance={...notificationDesign(config,'gift'),layout:'top',duration:12,backgroundOpacity:0,fontFamily:'serif',width:900};
  module.save(config);
  const reopened=createNotificationsModule(context);t.after(()=>reopened.close());
  assert.deepEqual(reopened.assets.read(path.basename(uploaded.image)).bytes,bytes);
  reopened.enqueue('gift');assert.equal(reopened.state().current.image,uploaded.image);
  assert.equal(reopened.state().current.style.duration,12);assert.equal(reopened.state().current.style.layout,'top');
  reopened.clear();reopened.enqueue('follow');assert.equal(reopened.state().current.style.duration,6);
  assert.equal(reopened.state().current.image,'');
  assert.throws(()=>module.assets.upload({data:'data:image/svg+xml;base64,PHN2Zz4='}));
  assert.throws(()=>module.assets.upload({data:'data:image/gif;base64,PGh0bWw+'}));
  assert.throws(()=>module.assets.upload({data:'data:image/gif;base64,'+'A'.repeat(7100001)}));
  assert.equal(module.assets.read('../notifications.json'),null);
  const legacy=structuredClone(defaultNotifications);delete legacy.width;delete legacy.events.follow.image;
  assert.equal(validateNotifications(legacy).width,680);
  config.events.gift.image='javascript:alert(1)';assert.throws(()=>validateNotifications(config));
});

test('audio and video assets persist with per-event volume and bounded trims',t=>{
  const {module}=fixture(t);
  const wav=Buffer.concat([Buffer.from('RIFF'),Buffer.alloc(4),Buffer.from('WAVEfmt '),Buffer.alloc(40)]);
  const mp4=Buffer.concat([Buffer.from([0,0,0,24]),Buffer.from('ftypisom'),Buffer.alloc(24)]);
  const audio=module.assets.upload({kind:'audio',data:'data:audio/wav;base64,'+wav.toString('base64')}).audio;
  const video=module.assets.upload({kind:'video',data:'data:video/mp4;base64,'+mp4.toString('base64')}).video;
  assert.deepEqual(module.assets.read(path.basename(audio)).bytes,wav);
  assert.equal(module.assets.read(path.basename(video)).mime,'video/mp4');
  const config=structuredClone(defaultNotifications);
  Object.assign(config.events.gift,{audio,video,volume:35,videoStart:12,videoEnd:18,videoDuration:60,videoMuted:false,audioStart:2,audioEnd:8,audioDuration:20});
  module.save(config);module.enqueue('gift');
  assert.equal(module.state().current.audio,audio);assert.equal(module.state().current.volume,35);
  assert.equal(module.state().current.videoStart,12);assert.equal(module.state().current.videoEnd,18);
  assert.equal(module.state().current.videoMuted,false);
  assert.equal(module.state().current.audioStart,2);assert.equal(module.state().current.audioEnd,8);assert.equal(module.state().current.audioDuration,20);
  module.clear();module.enqueue('follow');assert.equal(module.state().current.audio,'');
  config.events.gift.videoEnd=50;assert.throws(()=>validateNotifications(config));
  config.events.gift.videoEnd=18;config.events.gift.volume=101;assert.throws(()=>validateNotifications(config));
  config.events.gift.volume=35;config.events.gift.audioEnd=1.5;assert.throws(()=>validateNotifications(config));
  config.events.gift.audioEnd=8;config.events.gift.audioDuration=5;assert.throws(()=>validateNotifications(config));
  config.events.gift.audioDuration=20;config.events.gift.audioStart=25;assert.throws(()=>validateNotifications(config));
  config.events.gift.audioDuration=60;config.events.gift.audioStart=2;config.events.gift.audioEnd=33;assert.throws(()=>validateNotifications(config));
  assert.throws(()=>module.assets.upload({kind:'video',data:'data:video/mp4;base64,PGh0bWw+'}));
  assert.throws(()=>module.assets.upload({kind:'audio',data:'data:audio/mpeg;base64,PGh0bWw+'}));
});

test('legacy alerts keep the previously displayed video and their audio when both visuals were saved',()=>{
  const config = structuredClone(defaultNotifications);
  const media = { image:'/notification-assets/'+'a'.repeat(64)+'.gif', imageName:'old.gif', video:'/notification-assets/'+'b'.repeat(64)+'.mp4',
    videoName:'intro.mp4', audio:'/notification-assets/'+'a'.repeat(64)+'.mp3' };
  Object.assign(config.events.follow, media);
  assert.throws(() => validateNotifications(config), /imagen o un video/);
  const event = migrateNotifications(config).events.follow;
  assert.equal(event.image, '');
  assert.equal(event.imageName, '');
  assert.equal(event.video, media.video);
  assert.equal(event.audio, media.audio);
});

test('external media is rejected for new alerts and removed from legacy settings', () => {
  const config = structuredClone(defaultNotifications);
  const event = config.events.gift;
  const image = '/notification-assets/'+'a'.repeat(64)+'.gif';
  for (const [kind,url] of [['image','https://cdn.example.com/alert.gif'], ['video','https://youtu.be/clip'], ['audio','https://example.com/audio.mp3']]) {
    event[kind] = url;
    assert.throws(() => validateNotifications(config));
    event[kind] = '';
  }
  Object.assign(event,{image,video:'https://example.com/old.mp4',videoName:'old.mp4'});
  config.events.follow.image='https://cdn.example.com/old.gif';
  config.events.follow.imageName='old.gif';
  const migrated=migrateNotifications(config);
  assert.equal(migrated.events.follow.image,'');
  assert.equal(migrated.events.follow.imageName,'');
  assert.equal(migrated.events.gift.video,'');
  assert.equal(migrated.events.gift.videoName,'');
  assert.equal(migrated.events.gift.image,image);
  assert.equal(migrated.events.gift.title,event.title);
});

test('image upload accepts GIFs above the old 5 MB limit and rejects above 20 MB',t=>{
  const {module}=fixture(t);
  const bytes=Buffer.alloc(6*1024*1024);bytes.write('GIF89a');
  const {image}=module.assets.upload({data:'data:image/gif;base64,'+bytes.toString('base64')});
  assert.deepEqual(module.assets.read(path.basename(image)).bytes,bytes);
  assert.throws(()=>module.assets.upload({data:'data:image/gif;base64,'+'A'.repeat(28000000)}),/20 MB/);
});

test('local settings migrate older designs and recover a backup without losing media',t=>{
  const {module,context}=fixture(t);const config=structuredClone(defaultNotifications);
  config.events.gift.image='/notification-assets/'+'c'.repeat(64)+'.gif';config.events.gift.appearance={...notificationDesign(config,'gift'),animation:'bounce',borderOpacity:0,fontFamily:'google:'+'a'.repeat(24)};
  module.save(config);const firstRevision=module.state().revision;
  config.events.follow.title='Guardado nuevo';module.save(config);assert.ok(module.state().revision>firstRevision);
  const reopened=createNotificationsModule(context);t.after(()=>reopened.close());assert.equal(reopened.state().config.events.gift.appearance.borderOpacity,0);
  assert.equal(reopened.state().config.events.gift.appearance.fontFamily,'google:'+'a'.repeat(24));
  fs.writeFileSync(path.join(context.dataDir,'notifications.json'),'{broken');
  const recovered=createNotificationsModule(context);t.after(()=>recovered.close());assert.match(recovered.state().error,/recuperada/);assert.equal(recovered.state().config.events.gift.image,'/notification-assets/'+'c'.repeat(64)+'.gif');
  delete config.borderOpacity;delete config.animationSpeed;delete config.events.gift.appearance.borderOpacity;
  fs.writeFileSync(path.join(context.dataDir,'notifications.json'),'\uFEFF'+JSON.stringify(config));
  const legacy=createNotificationsModule(context);t.after(()=>legacy.close());assert.equal(legacy.state().error,'');assert.equal(legacy.state().config.borderOpacity,100);assert.equal(legacy.state().config.events.gift.image,'/notification-assets/'+'c'.repeat(64)+'.gif');
});
