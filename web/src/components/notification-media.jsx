import { MediaFileField } from './ui/file-picker';
import { useEffect, useRef, useState } from 'react';
import { Button } from './ui';

export function MediaPicker({kind,src,name,busy,disabled,onFile,onRemove}) {
  const [fileError,setFileError]=useState('');
  const pickFile=async file=>{setFileError('');try{await onFile(file);}catch(error){setFileError(error.message);}};
  const audio=kind==='audio',video=kind==='video';
  const title=audio?'Sonido':video?'Video':'Imagen o GIF';
  return <MediaFileField className="alert-media-picker" kind={kind} title={title} name={name} compact src={src} busy={busy} disabled={disabled} onFile={pickFile} onRemove={onRemove} removeLabel={'Quitar '+(audio?'audio':video?'video':'imagen')}>
    {fileError&&<p className="error" role="alert">{fileError}</p>}
    {busy&&<p className="help" role="status">Cargando y comprobando el archivo…</p>}
  </MediaFileField>;
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

export function VideoClip({src,start=0,end=6,muted=true,volume=80,autoPlay=false,expiresAt,duration,style,fit='contain'}) {
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
