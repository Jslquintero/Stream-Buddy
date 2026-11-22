export function inspectNotificationMedia(src,kind,duration) {
  return new Promise((resolve,reject)=>{
    const media=kind==='image'?new Image():document.createElement('video');
    const finish=(error,value={})=>{
      clearTimeout(timer);media.onload=null;media.onloadedmetadata=null;media.onerror=null;
      media.removeAttribute?.('src');
      error?reject(error):resolve(value);
    };
    const timer=setTimeout(()=>finish(new Error('No se pudo terminar de abrir el archivo local. Prueba a exportarlo de nuevo.')),30000);
    media.onerror=()=>finish(new Error('El navegador no pudo abrir el archivo local. Puede estar dañado o tener un formato no compatible.'));
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
