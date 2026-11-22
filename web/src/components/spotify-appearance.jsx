import { ToggleRow } from './fields';
import { FilePicker } from './ui/file-picker';
import { Select, Input, Button } from './ui';
import { useEffect, useState } from 'react';
import { Music2 } from 'lucide-react';
import { appearanceDefaults, playerStyles, coverFinishes, coverStyles, animationStyles } from '../../../shared/spotify';
import { SpotifyCssEditor } from './spotify-css-editor';

const labels = { ...coverFinishes, compact:'Compact', boxy:'Boxy', gallery:'Gallery', minimal:'Minimal', macos:'macOS', shell:'Shell', discord:'Discord', square:'Cuadrada', canvas:'Canvas', vinyl:'Vinilo', none:'Sin carátula', original:'Original', fade:'Fundido', 'slide-left':'Deslizar ←', 'slide-right':'Deslizar →', 'slide-top':'Deslizar ↑', 'slide-bottom':'Deslizar ↓', grow:'Crecer', shrink:'Encoger', 'swing-left':'Giro ←', 'swing-right':'Giro →', 'tilt-left':'Inclinar ←', 'tilt-right':'Inclinar →' };
function Choices({ title, field, values, config, change, miniature = false }) {
  return <fieldset className="spotify-choices"><legend>{title}</legend><div>{values.map(value => <button type="button" key={value} aria-pressed={config[field] === value} onClick={() => change(field, value)}>{field === 'coverStyle' && coverFinishes[value] ? <span className={'cover-sample cover-' + value} aria-hidden="true"><span className="spotify-art"><i className="spotify-cover"/></span></span> : miniature && <span className={'spotify-mini mini-' + value}><i/><b/><em/></span>}<span>{labels[value]}</span></button>)}</div></fieldset>;
}
export function SpotifyAppearance({ draft, setDraft, notice }) {
  const c = { ...appearanceDefaults, ...draft }, change = (key, value) => setDraft(d => ({ ...d, [key]:value }));
  async function upload(file) {
    if (!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size > 500000) { notice('Elige un PNG, JPG o WebP de hasta 500 KB.'); return; }
    try { const result = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); }); change('idleCover', result); } catch { notice('No se pudo leer la imagen.'); }
  }
  return <div className="spotify-customization">
    <Choices title="Apariencia del reproductor" field="playerStyle" values={playerStyles} config={c} change={change} miniature/>
    <Choices title="Apariencia de la carátula" field="coverStyle" values={coverStyles} config={c} change={change} miniature/>
    {c.coverStyle === 'canvas' && <label>Video personalizado (URL MP4 o WebM)<Input type="url" value={c.canvasUrl} onChange={e => change('canvasUrl', e.target.value)}/><small className="help">Video en bucle para todas las canciones. No descarga Canvas de Spotify. Si falla, se muestra la carátula.</small></label>}
    <hr/><h3>Carátula</h3>
    {[['coverGlow','Brillo alrededor de la carátula'],['coverBlur','Carátula desenfocada como fondo']].map(([key,label]) => <ToggleRow key={key} label={label} checked={c[key]} onCheckedChange={value => change(key,value)}/>)}
    <div><FilePicker label="Imagen cuando no hay música" accept="image/png,image/jpeg,image/webp" onFile={upload}/><p className="help">PNG, JPG o WebP · máximo 500 KB. Se muestra al estar conectado sin una canción; ocultar al pausar tiene prioridad.</p></div>
    {c.idleCover && <div className="spotify-idle-upload"><img src={c.idleCover} alt="Carátula en reposo"/><Button variant="ghost" size="sm" onClick={() => change('idleCover','')}>Quitar imagen</Button></div>}
    <hr/><h3>Colores</h3><ToggleRow label="Colores de la carátula" checked={c.magicColors} onCheckedChange={value => change('magicColors',value)}/>
    <label>Tema<Select value={c.theme} onChange={e => change('theme',e.target.value)}><optgroup label="Básicos"><option value="dark">Oscuro</option><option value="light">Claro</option><option value="tinted">Color sólido</option><option value="gradient">Degradado de color</option><option value="transparent">Transparente</option></optgroup><optgroup label="Windows"><option value="xp">Luna XP</option><option value="wmp">Windows Media Player</option></optgroup><optgroup label="Colección nueva"><option value="winamp">Winamp clásico</option><option value="ipod">iPod</option><option value="vaporwave">Vaporwave</option><option value="neon">Neón nocturno</option><option value="radio">Radio FM</option><option value="cassette">Cassette</option><option value="marquee">Marquesina</option><option value="amber">Terminal ámbar</option><option value="glass">Vidrio</option><option value="editorial">Editorial</option></optgroup></Select></label>
    <label>Color del tema y acento<Input type="color" value={c.tintColor} onChange={e => change('tintColor',e.target.value)}/></label><div className="spotify-swatches">{['#267493','#21857e','#777b25','#a4832b','#b56829','#aa4830','#a93645','#a25476','#7944a1'].map(color => <button type="button" key={color} aria-label={'Color '+color} aria-pressed={c.tintColor === color} style={{background:color}} onClick={() => change('tintColor',color)}/>)}</div>
    <small className="help">Color sólido y Degradado tiñen el fondo con el color elegido. Activa Colores de la carátula para adaptarlo a cada canción.</small>
    <small className="help">El color de acento también se usa si no se pueden leer los colores de la imagen.</small>
    <hr/><Choices title="Animación de entrada" field="revealAnimation" values={animationStyles} config={c} change={change}/><Choices title="Animación de salida" field="exitAnimation" values={animationStyles} config={c} change={change}/>
    <SpotifyCssEditor draft={draft} setDraft={setDraft}/>
  </div>;
}
export const demoPlayback = { title:'Tu próxima canción', artist:'Vista previa del widget', duration:210000, progress:72000, updatedAt:Date.now(), playing:true, image:'https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=512&h=512&q=80' };
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
  const fromAimp = playback.source === 'aimp';
  const player = fromAimp ? 'AIMP' : 'Spotify';
  const title = fromAimp
    ? <span className="spotify-title">{playback.title}</span>
    : <a className="spotify-title" href={playback.url || 'https://open.spotify.com'} target="_blank" rel="noopener noreferrer">{playback.title}</a>;
  const progress = Math.min(playback.duration, playback.progress + (playback.playing ? Math.max(0,now-playback.updatedAt) : 0));
  const time = value => `${Math.floor(value / 60000)}:${String(Math.floor(value / 1000) % 60).padStart(2,'0')}`;
  const artwork = c.coverStyle === 'canvas' && c.canvasUrl && failedVideo !== c.canvasUrl ? <video key={c.canvasUrl} className="spotify-cover" src={c.canvasUrl} poster={playback.image || undefined} autoPlay muted loop playsInline onError={() => setFailedVideo(c.canvasUrl)}/> : playback.image ? <img className="spotify-cover" src={playback.image} alt="Carátula del álbum"/> : <div className="spotify-cover spotify-placeholder"><Music2 size={38}/></div>;
  const playerTheme = coverFinishes[c.playerStyle] && c.theme === 'dark' ? c.playerStyle : c.theme;
  if(['shell','amber'].includes(c.playerStyle)) {
    const filled = Math.min(32,Math.max(0,Math.round(playback.duration ? progress / playback.duration * 32 : 0)));
    return <article className={`spotify-now spotify-${playerTheme} player-shell spotify-terminal player-${c.playerStyle}`} style={{'--spotify-accent':color || c.tintColor}}>
      <header className="spotify-terminal-header"><span>root@livestudio</span><span className="spotify-terminal-controls" aria-hidden="true">− ▫ <b>×</b></span></header>
      <div className="spotify-terminal-body"><div className="spotify-terminal-command"><span>root@livestudio&gt;</span> ./{player.toLowerCase()} <span>--nowPlaying</span></div>
        <div className="spotify-terminal-line"><strong>Title:</strong> {title}</div>
        <div className="spotify-terminal-line"><strong>Artist:</strong> <span className="spotify-artist">{playback.artist}</span></div>
        <div className="spotify-progress spotify-terminal-progress" role="progressbar" aria-label="Progreso de la canción" aria-valuemin={0} aria-valuemax={playback.duration} aria-valuenow={progress}>[<span>{'#'.repeat(filled)}</span>{'-'.repeat(32-filled)}]</div>
        <div className="spotify-time">{time(progress)} - {time(playback.duration)}</div>
      </div>
    </article>;
  }
  return <article className={`spotify-now spotify-${playerTheme} player-${c.playerStyle} cover-${c.coverStyle}${c.coverGlow ? ' cover-glow' : ''}${playback.playing ? '' : ' is-paused'}${c.hideVisualizer ? ' hide-visualizer' : ''}`} style={{'--spotify-accent':color || c.tintColor}}>
    {c.coverBlur && playback.image && <img className="spotify-blur" src={playback.image} alt=""/>}
    {c.playerStyle === 'macos' && <div className="spotify-window-dots"><i/><i/><i/><span>Ahora escuchando</span></div>}
    {['xp','wmp','winamp'].includes(c.playerStyle) && <div className="player-caption">{labels[c.playerStyle]}</div>}
    {c.playerStyle === 'discord' && <div className="spotify-shell-header">ESCUCHANDO {player.toUpperCase()}</div>}
    {c.coverStyle !== 'none' && <div className="spotify-art">{c.coverStyle === 'vinyl' ? <div className="spotify-vinyl-disc">{artwork}</div> : artwork}</div>}
    <div className="spotify-track"><span className="spotify-brand">{player} <span>{playback.idle ? 'SIN REPRODUCCIÓN' : playback.playing ? 'ESCUCHANDO AHORA' : 'EN PAUSA'}</span><span className="spotify-equalizer" aria-hidden="true"><i/><i/><i/></span></span><div className="spotify-info">{title}<p className="spotify-artist">{playback.artist}</p></div><div className="spotify-progress" role="progressbar" aria-label="Progreso de la canción" aria-valuemin={0} aria-valuemax={playback.duration} aria-valuenow={progress}><span style={{width:`${playback.duration ? progress / playback.duration * 100 : 0}%`}}/></div><div className="spotify-time"><span>{time(progress)}</span>{c.playerStyle === 'compact' && <span className="spotify-waveform" aria-hidden="true">{Array.from({length:25},(_,i)=><i key={i} style={{height:`${30 + ((i * 17 + 11) % 65)}%`,animationDelay:`${-i * .13}s`}}/>)}</span>}<span>{time(playback.duration)}</span></div></div>
  </article>;
}
export function SpotifyPresence({ playback, config }) {
  const [shown,setShown] = useState(playback);
  useEffect(() => { if (playback) { setShown(playback); return; } const timer = setTimeout(() => setShown(null),500); return () => clearTimeout(timer); },[playback]);
  const visible = playback || shown;
  if (!visible) return null;
  return <div className={`spotify-motion ${playback ? 'enter' : 'exit'} motion-${(playback ? config.revealAnimation : config.exitAnimation) || 'original'}`}><SpotifyVisual playback={visible} config={config}/></div>;
}
