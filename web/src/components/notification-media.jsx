import { MediaFileField } from './ui/file-picker';
import { useEffect, useRef, useState } from 'react';
import { Field } from './fields';
import { Button, Input } from './ui';
import { Pause, Play } from 'lucide-react';

export function MediaPicker({kind,src,name,busy,disabled,onFile,onRemove}) {
  const [fileError,setFileError]=useState('');
  const pickFile=async file=>{setFileError('');try{await onFile(file);}catch(error){setFileError(error.message);}};
  const audio=kind==='audio',video=kind==='video';
  const title=audio?'Sonido':video?'Video':'Imagen o GIF';
  return <MediaFileField className={'alert-media-picker alert-media-' + kind} kind={kind} title={title} name={name} compact compactPreview src={src} busy={busy} disabled={disabled} onFile={pickFile} onRemove={onRemove} removeLabel={'Quitar '+(audio?'audio':video?'video':'imagen')}>
    {fileError&&<p className="error" role="alert">{fileError}</p>}
    {busy&&<p className="help" role="status">Cargando y comprobando el archivo…</p>}
  </MediaFileField>;
}

export function AlertAudio({notification}) {
  const ref=useRef(null),[blocked,setBlocked]=useState(false);
  const {audio,volume=80,expiresAt,style,audioStart=0,audioEnd=0}=notification;
  const start=Math.max(0,Number(audioStart)||0), end=Math.max(0,Number(audioEnd)||0);
  useEffect(()=>{
    const player=ref.current;if(!player||!audio)return;
    let active=true,timer,started=false;
    player.volume=volume/100;
    const play=()=>{
      if(started)return;
      started=true;
      const offset=Math.max(0,(Date.now()-(expiresAt-style.duration*1000))/1000);
      const from=start+offset;
      if(Number.isFinite(player.duration)&&from>=player.duration)return;
      if(end>0&&from>=end)return;
      player.currentTime=from;
      player.play()?.catch(error=>{if(active&&error.name==='NotAllowedError')setBlocked(true);});
      if(end>0)timer=setTimeout(()=>player.pause(),Math.max(0,(end-from)*1000));
    };
    player.addEventListener('loadedmetadata',play);
    if(player.readyState>=1)play();
    return ()=>{active=false;clearTimeout(timer);player.removeEventListener('loadedmetadata',play);player.pause();};
  },[audio,volume,expiresAt,style.duration,start,end]);
  return audio?<><audio ref={ref} src={audio} preload="auto" onTimeUpdate={()=>{if(end>0&&ref.current.currentTime>=end)ref.current.pause();}}/>{blocked&&<Button className="alert-enable-sound" onClick={()=>ref.current.play().then(()=>setBlocked(false)).catch(()=>{})}>Activar sonido</Button>}</>:null;
}

