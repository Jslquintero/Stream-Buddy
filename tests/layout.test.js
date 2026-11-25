import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { defaultLayout, validateLayout, themes, createVerticalLayout, layoutTemplates, isCameraWindow, createIconRow } from '../shared/layout.js';
import { createLayoutModule } from '../backend/modules/layout.js';
import { layoutOutputURL } from '../shared/layout-url.js';
import { baseThemeCSS, validateThemeCSS } from '../shared/custom-themes.js';

test('custom canvas resolution persists and invalid dimensions are rejected', t => {
  const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'studio-canvas-'));
  t.after(()=>fs.rmSync(dataDir,{recursive:true,force:true}));
  const context={dataDir,changed(){},log(){}};
  const module=createLayoutModule(context);
  const document={...structuredClone(defaultLayout),canvasWidth:1440,canvasHeight:2560};
  module.save(document);
  assert.equal(createLayoutModule(context).state().document.canvasWidth,1440);
  assert.equal(createLayoutModule(context).state().document.canvasHeight,2560);
  for(const dimensions of [{canvasWidth:0},{canvasHeight:7681},{canvasWidth:720.5},{canvasHeight:undefined}]){
    assert.throws(()=>validateLayout({...document,...dimensions}),/lienzo/);
  }
});

test('TikTok output links retain the local suffix and configured port', () => {
  for (const host of ['127.0.0.1','localhost','[::1]']) {
    assert.equal(layoutOutputURL(`http://${host}:17900/?editor=1#old`),'http://127.0.0.1:17900/output/layout#tiktok.studio');
  }
  assert.equal(layoutOutputURL('http://127.0.0.1:17901/'),'http://127.0.0.1:17901/output/layout#tiktok.studio');
});

test('layout persists all styles and rejects invalid documents without losing saved work', t => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(),'studio-layout-'));
  t.after(()=>{for(const f of fs.readdirSync(dataDir))fs.unlinkSync(path.join(dataDir,f));fs.rmdirSync(dataDir);});
  const context={dataDir,changed(){},log(){}};
  const module=createLayoutModule(context);
  assert.equal(module.state().running,true);
  for(const theme of Object.keys(themes)) {
    const document={...structuredClone(defaultLayout),theme};
    document.elements[0].text='Texto personalizado';
    module.save(document);
    assert.deepEqual(createLayoutModule(context).state().document,document);
  }
  const saved=fs.readFileSync(path.join(dataDir,'layout.json'),'utf8');
  const taskbar={...defaultLayout.elements[0],id:'bar',kind:'taskbar',title:'start',x:0,y:98,w:100,h:2};
  assert.equal(validateLayout({...defaultLayout,elements:[taskbar]}).elements[0].h,2);
  const invalid=structuredClone(defaultLayout);invalid.elements[0].x=99;
  assert.throws(()=>module.save(invalid));
  assert.equal(fs.readFileSync(path.join(dataDir,'layout.json'),'utf8'),saved);
  invalid.elements[0].x=5;invalid.elements.push(invalid.elements[0]);
  assert.throws(()=>validateLayout(invalid));
  assert.throws(()=>validateLayout({...defaultLayout,theme:'unknown'}));
  assert.throws(()=>validateLayout({...defaultLayout,background:'url(https://example.com)'}));
  module.save({...defaultLayout,elements:[]});
  assert.deepEqual(createLayoutModule(context).state().document.elements,[],'Deleting the last element persists after restart');
  const withImage={...defaultLayout,transparent:false,backgroundMode:'image',backgroundFit:'contain',backgroundImage:'data:image/png;base64,aGVsbG8='};
  module.save(withImage);
  assert.deepEqual(createLayoutModule(context).state().document,withImage);
  const row=createIconRow('row');row.icons[0]={...row.icons[0],name:'Mi juego',image:'data:image/png;base64,aGVsbG8=',style:'xp',labelPosition:'top',size:128};
  const withIcons={...withImage,elements:[row]};module.save(withIcons);
  assert.deepEqual(createLayoutModule(context).state().document,withIcons);
  const withTheme={...withIcons,theme:'custom-test',customThemes:[{id:'custom-test',name:'Mi overlay',css:baseThemeCSS}]};
  const before=module.state().revision;module.save(withTheme);assert.ok(module.state().revision>before);
  assert.deepEqual(createLayoutModule(context).state().document,withTheme);
  assert.throws(()=>validateLayout({...withTheme,customThemes:[]}));
  assert.throws(()=>validateLayout({...withTheme,customThemes:[withTheme.customThemes[0],withTheme.customThemes[0]]}));
  assert.throws(()=>validateThemeCSS('.layout-title { color: red;'));
  assert.throws(()=>validateThemeCSS('@import "https://example.com/style.css";'));
  assert.equal(validateThemeCSS('@keyframes pulse { from { opacity: .5; } to { opacity: 1; } }'),'@keyframes pulse { from { opacity: .5; } to { opacity: 1; } }');
  for(const patch of [{image:'javascript:alert(1)'},{image:'data:image/svg+xml;base64,PHN2Zz4='},{size:0},{size:257},{style:'unknown'},{labelPosition:'left'},{name:'a'.repeat(61)}]){
    const invalid=structuredClone(withIcons);Object.assign(invalid.elements[0].icons[0],patch);assert.throws(()=>validateLayout(invalid));
  }
  const duplicate=structuredClone(withIcons);duplicate.elements[0].icons.push(duplicate.elements[0].icons[0]);assert.throws(()=>validateLayout(duplicate));
  const crowded=structuredClone(withIcons);crowded.elements[0].icons=[];assert.throws(()=>validateLayout(crowded));
  for(const patch of [{backgroundImage:'https://example.com/a.png'},{backgroundImage:'data:image/svg+xml;base64,PHN2Zz4='},{backgroundImage:'a'.repeat(2000001)},{backgroundMode:'video'},{backgroundFit:'invalid'}])assert.throws(()=>validateLayout({...withImage,...patch}));
});
test('vertical templates fit the canvas, preserve theme and have independent editable elements', () => {
  assert.equal(defaultLayout.format,'portrait');
  for(const template of Object.keys(layoutTemplates))for(const theme of Object.keys(themes)){
    const layout=createVerticalLayout(template,theme);
    assert.deepEqual(validateLayout(layout),layout);
    assert.equal(layout.format,'portrait');assert.equal(layout.theme,theme);
    assert.ok(layout.elements.some(e=>e.id==='camera'&&e.kind==='frame'));
    assert.deepEqual(layout.elements.filter(isCameraWindow).map(e=>e.id),['camera']);
    layout.elements[0].title='Edited';
    assert.notEqual(createVerticalLayout(template,theme).elements[0].title,'Edited');
  }
});
