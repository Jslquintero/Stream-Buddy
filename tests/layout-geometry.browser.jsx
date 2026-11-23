import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { LayoutCanvas } from '../web/src/components/layout-studio.jsx';
import { createVerticalLayout, themes, createIconRow, messengerCameraKind, messengerCameraDimensions } from '../shared/layout.js';
import { baseThemeCSS } from '../shared/custom-themes.js';
import '../web/src/styles.css';
import '../web/src/components/xp-skin.css';
const root=createRoot(document.getElementById('root'));
const results=[];
const pause=()=>new Promise(resolve=>setTimeout(resolve,100));
function verify(condition,message){if(!condition)throw Error(message);}
async function run(){
 for(const theme of [...Object.keys(themes),'custom-test'])for(const format of ['portrait','landscape']){
  const document=createVerticalLayout('gaming',theme==='custom-test'?'dark':theme);document.format=format;document.transparent=false;document.background='#357ac2';
  if(theme==='custom-test'){document.theme=theme;document.customThemes=[{id:theme,name:'CSS test',css:baseThemeCSS+'\n.layout-title { height: 48px; background: rgb(115, 24, 84); } body { background: red !important; }'}];}
  const row=createIconRow('row');if(format==='landscape'){row.y=84;row.h=12;}
  row.icons.forEach((icon,i)=>{icon.style=['xp','dark','neon','minimal','theme','xp'][i];icon.labelPosition=i%2?'top':'bottom';});
  document.elements.push(row);
  flushSync(()=>root.render(<div className="geometry-pair"><section className="geometry-editor" style={{width:format==='portrait'?270:480}}><LayoutCanvas document={document} update={()=>{}} select={()=>{}}/></section><section className="geometry-output"><LayoutCanvas document={document}/></section></div>));
  await pause();
  const canvases=[...window.document.querySelectorAll('.layout-canvas')];
  const records=canvases.map(canvas=>{
   const plane=canvas.querySelector('.layout-plane'),p=plane.getBoundingClientRect(),c=canvas.getBoundingClientRect();
   const contentRoot=canvas.querySelector('.custom-theme-host')?.shadowRoot||canvas;
   verify(p.left>=c.left-1&&p.top>=c.top-1&&p.right<=c.right+1&&p.bottom<=c.bottom+1,'Scene cropped');
   verify(Math.abs(p.width/p.height-(format==='portrait'?9/16:16/9))<.001,'Scene stretched');
   return [...contentRoot.querySelectorAll('.layout-item')].map(item=>{
    const r=item.getBoundingClientRect();return {id:item.dataset.elementId,x:(r.left-p.left)/p.width*100,y:(r.top-p.top)/p.height*100,w:r.width/p.width*100,h:r.height/p.height*100,font:getComputedStyle(item.querySelector('.xp-title,.layout-title,.xp-taskbar-surface,.icon-row-content')).fontSize};
   });
  });
  for(let i=0;i<records[0].length;i++){
   for(const key of ['x','y','w','h']){
    verify(Math.abs(records[0][i][key]-records[1][i][key])<.02,`${theme}/${format} ${key} differs`);
    verify(Math.abs(records[1][i][key]-document.elements[i][key])<.02,`${theme}/${format} ${key} moved`);
   }
   verify(records[0][i].font===records[1][i].font,'Font size differs');
  }
  if(theme==='xp'){
   const svg=canvases[1].querySelector('.layout-background');
   const source=new XMLSerializer().serializeToString(svg);
   const image=new Image();
   await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(source);});
   const raster=window.document.createElement('canvas');raster.width=Number(svg.getAttribute('width'));raster.height=Number(svg.getAttribute('height'));
   const context=raster.getContext('2d');context.drawImage(image,0,0);
   for(const element of document.elements.filter(e=>e.kind!=='taskbar'&&e.kind!=='icons')){
    const x=element.x*raster.width/100,y=element.y*raster.height/100,w=element.w*raster.width/100,h=element.h*raster.height/100;
    for(const edge of [x+1,x+w-2]){
     const pixel=context.getImageData(Math.floor(edge),Math.floor(y+1),1,1).data;
     verify(pixel[0]===53&&pixel[1]===122&&pixel[2]===194&&pixel[3]===255,'XP corner must retain the background');
    }
    verify(context.getImageData(Math.floor(x+w/2),Math.floor(y+h/2),1,1).data[3]===0,'XP interior must remain transparent');
   }
   results.push('XP corner pixels / '+format+': PASS — background preserved, interior transparent');
  }
  for(const canvas of canvases){
   const plane=canvas.querySelector('.layout-plane'),scale=plane.getBoundingClientRect().width/Number(plane.dataset.width);
   const contentRoot=canvas.querySelector('.custom-theme-host')?.shadowRoot||canvas;
   [...contentRoot.querySelectorAll('.row-shortcut')].forEach((shortcut,i)=>{
    const picture=shortcut.querySelector('.row-icon-picture').getBoundingClientRect(),label=shortcut.querySelector('.row-icon-name').getBoundingClientRect();
    verify(Math.abs(picture.width/scale-row.icons[i].size)<.1,'Icon dimensions differ from configured size');
    verify(row.icons[i].labelPosition==='top'?label.bottom<=picture.top+.1:label.top>=picture.bottom-.1,'Icon label position differs');
   });
   if(theme==='custom-test'){
    verify(getComputedStyle(contentRoot.querySelector('.layout-title')).backgroundColor==='rgb(115, 24, 84)','Custom CSS must apply inside the overlay');
    verify(getComputedStyle(window.document.body).backgroundColor!=='rgb(255, 0, 0)','Custom CSS must not change the surrounding page');
    const body=contentRoot.querySelector('.layout-content').getBoundingClientRect(),opening=contentRoot.querySelector('mask rect[fill="black"]'),bounds=plane.getBoundingClientRect();
    verify(Math.abs(Number(opening.getAttribute('y'))-(body.top-bounds.top)/scale)<.1,'Custom background opening must follow the CSS title height');
   }
  }
  results.push(theme+' / '+format+': PASS — position, size, font, aspect ratio, no cropping');
 }
 const camera={id:'messenger',kind:messengerCameraKind,title:'Cámara MSN Messenger',text:'',x:0,y:0,...messengerCameraDimensions(110,1920,1080),fontSize:26,hidden:false,frameColor:'#dc143c'};
 const scene={theme:'xp',format:'landscape',transparent:false,background:'#357ac2',elements:[camera]};
 flushSync(()=>root.render(<LayoutCanvas document={scene}/>));
 const frame=window.document.querySelector('.messenger-camera svg');
 const context=window.document.createElement('canvas').getContext('2d');
 for(const svg of [frame,window.document.querySelector('.layout-background')]){
  const copy=svg.cloneNode(true);
  copy.setAttribute('width',svg===frame?'110':'1920');
  copy.setAttribute('height',svg===frame?'110':'1080');
  const image=new Image();
  await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(new XMLSerializer().serializeToString(copy));});
  context.clearRect(0,0,110,110);
  context.drawImage(image,0,0);
  const alpha=(x,y)=>context.getImageData(x,y,1,1).data[3];
  verify(alpha(55,55)===0,'Messenger camera center must remain transparent');
  verify(alpha(55,4)===255,'Messenger camera top rim must remain opaque');
  verify(alpha(0,0)===(svg===frame?0:255),'Messenger camera must preserve the layout behind the outer corner');
  if(svg===frame){
   const [red,green,blue]=context.getImageData(55,4,1,1).data;
   verify(red>green+80&&red>blue+60,'Messenger camera rim must render the configured tint');
  }
 }
 results.push('Messenger camera: PASS — rim, rounded corner and transparent aperture');
 flushSync(()=>root.render(<LayoutCanvas document={{...scene,elements:[{...camera,frameAnimated:true}]}}/>));
 const bands=[...frame.querySelectorAll('rect[pathLength]')];
 verify(bands.length>1,'The frame needs multiple moving color bands');
 frame.pauseAnimations();
 for(const [time,shift] of [[.5,-12.5],[1.5,-37.5],[4.5,-12.5]]){
  frame.setCurrentTime(time);
  bands.forEach((band,i)=>verify(Math.abs(parseFloat(getComputedStyle(band).strokeDashoffset)-(shift-i*25))<.1,'Messenger colors must move along the rim and repeat'));
 }
 results.push('Messenger camera: PASS — color bands move around the frame and repeat');
 window.document.getElementById('report').textContent=results.join('\n');window.document.body.dataset.test='pass';
}
run().catch(error=>{window.document.getElementById('report').textContent=error.stack;window.document.body.dataset.test='fail';});
