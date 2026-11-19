import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { maxImageBytes, maxImageDataLength, imageMimeFromBytes } from './image-files.js';
const mime = { png: 'image/png', gif: 'image/gif', jpg: 'image/jpeg', webp: 'image/webp', mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', mp4:'video/mp4', webm:'video/webm' };
export function notificationAssets(dataDir) {
  const directory = path.join(dataDir, 'notification-assets');
  return {
    upload({ data, kind = 'image' }) {
      if(kind==='video') {
        if(typeof data!=='string'||data.length>42000000)throw new Error('El video supera 30 MB');
        const match=/^data:video\/(mp4|webm);base64,([A-Za-z0-9+/]+={0,2})$/.exec(data);
        if(!match)throw new Error('Elige un video MP4 o WebM');
        const bytes=Buffer.from(match[2],'base64');
        if(!bytes.length||bytes.length>30*1024*1024)throw new Error('El video supera 30 MB');
        const format=bytes.toString('ascii',4,8)==='ftyp'?'mp4':bytes.subarray(0,4).equals(Buffer.from([26,69,223,163]))?'webm':null;
        if(format!==match[1])throw new Error('El archivo no corresponde al formato de video');
        const name=createHash('sha256').update(bytes).digest('hex')+'.'+format;
        fs.mkdirSync(directory,{recursive:true});fs.writeFileSync(path.join(directory,name),bytes);
        return {video:'/notification-assets/'+name};
      }
      if (kind === 'audio') {
        if (typeof data !== 'string' || data.length > 7100000) throw new Error('El audio supera 5 MB');
        const match = /^data:audio\/(mpeg|mp3|wav|x-wav|wave|ogg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(data);
        if (!match) throw new Error('Elige un audio MP3, WAV u OGG');
        const bytes = Buffer.from(match[2],'base64');
        if (!bytes.length || bytes.length > 5*1024*1024) throw new Error('El audio supera 5 MB');
        const format = bytes.toString('ascii',0,4)==='RIFF' && bytes.toString('ascii',8,12)==='WAVE' ? 'wav' : bytes.toString('ascii',0,4)==='OggS' ? 'ogg' : bytes.toString('ascii',0,3)==='ID3' || (bytes[0]===255 && (bytes[1]&224)===224) ? 'mp3' : null;
        if (!format || !({mp3:['mpeg','mp3'],wav:['wav','x-wav','wave'],ogg:['ogg']})[format].includes(match[1])) throw new Error('El contenido no corresponde al formato de audio');
        const name = createHash('sha256').update(bytes).digest('hex')+'.'+format;
        fs.mkdirSync(directory,{recursive:true});fs.writeFileSync(path.join(directory,name),bytes);
        return { audio:'/notification-assets/'+name };
      }
      if (typeof data !== 'string' || data.length > maxImageDataLength) throw new Error('La imagen o GIF supera 20 MB');
      const match = /^data:image\/(png|gif|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(data);
      if (!match) throw new Error('Elige una imagen PNG, JPG, WebP o GIF');
      const bytes = Buffer.from(match[2], 'base64');
      if (!bytes.length || bytes.length > maxImageBytes) throw new Error('La imagen o GIF supera 20 MB');
      const detected=imageMimeFromBytes(bytes);
      const format=Object.keys(mime).find(extension=>mime[extension]===detected);
      if (!format || mime[format] !== 'image/' + match[1]) throw new Error('El contenido no corresponde al formato de imagen');
      const name = createHash('sha256').update(bytes).digest('hex') + '.' + format;
      fs.mkdirSync(directory, {recursive:true});
      fs.writeFileSync(path.join(directory,name), bytes);
      return { image: '/notification-assets/' + name };
    },
    read(name) {
      if (!/^[a-f0-9]{64}\.(png|gif|jpg|webp|mp3|wav|ogg|mp4|webm)$/.test(name)) return null;
      try { return { bytes: fs.readFileSync(path.join(directory,name)), mime: mime[path.extname(name).slice(1)] }; }
      catch (error) { if (error.code === 'ENOENT') return null; throw error; }
    },
  };
}
