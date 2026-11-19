import { useEffect, useId, useRef, useState } from 'react';
import { ImagePlus, Music2, Upload, Film, Trash2 } from 'lucide-react';
import { Button, Input } from './ui';
import { videoSite } from '../../../modules/notifications/video-sites';
import { WebsiteVideo } from './website-video';

export function MediaPicker({kind,src,name,busy,disabled,onFile,onRemove,onURL,children}) {
  const input=useRef(null),[drag,setDrag]=useState(false);
  const [url,setURL]=useState(''),[urlError,setURLError]=useState('');const urlId=useId();
  const [fileError,setFileError]=useState('');
  const pickFile=async file=>{setFileError('');try{await onFile(file);}catch(error){setFileError(error.message);}};
  useEffect(()=>{setURL(/^https?:\/\//i.test(src||'')?src:'');setURLError('');},[src,kind]);
  const applyURL=async()=>{setURLError('');try{await onURL(url.trim());}catch(error){setURLError(error.message);}};
  const audio=kind==='audio',video=kind==='video';
  const Icon=audio?Music2:video?Film:ImagePlus;
  const title=audio?'Sonido de la alerta':video?'Video de la alerta':'Imagen o GIF';
  const formats=audio?'MP3, WAV u OGG · hasta 5 MB':video?'MP4 o WebM · hasta 30 MB':'PNG, JPG, WebP o GIF · hasta 20 MB';
  return <section className={'alert-media-picker '+(drag?'dragging':'')} aria-label={title} onDragOver={e=>{e.preventDefault();if(!disabled)setDrag(true);}} onDragLeave={()=>setDrag(false)} onDrop={e=>{e.preventDefault();setDrag(false);if(!disabled&&e.dataTransfer.files[0])void pickFile(e.dataTransfer.files[0]);}}>
    <div className="alert-media-heading"><Icon size={18}/><strong>{title}</strong><span>{src?'Cargado':'Opcional'}</span></div>
    <input ref={input} type="file" hidden accept={audio?'audio/mpeg,audio/wav,audio/ogg,.mp3,.wav,.ogg':video?'video/mp4,video/webm,.mp4,.webm':'image/png,image/jpeg,image/webp,image/gif,.gif,.png,.jpg,.jpeg,.webp'} disabled={disabled} onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)void pickFile(file);}}/>
    {!audio&&!video&&<button className="alert-image-picker" type="button" disabled={disabled} onClick={()=>input.current.click()} aria-label={src?'Cambiar imagen o GIF':'Seleccionar imagen o GIF'}>{src?<img src={src} alt="Vista previa del archivo seleccionado"/>:<><Upload size={28}/><span>Selecciona o arrastra tu imagen</span><small>Los GIF conservan su animación</small></>}</button>}
    <div className="alert-media-info"><p title={name}>{src?(name||'Archivo guardado'):formats}</p>{src&&<small>{/^https?:\/\//i.test(src)?'Recurso enlazado · sin copia local':formats}</small>}</div>
    {children}
    <div className="alert-media-actions"><Button variant="outline" size="sm" disabled={disabled} onClick={()=>input.current.click()}><Upload size={14}/>{busy?'Procesando…':src?'Cambiar archivo':'Elegir archivo'}</Button>{src&&<Button variant="ghost" size="sm" disabled={disabled} onClick={onRemove}><Trash2 size={14}/>Quitar {audio?'audio':video?'video':'imagen'}</Button>}</div>
    {onURL&&<div className="alert-media-url"><label htmlFor={urlId}>{video?'Enlace de video':'URL directa de imagen o GIF'}</label><div><Input id={urlId} inputMode="url" value={url} maxLength={2048} placeholder={video?'https://www.youtube.com/watch?v=':'https://ejemplo.com/alerta.gif'} disabled={disabled} onChange={e=>{setURL(e.target.value);setURLError('');}} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();if(!disabled&&url.trim())void applyURL();}}}/><Button variant="outline" size="sm" disabled={disabled||!url.trim()} onClick={applyURL}>Usar URL</Button></div><p className="help">{video?'YouTube, Vimeo o un archivo MP4/WebM. El video debe permitir reproducción fuera de su sitio.':'Enlace directo a la imagen o GIF. Debe seguir disponible en su origen.'}</p>{urlError&&<p className="error" role="alert">{urlError}</p>}</div>}
    {fileError&&<p className="error" role="alert">{fileError}</p>}
    {busy&&<p className="help" role="status">Cargando y comprobando el archivo…</p>}
  </section>;
}