const fallbackWaveform = Array.from({ length: 96 }, (_, index) => .18 + .72 * Math.abs(Math.sin(index * .55)) * (.55 + .45 * Math.sin(index * .11 + .6)));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function AudioTrimmer({src,start=0,end=0,duration=0,limit=6,accent='#b9f678',active=true,onChange}) {
  const player=useRef(null),track=useRef(null),previewEnd=useRef(0);
  const [peaks,setPeaks]=useState(null),[playing,setPlaying]=useState(false),[progress,setProgress]=useState(start);
  const known=Number(duration)>=.1;
  const maxStart=known?Math.max(0,duration-.1):Math.max(0,start+limit-.1);
  const selectedEnd=end>0?end:known?Math.min(duration,limit):limit;
  const fragment=Math.max(0,selectedEnd-start);
  const scale=known?duration:Math.max(start+limit,.1);
  const startPct=clamp((start/scale)*100,0,100);
  const endPct=clamp((selectedEnd/scale)*100,startPct,100);
  const progressPct=clamp((progress/scale)*100,0,100);
  const round=value=>Math.round(Number(value)*100)/100;
  const bars=peaks||fallbackWaveform;
  useEffect(()=>{
    const media=player.current;
    if(!media||known)return;
    const load=()=>{
      const length=media.duration;
      if(!Number.isFinite(length)||length<.1)return;
      const safeStart=start>=length?0:start;
      onChange('audioDuration',round(length));
      if(safeStart!==start)onChange('audioStart',round(safeStart));
      if(!end||end>length)onChange('audioEnd',round(Math.min(length,limit)));
    };
    media.addEventListener('loadedmetadata',load);
    if(media.readyState>=1)load();
    return ()=>media.removeEventListener('loadedmetadata',load);
  },[src,known,start,end,limit]);
  useEffect(()=>{
    if(known&&selectedEnd-start>limit+.001)onChange('audioEnd',round(Math.min(duration,start+limit)));
  },[known,selectedEnd,start,limit,duration]);
  useEffect(()=>{
    setPeaks(null);
    if(!src||!active)return;
    const AudioContextClass=window.OfflineAudioContext||window.webkitOfflineAudioContext||window.AudioContext||window.webkitAudioContext;
    if(!AudioContextClass)return;
    let cancelled=false,context;
    try{context=new AudioContextClass(1,1,44100);}catch{return;}
    fetch(src).then(response=>response.arrayBuffer()).then(buffer=>context.decodeAudioData(buffer)).then(audio=>{
      if(cancelled)return;
      const channel=audio.getChannelData(0);
      const count=110,block=Math.max(1,Math.floor(channel.length/count));
      let max=0;const values=[];
      for(let index=0;index<count;index++){
        let peak=0;const from=index*block,to=Math.min(channel.length,from+block);
        for(let sample=from;sample<to;sample++)peak=Math.max(peak,Math.abs(channel[sample]));
        values.push(peak);if(peak>max)max=peak;
      }
      setPeaks(values.map(value=>Math.max(.08,value/(max||1))));
    }).catch(()=>{}).finally(()=>{try{context.close?.();}catch{}});
    return ()=>{cancelled=true;};
  },[src,active]);
  const stopPlayback=()=>{const media=player.current;if(media)media.pause();setPlaying(false);};
  const changeStart=value=>{
    stopPlayback();
    const next=Math.max(0,Math.min(maxStart,Number(value)));
    const keep=Math.max(.1,Math.min(fragment||limit,limit));
    onChange('audioStart',round(next));
    onChange('audioEnd',round(known?Math.min(duration,next+keep):next+keep));
  };
  const changeEnd=value=>{
    stopPlayback();
    const maxEnd=known?Math.min(duration,start+limit):start+limit;
    onChange('audioEnd',round(Math.max(start+.1,Math.min(maxEnd,Number(value)))));
  };
  const play=()=>{
    const media=player.current;if(!media)return;
    const from=Math.max(0,start);
    const to=selectedEnd>from?selectedEnd:known?duration:start+limit;
    media.currentTime=from;
    previewEnd.current=to;
    setProgress(from);
    media.play().catch(()=>{});
  };
  const toggle=()=>{const media=player.current;if(!media)return;if(playing)media.pause();else play();};
  const reset=()=>{stopPlayback();onChange('audioStart',0);onChange('audioEnd',round(known?Math.min(duration,limit):limit));};
  const moveHandle=(which,event)=>{
    if(!known||!track.current)return;
    event.currentTarget.focus?.();
    event.preventDefault();
    const rect=track.current.getBoundingClientRect();
    const move=pointer=>{
      const ratio=clamp((pointer.clientX-rect.left)/rect.width,0,1);
      const value=ratio*scale;
      if(which==='start')changeStart(value);else changeEnd(value);
    };
    move(event);
    const stop=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',stop);};
    window.addEventListener('pointermove',move);
    window.addEventListener('pointerup',stop);
  };
  const keyHandle=(which,event)=>{
    const step=event.shiftKey?1:.1;
    const current=which==='start'?start:selectedEnd;
    let next=null;
    if(event.key==='ArrowLeft'||event.key==='ArrowDown')next=current-step;
    else if(event.key==='ArrowRight'||event.key==='ArrowUp')next=current+step;
    else if(event.key==='Home')next=0;
    else if(event.key==='End')next=scale;
    if(next===null)return;
    event.preventDefault();
    if(which==='start')changeStart(next);else changeEnd(next);
  };
  return <div className="alert-audio-trimmer">
    <p className="help">{known?'Archivo: '+duration.toFixed(1)+' s · ':'Leyendo duración del audio… · '}Máximo: {limit} s.</p>
    <div className="alert-audio-wave" style={{'--wave-accent':accent}}>
      <div className="alert-audio-wave-side">
        <button type="button" className="alert-audio-wave-play" disabled={!known} onClick={toggle} aria-label={playing?'Pausar fragmento':'Reproducir fragmento'}>{playing?<Pause size={15}/>:<Play size={15}/>}</button>
        <span className="alert-audio-wave-time">{playing?progress.toFixed(2):fragment.toFixed(2)}s</span>
      </div>
      <div className="alert-audio-wave-canvas" ref={track}>
        <div className="alert-audio-wave-bars is-base" aria-hidden="true">{bars.map((peak,index)=><span key={index} style={{height:Math.round(peak*100)+'%'}}/>)}</div>
        <div className="alert-audio-wave-bars is-selected" aria-hidden="true" style={{clipPath:`inset(0 ${100-endPct}% 0 ${startPct}%)`}}>{bars.map((peak,index)=><span key={index} style={{height:Math.round(peak*100)+'%'}}/>)}</div>
        <span className="alert-audio-wave-selection" style={{left:startPct+'%',width:Math.max(0,endPct-startPct)+'%'}} aria-hidden="true"/>
        {playing&&<span className="alert-audio-wave-playhead" style={{left:progressPct+'%'}} aria-hidden="true"/>}
        <button type="button" className="alert-audio-wave-handle is-start" style={{left:startPct+'%'}} role="slider" aria-label="Inicio del audio" aria-valuemin="0" aria-valuemax={scale} aria-valuenow={round(start)} aria-valuetext={start.toFixed(1)+' segundos'} disabled={!known} onPointerDown={event=>moveHandle('start',event)} onKeyDown={event=>keyHandle('start',event)}><span/></button>
        <button type="button" className="alert-audio-wave-handle is-end" style={{left:endPct+'%'}} role="slider" aria-label="Fin del audio" aria-valuemin="0" aria-valuemax={scale} aria-valuenow={round(selectedEnd)} aria-valuetext={selectedEnd.toFixed(1)+' segundos'} disabled={!known} onPointerDown={event=>moveHandle('end',event)} onKeyDown={event=>keyHandle('end',event)}><span/></button>
      </div>
    </div>
    <div className="form-row">
      <Field label="Inicio del audio · segundos">{id=><Input id={id} type="number" min="0" max={maxStart} step="0.1" value={start} disabled={!known} onChange={e=>changeStart(e.target.value)}/>}</Field>
      <Field label="Fin del audio · segundos">{id=><Input id={id} type="number" min={start+.1} max={known?Math.min(duration,start+limit):start+limit} step="0.1" value={selectedEnd} disabled={!known} onChange={e=>changeEnd(e.target.value)}/>}</Field>
    </div>
    <div className="actions">
      <Button variant="ghost" size="sm" disabled={!known} onClick={reset}>Usar desde el inicio</Button>
    </div>
    <audio ref={player} src={src} preload="metadata" onTimeUpdate={()=>{const media=player.current;if(!media)return;setProgress(media.currentTime);if(previewEnd.current>0&&media.currentTime>=previewEnd.current){media.pause();setPlaying(false);}}} onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)} onEnded={()=>setPlaying(false)}/>
  </div>;
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
