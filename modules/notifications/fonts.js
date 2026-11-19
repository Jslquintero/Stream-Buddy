import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
export function notificationFonts(dataDir,changed){
  const directory=path.join(dataDir,'notification-fonts'),manifest=path.join(dataDir,'notification-fonts.json');
  let fonts=[],installing=false;
  try{fonts=JSON.parse(fs.readFileSync(manifest,'utf8')).filter(f=>/^[a-f0-9]{24}$/.test(f.id)&&typeof f.name==='string'&&fs.existsSync(path.join(directory,f.id+'.css')));}catch{}
  async function download(url,max){
    const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(30000),headers:{'User-Agent':'Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36'}});
    if(!response.ok)throw new Error('No se pudo descargar la fuente ('+response.status+'). Comprueba el nombre en Google Fonts.');
    const chunks=[];let size=0;for await(const chunk of response.body){size+=chunk.length;if(size>max)throw new Error('La fuente supera el tamaño permitido');chunks.push(chunk);}return Buffer.concat(chunks);
  }
  return {
    state:()=>({items:fonts,installing}),
    read(name){if(!/^[a-f0-9]{24,64}\.(css|woff2|woff|ttf)$/.test(name))return null;try{return {bytes:fs.readFileSync(path.join(directory,name)),mime:name.endsWith('.css')?'text/css; charset=utf-8':name.endsWith('.ttf')?'font/ttf':name.endsWith('.woff2')?'font/woff2':'font/woff'};}catch(e){if(e.code==='ENOENT')return null;throw e;}},
    async install(name){
      if(typeof name!=='string'||!/^[A-Za-z][A-Za-z0-9 -]{0,79}$/.test(name.trim()))throw new Error('Escribe el nombre de una familia de Google Fonts');
      name=name.trim().replace(/\s+/g,' ');
      const existing=fonts.find(f=>f.name.toLowerCase()===name.toLowerCase());if(existing)return existing;
      if(installing)throw new Error('Espera a que termine la instalación actual');
      installing=true;changed();
      try{
        const id=createHash('sha256').update(name.toLowerCase()).digest('hex').slice(0,24);
        const css=(await download('https://fonts.googleapis.com/css2?'+new URLSearchParams({family:name,display:'swap'}),200000)).toString('utf8');
        const blocks=css.match(/@font-face\s*\{[^}]+\}/g)||[];
        if(!blocks.length||blocks.length>40)throw new Error('Google Fonts no devolvió una familia compatible');
        fs.mkdirSync(directory,{recursive:true});let local='',total=0;
        for(const block of blocks){
          const raw=block.match(/url\(([^)]+)\)/)?.[1]?.replace(/['"]/g,'');
          const url=new URL(raw);if(url.protocol!=='https:'||url.hostname!=='fonts.gstatic.com')throw new Error('Origen de fuente no válido');
          const data=await download(url.href,3*1024*1024);total+=data.length;if(total>15*1024*1024)throw new Error('La familia supera 15 MB');
          const signature=data.toString('ascii',0,4),ext=signature==='wOF2'?'woff2':signature==='wOFF'?'woff':data.readUInt32BE(0)===0x00010000?'ttf':null;
          if(!ext)throw new Error('Archivo de fuente no compatible');
          const asset=createHash('sha256').update(data).digest('hex')+'.'+ext;fs.writeFileSync(path.join(directory,asset),data);
          const weight=block.match(/font-weight:\s*([0-9 ]+);/)?.[1]||'400';
          const range=block.match(/unicode-range:\s*([Uu0-9a-fA-F+?,\- ]+);/)?.[1];
          local+=`@font-face{font-family:"GoogleFont-${id}";font-style:normal;font-weight:${weight};font-display:swap;src:url('/notification-fonts/${asset}')${range?';unicode-range:'+range:''};}\n`;
        }
        fs.writeFileSync(path.join(directory,id+'.css'),local);
        const font={id,name};const next=[...fonts,font];
        fs.writeFileSync(manifest+'.tmp',JSON.stringify(next,null,2));fs.renameSync(manifest+'.tmp',manifest);fonts=next;return font;
      }finally{installing=false;changed();}
    },
  };
}
