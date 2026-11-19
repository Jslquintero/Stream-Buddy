import { useEffect, useRef, useState } from 'react';
import { videoSite } from '../../../modules/notifications/video-sites';
import { Button } from './ui';
const scripts=new Map();
function sdk(provider){
  if(provider==='youtube'&&window.YT?.Player)return Promise.resolve(window.YT);
  if(provider==='vimeo'&&window.Vimeo?.Player)return Promise.resolve(window.Vimeo);
  if(scripts.has(provider))return scripts.get(provider);
  const promise=new Promise((resolve,reject)=>{
    const script=document.createElement('script');let poll;
    const timeout=setTimeout(()=>finish(new Error('No se pudo cargar el reproductor del sitio.')),15000);
    const finish=error=>{clearTimeout(timeout);clearInterval(poll);if(error){script.remove();scripts.delete(provider);reject(error);}else resolve(provider==='youtube'?window.YT:window.Vimeo);};
    script.src=provider==='youtube'?'https://www.youtube.com/iframe_api':'https://player.vimeo.com/api/player.js';
    if(provider==='youtube'&&!window.onYouTubeIframeAPIReady)window.onYouTubeIframeAPIReady=()=>{};
    script.onerror=()=>finish(new Error('No se pudo conectar con el reproductor del sitio.'));
    poll=setInterval(()=>{if(provider==='youtube'?window.YT?.Player:window.Vimeo?.Player)finish();},50);
    document.head.append(script);
  });scripts.set(provider,promise);return promise;
}
export function WebsiteVideo({src,start=0,end=6,muted=true,volume=80,autoPlay=false,expiresAt,duration,style}){
  const host=useRef(null),activePlayer=useRef(null),[error,setError]=useState(''),[playing,setPlaying]=useState(false);
  useEffect(()=>{
    const site=videoSite(src);if(!site)return;
    let disposed=false,player,timer;
    setError('');setPlaying(false);
    const fail=()=>{if(!disposed){setPlaying(false);setError('Este video no se puede reproducir aquí. Revisa si permite reproducción en otros sitios.');}};
    const offset=()=>Math.min(end,start+(autoPlay&&expiresAt?Math.max(0,(Date.now()-(expiresAt-duration*1000))/1000):0));
    sdk(site.provider).then(API=>{
      if(disposed)return;
      const target=document.createElement('div');host.current.replaceChildren(target);
      if(site.provider==='youtube'){
        player=new API.Player(target,{width:'100%',height:'100%',videoId:site.id,playerVars:{playsinline:1,controls:autoPlay?0:1,fs:autoPlay?0:1,disablekb:autoPlay?1:0,iv_load_policy:3,rel:0,origin:window.location.origin,start:Math.floor(start),end:Math.ceil(end)},events:{
          onReady:e=>{if(disposed)return;const p=e.target;p.setVolume(volume);muted?p.mute():p.unMute();const clip={videoId:site.id,startSeconds:offset(),endSeconds:end};if(autoPlay&&clip.startSeconds<end)p.loadVideoById(clip);else p.cueVideoById(clip);timer=setInterval(()=>{if(p.getCurrentTime()>=end){setPlaying(false);p.pauseVideo();}},100);},
          onStateChange:e=>{if(disposed)return;setPlaying(e.data===1);if(e.data===1&&e.target.getCurrentTime()<start)e.target.seekTo(start,true);},onError:fail,
          onAutoplayBlocked:()=>{if(!disposed)setError('El navegador bloqueó el inicio automático. Prueba el video en el editor o usa un archivo local.');},
        }});
      }else{
        player=new API.Player(target,{url:site.url,muted,autoplay:false,playsinline:true,controls:!autoPlay,title:!autoPlay,byline:!autoPlay,portrait:!autoPlay});
        player.on('error',fail);
        player.on('playing',()=>{if(!disposed)setPlaying(true);});
        player.on('pause',()=>{if(!disposed)setPlaying(false);});
        player.on('ended',()=>{if(!disposed)setPlaying(false);});
        player.on('timeupdate',data=>{if(data.seconds>=end){setPlaying(false);player.pause().catch(()=>{});}else if(data.seconds<start)player.setCurrentTime(start).catch(()=>{});});
        player.ready().then(async()=>{if(disposed)return;await player.setVolume(muted?0:volume/100);await player.setCurrentTime(offset());if(!disposed&&autoPlay&&offset()<end)await player.play();}).catch(fail);
      }
      activePlayer.current=player;
    }).catch(fail);
    return ()=>{disposed=true;activePlayer.current=null;clearInterval(timer);if(player){try{player.destroy()?.catch?.(()=>{});}catch{}}};
  },[src,start,end,muted,volume,autoPlay,expiresAt,duration]);
  const replay=()=>{const p=activePlayer.current;if(!p)return;if(videoSite(src).provider==='youtube')p.loadVideoById({videoId:videoSite(src).id,startSeconds:start,endSeconds:end});else p.setCurrentTime(start).then(()=>p.play()).catch(()=>setError('Pulsa reproducir en el video para iniciar.'));};
  return <div className={'alert-website-video'+(autoPlay?' clean-output':'')} style={{...style,width:style?.width?Math.max(200,parseFloat(style.width)):undefined,height:undefined,minWidth:200}}><div ref={host} className="alert-website-player" style={{visibility:autoPlay&&!playing?'hidden':undefined}}/>{!autoPlay&&<Button variant="outline" size="sm" onClick={replay}>Ver fragmento</Button>}{error&&!autoPlay&&<p className="error" role="alert">{error} <a href={src} target="_blank" rel="noopener noreferrer">Abrir video</a></p>}</div>;
}
