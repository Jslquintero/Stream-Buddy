import { videoSite } from '../../../modules/notifications/video-sites';
export function inspectNotificationMedia(src,kind,duration) {
  const site=kind==='video'?videoSite(src):null;
  if(site)return Promise.resolve({videoStart:site.start,videoEnd:site.start+duration,videoDuration:86400,videoMuted:true});
  return new Promise((resolve,reject)=>{
    const media=kind==='image'?new Image():document.createElement('video');
    const finish=(error,value={})=>{
      clearTimeout(timer);media.onload=null;media.onloadedmetadata=null;media.onerror=null;
      media.removeAttribute?.('src');
      error?reject(error):resolve(value);
    };
    const local=src.startsWith('data:');
    const timer=setTimeout(()=>finish(new Error(local?'No se pudo terminar de abrir el archivo local. Prueba a exportarlo de nuevo.':'El archivo no respondió. Comprueba que el enlace sea directo y accesible.')),local?30000:15000);
    media.onerror=()=>finish(new Error(local?'El navegador no pudo abrir el archivo local. Puede estar dañado o tener un formato no compatible.':'No se pudo abrir el archivo. Usa un enlace directo a una imagen, GIF o video, no a una página.'));
    if(kind==='image')media.onload=()=>finish(null);
    else {
      media.preload='metadata';
      media.onloadedmetadata=()=>{
        const length=media.duration;
        if(!Number.isFinite(length)||length<.1||length>86400)return finish(new Error('No se pudo leer la duración del video. Usa un archivo MP4 o WebM con duración definida.'));
        finish(null,{videoStart:0,videoEnd:Math.min(length,duration),videoDuration:length,videoMuted:true});
      };
    }
    media.src=src;
  });
}