export function AudioPreview({src,volume}) {
  const ref=useRef(null);
  useEffect(()=>{if(ref.current)ref.current.volume=volume/100;},[volume,src]);
  return <audio ref={ref} key={src} controls src={src} preload="metadata" aria-label="Escuchar audio de la alerta"/>;
}

export function AlertAudio({notification}) {
  const ref=useRef(null),[blocked,setBlocked]=useState(false);
  const {audio,volume=80,expiresAt,style}=notification;
  useEffect(()=>{
    const player=ref.current;if(!player||!audio)return;
    let active=true;
    player.volume=volume/100;
    const play=()=>{
      const offset=Math.max(0,(Date.now()-(expiresAt-style.duration*1000))/1000);
      if(Number.isFinite(player.duration)&&offset>=player.duration)return;
      player.currentTime=offset;
      player.play()?.catch(error=>{if(active&&error.name==='NotAllowedError')setBlocked(true);});
    };
    player.addEventListener('loadedmetadata',play);
    if(player.readyState>=1)play();
    return ()=>{active=false;player.removeEventListener('loadedmetadata',play);player.pause();};
  },[audio,volume,expiresAt,style.duration]);
  return audio?<><audio ref={ref} src={audio} preload="auto"/>{blocked&&<Button className="alert-enable-sound" onClick={()=>ref.current.play().then(()=>setBlocked(false)).catch(()=>{})}>Activar sonido</Button>}</>:null;
}

export function VideoClip(props) {
  return videoSite(props.src)?<WebsiteVideo {...props}/>:<FileVideoClip {...props}/>;
}
function FileVideoClip({src,start=0,end=6,muted=true,volume=80,autoPlay=false,expiresAt,duration,style,fit='contain'}) {
  const ref=useRef(null),[blocked,setBlocked]=useState(false);
  useEffect(()=>{if(ref.current)ref.current.volume=volume/100;},[volume]);
  useEffect(()=>{
    const player=ref.current;let active=true,timer;
    const begin=()=>{
      const offset=autoPlay&&expiresAt?Math.max(0,(Date.now()-(expiresAt-duration*1000))/1000):0;
      player.currentTime=Math.min(start+offset,end);
      if(autoPlay&&player.currentTime<end){player.play()?.catch(()=>{if(active)setBlocked(true);});timer=setTimeout(()=>player.pause(),Math.max(0,(end-player.currentTime)*1000));}
    };
    player.addEventListener('loadedmetadata',begin);if(player.readyState>=1)begin();
    return ()=>{active=false;clearTimeout(timer);player.removeEventListener('loadedmetadata',begin);player.pause();};
  },[src,start,end,autoPlay,expiresAt,duration]);
  const play=()=>{ref.current.currentTime=start;ref.current.play().then(()=>setBlocked(false)).catch(()=>setBlocked(true));};
  return <div className="alert-video-wrap" style={style}><video ref={ref} src={src} muted={muted} playsInline preload="metadata" style={{objectFit:fit,height:style?.height?'100%':undefined}} controls={!autoPlay} onTimeUpdate={()=>{if(ref.current.currentTime>=end)ref.current.pause();}} onSeeking={()=>{const player=ref.current;if(player.currentTime<start||player.currentTime>end)player.currentTime=start;}}/>{(!autoPlay||blocked)&&<Button variant="outline" size="sm" onClick={play}>{autoPlay?'Reproducir video':'Ver fragmento'}</Button>}</div>;
}
