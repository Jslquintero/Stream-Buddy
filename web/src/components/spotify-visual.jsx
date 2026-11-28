import { useEffect, useState } from 'react';
import { Music2 } from 'lucide-react';
import { appearanceDefaults } from '../../../shared/spotify';
import { spotifyLabels } from './spotify-labels';
import { spotifyPlayerTheme } from './spotify-style';

export const demoPlayback = { title:'Tu próxima canción', artist:'Vista previa del widget', duration:210000, progress:72000, playing:true, image:'https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=512&h=512&q=80' };
export function SpotifyVisual({ playback, config = {}, theme }) {
  const c = { ...appearanceDefaults, theme:'dark', ...config, ...(theme ? {theme} : {}) };
  const [now,setNow] = useState(Date.now()), [color,setColor] = useState(null), [failedVideo,setFailedVideo] = useState('');
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()),1000); return () => clearInterval(timer); },[]);
  useEffect(() => {
    setColor(null); if (!c.magicColors || !playback?.image) return;
    let active = true; const image = new Image(); image.crossOrigin = 'anonymous';
    image.onload = () => { try { const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1; const ctx = canvas.getContext('2d'); ctx.drawImage(image,0,0,1,1); const [r,g,b] = ctx.getImageData(0,0,1,1).data; if (active) setColor(`rgb(${r}, ${g}, ${b})`); } catch {} }; image.src = playback.image;
    return () => { active = false; };
  },[c.magicColors,playback?.image]);
  if (!playback) return null;
  const localTitle = ['aimp', 'windows'].includes(playback.source);
  const title = localTitle
    ? <span className="music-title">{playback.title}</span>
    : <a className="music-title" href={playback.url || 'https://open.spotify.com'} target="_blank" rel="noopener noreferrer">{playback.title}</a>;
  const progress = Math.min(playback.duration, playback.progress + (playback.playing ? Math.max(0,now-playback.updatedAt) : 0));
  const time = value => `${Math.floor(value / 60000)}:${String(Math.floor(value / 1000) % 60).padStart(2,'0')}`;
  const artwork = c.coverStyle === 'canvas' && c.canvasUrl && failedVideo !== c.canvasUrl ? <video key={c.canvasUrl} className="music-cover" src={c.canvasUrl} poster={playback.image || undefined} autoPlay muted loop playsInline onError={() => setFailedVideo(c.canvasUrl)}/> : playback.image ? <img className="music-cover" src={playback.image} alt="Carátula del álbum"/> : <div className="music-cover music-placeholder"><Music2 size={38}/></div>;
  const cdPlayer = c.playerStyle === 'cd-retro';
  const playerTheme = spotifyPlayerTheme(c.theme, c.playerStyle);
  if(['shell','amber'].includes(c.playerStyle)) {
    const filled = Math.min(32,Math.max(0,Math.round(playback.duration ? progress / playback.duration * 32 : 0)));
    return <article className={`music-now music-${playerTheme} player-shell music-terminal player-${c.playerStyle}`} style={{'--music-accent':color || c.tintColor}}>
      <header className="music-terminal-header"><span>root@streambuddy</span><span className="music-terminal-controls" aria-hidden="true">− ▫ <b>×</b></span></header>
      <div className="music-terminal-body"><div className="music-terminal-command"><span>root@streambuddy&gt;</span> ./music <span>--nowPlaying</span></div>
        <div className="music-terminal-line"><strong>Title:</strong> {title}</div>
        <div className="music-terminal-line"><strong>Artist:</strong> <span className="music-artist">{playback.artist}</span></div>
        <div className="music-progress music-terminal-progress" role="progressbar" aria-label="Progreso de la canción" aria-valuemin={0} aria-valuemax={playback.duration} aria-valuenow={progress}>[<span>{'#'.repeat(filled)}</span>{'-'.repeat(32-filled)}]</div>
        <div className="music-time">{time(progress)} - {time(playback.duration)}</div>
      </div>
    </article>;
  }
  return <article className={`music-now music-${playerTheme} player-${c.playerStyle} cover-${c.coverStyle}${c.coverGlow ? ' cover-glow' : ''}${playback.playing ? '' : ' is-paused'}${c.hideVisualizer ? ' hide-visualizer' : ''}`} style={{'--music-accent':color || c.tintColor}}>
    {c.coverBlur && playback.image && <img className="music-blur" src={playback.image} alt=""/>}
    {c.playerStyle === 'macos' && <div className="music-window-dots"><i/><i/><i/><span>Ahora escuchando</span></div>}
    {cdPlayer && <div className="player-caption">CD Audio</div>}
    {['xp','wmp','winamp'].includes(c.playerStyle) && <div className="player-caption">{spotifyLabels[c.playerStyle]}</div>}
    {c.playerStyle === 'discord' && <div className="music-shell-header">MÚSICA</div>}
    {c.coverStyle !== 'none' && <div className="music-art">{c.coverStyle === 'vinyl' ? <div className="music-vinyl-disc">{artwork}</div> : artwork}</div>}
    <div className="music-track">
      <span className="music-brand"><span>{playback.idle ? 'SIN REPRODUCCIÓN' : playback.playing ? 'ESCUCHANDO AHORA' : 'EN PAUSA'}</span><span className="music-equalizer" aria-hidden="true"><i/><i/><i/></span></span>
      <div className="music-info">
        {cdPlayer && <span className="music-cd-label">Pista</span>}{title}
        {cdPlayer && <span className="music-cd-label">Artista</span>}<p className="music-artist">{playback.artist}</p>
      </div>
      <div className="music-progress" role="progressbar" aria-label="Progreso de la canción" aria-valuemin={0} aria-valuemax={playback.duration} aria-valuenow={progress}><span style={{width:`${playback.duration ? progress / playback.duration * 100 : 0}%`}}/></div>
      <div className="music-time"><span>{time(progress)}</span>{c.playerStyle === 'compact' && <span className="music-waveform" aria-hidden="true">{Array.from({length:25},(_,i)=><i key={i} style={{height:`${30 + ((i * 17 + 11) % 65)}%`,animationDelay:`${-i * .13}s`}}/>)}</span>}<span>{time(playback.duration)}</span></div>
    </div>
  </article>;
}
export function SpotifyPresence({ playback, config }) {
  const [shown,setShown] = useState(playback);
  useEffect(() => { if (playback) { setShown(playback); return; } const timer = setTimeout(() => setShown(null),500); return () => clearTimeout(timer); },[playback]);
  const visible = playback || shown;
  if (!visible) return null;
  return <div className={`music-motion ${playback ? 'enter' : 'exit'} motion-${(playback ? config.revealAnimation : config.exitAnimation) || 'original'}`}><SpotifyVisual playback={visible} config={config}/></div>;
}
