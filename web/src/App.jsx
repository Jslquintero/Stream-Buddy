import { CopyLinkButton } from './components/output-controls';
import { useEffect, useRef, useState } from 'react';
import { Activity, AudioLines, Bell, ChevronRight, CircleHelp, Clapperboard, Copy, ExternalLink, Gavel, Gift, Heart, LayoutDashboard, Menu, Monitor, Music2, RefreshCw, Share2, ShieldCheck, Sparkles, X } from 'lucide-react';
import { Badge, Button, Card } from './components/ui';
import { useRoute } from './hooks/use-route';
import { TikTokConnection } from './components/tiktok-connection';
import { useStudio } from './hooks/use-studio';
import { VoiceStudio } from './components/voice-studio';
import { LayoutStudio } from './components/layout-studio';
import { NotificationsStudio } from './components/notifications-studio';
import { CommandsStudio } from './components/commands-studio';
import { LikesStudio } from './components/likes-studio';
import { GiftersStudio } from './components/gifters-studio';
import { AuctionStudio } from './components/auction-studio';
import { SocialStudio } from './components/social-studio';
import { SpotifyStudio } from './components/spotify-studio';
import { Home, adQueueOutputURL } from './components/home';

const widgets = [
  { id: 'layout', title: 'Escenas', description: 'Escenas y composiciones del directo.', icon: Monitor, color: 'violet', action: 'Abrir editor' },
  { id: 'ads', title: 'AdQueue', description: 'Cola de videos para anuncios.', icon: Clapperboard, color: 'orange', action: 'Gestionar anuncios' },
  { id: 'notifications', title: 'Notificaciones', description: 'Alertas de seguidores, regalos y más.', icon: Bell, color: 'mint', action: 'Configurar alertas' },
  { id: 'likes', title: 'Top likes', description: 'Clasificación de likes en directo.', icon: Heart, color: 'orange', action: 'Configurar Top likes' },
  { id: 'gifters', title: 'Top gifters', description: 'Clasificación de regalos en directo.', icon: Gift, color: 'mint', action: 'Configurar Top gifters' },
  { id: 'auction', title: 'Subasta', description: 'Host live auctions where viewers bid with gifts to reach the top.', icon: Gavel, color: 'orange', action: 'Configurar subasta' },
  { id: 'social', title: 'Social Media Rotator', description: 'Highlight your social channels with eye-catching pop-up rotations.', icon: Share2, color: 'violet', action: 'Configurar redes' },
  { id: 'commands', title: 'Comandos de chat', description: 'GIF, sonidos y lista de comandos.', icon: Sparkles, color: 'violet', action: 'Configurar comandos' },
  { id: 'spotify', title: 'Música', description: 'Canción actual, artista y carátula.', icon: Music2, color: 'mint', action: 'Configurar música' },
];
const navigationGroups = [
  { id: 'general', title: 'General', items: [
    { id: 'home', title: 'Vista general', icon: LayoutDashboard },
    { id: 'tts', title: 'Voz y chat', icon: AudioLines },
  ] },
  { id: 'widgets', title: 'Widgets', items: widgets },
];
const navigationItems = navigationGroups.flatMap(group => group.items);
export default function App(){
 const {state,notice,setNotice,online,api}=useStudio();const [view,setView]=useRoute(),[menu,setMenu]=useState(false); const discovered=useRef(false);
 useEffect(()=>{if(view==='tts'&&state&&!discovered.current&&!state.tts.resources?.task?.running){discovered.current=true;void api('tts/refresh');}},[view,state,api]);
 useEffect(() => {
   if (state && view?.startsWith('layout:') && !state.tools.layout.compositions?.some(item => item.id === view.slice(7))) {
     setView('layout', { replace: true });
   }
 }, [view, state, setView]);
 const compositions=state?.tools.layout.compositions ?? [];
 const currentTitle=navigationItems.find(item=>item.id===view)?.title
   ?? compositions.find(composition=>'layout:'+composition.id===view)?.name;
 const go=id=>{setView(id);setMenu(false);}; const open=async id=>{go(id);if(id!=='tts')await api('start',{tool:id});};
 const t=state?.tts;
 return <div className="app-shell"><aside className={menu?'sidebar mobile-open':'sidebar'}><a className="brand" href="/" onClick={e=>{if(!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&!e.altKey){e.preventDefault();go('home');}}} aria-label="Live Studio inicio"><span className="brand-mark"><AudioLines/></span><span>live<span className="brand-light">studio</span><small>CREATOR WORKSPACE</small></span></a><div className="workspace"><span className="avatar">LS</span><span>Mi espacio de trabajo<small>Personal · Local</small></span><Badge>LOCAL</Badge></div><SidebarNavigation view={view} go={go}/><div className="sidebar-bottom"><div className="local-card"><span className="online-dot"/><strong>Todo en tu equipo</strong><p>Tu espacio de producción local, siempre a mano.</p><ShieldCheck size={18}/></div><span className="sidebar-foot"><CircleHelp size={16}/> Live Studio Center <small>v0.3</small></span></div></aside>{menu&&<button className="sidebar-scrim" aria-label="Cerrar menú" onClick={()=>setMenu(false)}/>}
 <div className="main-shell"><header className="topbar"><div className="breadcrumb"><Button variant="ghost" size="icon" className="mobile-menu" aria-label="Abrir menú" onClick={()=>setMenu(true)}><Menu/></Button><span>Espacio de trabajo</span><ChevronRight size={14}/><strong>{currentTitle}</strong></div><TikTokConnection state={state} online={online} api={api}/></header>
 <main>{view !== 'home' && view !== 'notifications' && view !== 'likes' && view !== 'gifters' && view !== 'auction' && view !== 'commands' && view !== 'social' && <div className="page-heading"><div><p className="eyebrow">TU ESPACIO. TU DIRECTO.</p><h1>{view==='tts'?'La voz de tu comunidad.':view==='spotify'?'La música de tu directo.':(view==='layout'||view?.startsWith('layout:'))?'Tu próxima gran escena.':'Tus anuncios, en orden.'}</h1><p className="muted">{view==='tts'?'Haz que cada mensaje forme parte del directo.': 'Prepara y controla tu herramienta desde tu espacio de trabajo.'}</p></div></div>}
 {notice&&<div className="notice" role="status"><Activity size={16}/><span>{notice}</span><Button variant="ghost" size="icon" aria-label="Cerrar aviso" onClick={()=>setNotice('')}><X size={16}/></Button></div>}
 {view==='home'&&<Home widgets={widgets} state={state} online={online} open={open}/>}
 <div hidden={view!=='tts'}>{state?<VoiceStudio state={state} api={api} notice={setNotice}/>:<Card className="loading" role="status">Conectando con tu estudio…</Card>}</div>
 <div hidden={view!=='layout'}>{state&&<LayoutStudio tool={state.tools.layout} api={api} notice={setNotice} open={go}/>}</div>
 {state?.tools.layout.compositions?.map(composition=><div key={composition.id} hidden={view!=='layout:'+composition.id}><CompositionEditor active={view==='layout:'+composition.id} tool={state.tools.layout} compositionId={composition.id} api={api} notice={setNotice} open={go}/></div>)}
 {view==='ads'&&<ToolView id="ads" tool={state?.tools.ads} api={api} notice={setNotice}/>}
 <div hidden={view!=='notifications'}>{state?.tools.notifications?<NotificationsStudio tool={state.tools.notifications} api={api} notice={setNotice} connected={online&&t?.connected} online={online}/>:view==='notifications'&&<Card className="loading">{state?'Reinicia Live Studio para cargar el módulo de notificaciones.':'Conectando con tu estudio…'}</Card>}</div>
 <div hidden={view!=='likes'}>{state?.tools.likes?<LikesStudio tool={state.tools.likes} api={api} notice={setNotice} online={online} connected={online&&t?.connected}/>:view==='likes'&&<Card>Reinicia Live Studio para cargar Top likes.</Card>}</div>
 <div hidden={view!=='gifters'}>{state?.tools.gifters?<GiftersStudio tool={state.tools.gifters} api={api} notice={setNotice} online={online} connected={online&&t?.connected}/>:view==='gifters'&&<Card>Reinicia Live Studio para cargar Top gifters.</Card>}</div>
 <div hidden={view!=='auction'}>{state?.tools.auction?<AuctionStudio tool={state.tools.auction} api={api} notice={setNotice} online={online} connected={online&&t?.connected}/>:view==='auction'&&<Card>Reinicia Live Studio para cargar Subasta.</Card>}</div>
 <div hidden={view!=='social'}>{state?.tools.social?<SocialStudio tool={state.tools.social} api={api} notice={setNotice} online={online}/>:view==='social'&&<Card>Reinicia Live Studio para cargar Social Media Rotator.</Card>}</div>
 <div hidden={view!=='commands'}>{state?.tools.commands&&<CommandsStudio tool={state.tools.commands} api={api} notice={setNotice} online={online} connected={online&&t?.connected}/>}</div>
 <div hidden={view!=='spotify'}>{state?.tools.spotify?<SpotifyStudio tool={state.tools.spotify} api={api} notice={setNotice} online={online}/>:view==='spotify'&&<Card>Reinicia Live Studio para cargar Spotify.</Card>}</div>
 <footer><span><span className="online-dot"/> Hecho para tu próximo directo.</span><span>LIVE STUDIO <span className="footer-separator">/</span> Tu producción, bajo control.</span></footer></main></div></div>;
}
function ToolView({id,tool,api,notice}){const url=tool?.url||(id==='layout'?'http://localhost:8787':'http://127.0.0.1:17843');return <Card className="tool-view"><div className="tool-toolbar"><strong>{id==='layout'?'Layout Studio':'AdQueue'}</strong><div className="actions"><Button variant="outline" size="sm" onClick={()=>api('start',{tool:id})} disabled={tool?.starting}><RefreshCw size={14}/>Iniciar / reconectar</Button><Button asChild variant="outline" size="sm"><a href={url} target="_blank" rel="noopener noreferrer">Abrir aparte<ExternalLink size={14}/></a></Button>{id==='ads'&&<CopyLinkButton url={adQueueOutputURL(url)} notice={notice} message="Enlace de salida copiado." size="sm"><Copy size={14}/>Copiar salida</CopyLinkButton>}</div></div>{tool?.running?<iframe src={url} title={id==='layout'?'Layout Studio':'AdQueue'} allow="autoplay; clipboard-write"/>:<div className="tool-empty"><Monitor size={38}/><h2>{tool?.starting?'Preparando tu herramienta…':'Tu herramienta está detenida'}</h2><p>{tool?.error||(!tool?.available?'No se encontraron los archivos de la herramienta. Revisa su instalación.':'Inicia la herramienta para abrir su espacio de trabajo.')}</p></div>}</Card>;}

function CompositionEditor({active,...props}) {
 const [visited,setVisited]=useState(active);
 useEffect(()=>{if(active)setVisited(true);},[active]);
 return visited||active?<LayoutStudio {...props}/>:null;
}

function SidebarNavigation({ view, go }) {
  return <nav aria-label="Menú principal">
    {navigationGroups.map(group => <section className="nav-category" key={group.id} aria-labelledby={`nav-${group.id}`}>
      <h2 className="nav-label" id={`nav-${group.id}`}>{group.title}</h2>
      {group.items.map(({ id, title, icon: Icon }) => {
        const active = view === id;
        const inLayout = id === 'layout' && view?.startsWith('layout:');
        return <button key={id} type="button" aria-current={active ? 'page' : inLayout ? 'location' : undefined}
          className={active || inLayout ? 'nav-item active' : 'nav-item'} onClick={() => go(id)}>
          <Icon size={19} aria-hidden="true"/>{title}{(active || inLayout) && <span className="nav-indicator"/>}
        </button>;
      })}
    </section>)}
  </nav>;
}
