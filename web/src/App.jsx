import { CopyLinkButton } from './components/output-controls';
import { useEffect, useRef, useState } from 'react';
import { AudioLines, Bell, ChevronDown, ChevronRight, CircleHelp, Clapperboard, Copy, ExternalLink, GalleryHorizontal, Gavel, Gift, Heart, LayoutDashboard, Megaphone, Menu, Monitor, Music2, RefreshCw, Share2, ShieldCheck, Sparkles, Trophy } from 'lucide-react';
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
import { BannersStudio } from './components/banners-studio';
import { SpotifyStudio } from './components/spotify-studio';
import { Home, adQueueOutputURL } from './components/home';
import { ToastRegion } from './components/toast';
import { ProfilePicker } from './components/profile-picker';
import { StudioProfileContext } from './hooks/use-studio-profile';

const widgets = [
  { id: 'layout', title: 'Escenas', description: 'Escenas y composiciones del directo.', icon: Monitor, color: 'violet', action: 'Abrir editor' },
  { id: 'ads', title: 'AdQueue', description: 'Cola de videos para anuncios.', icon: Clapperboard, color: 'orange', action: 'Gestionar anuncios' },
  { id: 'banners', title: 'Ad Banner Rotator', description: 'Espacio publicitario con imágenes y SVG animados.', icon: GalleryHorizontal, color: 'violet', action: 'Configurar banners' },
  { id: 'notifications', title: 'Notificaciones', description: 'Alertas de seguidores, regalos y más.', icon: Bell, color: 'mint', action: 'Configurar alertas' },
  { id: 'likes', title: 'Top likes', description: 'Clasificación de likes en directo.', icon: Heart, color: 'orange', action: 'Configurar Top likes' },
  { id: 'gifters', title: 'Top gifters', description: 'Clasificación de regalos en directo.', icon: Gift, color: 'mint', action: 'Configurar Top gifters' },
  { id: 'auction', title: 'Subasta', description: 'Host live auctions where viewers bid with gifts to reach the top.', icon: Gavel, color: 'orange', action: 'Configurar subasta' },
  { id: 'social', title: 'Social Media Rotator', description: 'Highlight your social channels with eye-catching pop-up rotations.', icon: Share2, color: 'violet', action: 'Configurar redes' },
  { id: 'commands', title: 'Comandos de chat', description: 'GIF, sonidos y lista de comandos.', icon: Sparkles, color: 'violet', action: 'Configurar comandos' },
  { id: 'spotify', title: 'Música', description: 'Canción actual, artista y carátula.', icon: Music2, color: 'mint', action: 'Configurar música' },
];
const adWidgets = widgets.filter(({ id }) => id === 'ads' || id === 'banners');
const rankingWidgets = widgets.filter(({ id }) => id === 'likes' || id === 'gifters');
const widgetItems = widgets.filter(({ id }) => id !== 'ads' && id !== 'banners' && id !== 'likes' && id !== 'gifters');
widgetItems.splice(widgetItems.findIndex(({ id }) => id === 'auction'), 0, {
  id: 'rankings', title: 'Rankings', icon: Trophy, items: rankingWidgets,
});
widgetItems.splice(widgetItems.findIndex(({ id }) => id === 'notifications'), 0, {
  id: 'publicidad', title: 'Publicidad', icon: Megaphone, items: adWidgets,
});
const navigationGroups = [
  { id: 'general', title: 'General', items: [
    { id: 'home', title: 'Vista general', icon: LayoutDashboard },
    { id: 'tts', title: 'Voz y chat', icon: AudioLines },
  ] },
  { id: 'widgets', title: 'Widgets', items: widgetItems },
];
const navigationItems = navigationGroups.flatMap(group => group.items.flatMap(item => item.items ?? [item]));
export default function App(){
 const {state,notice,toasts,dismissToast,online,api}=useStudio();const [view,setView]=useRoute(),[menu,setMenu]=useState(false); const discovered=useRef(null);
 const appShell = useRef(null);
 const profileId = state?.profiles?.activeId ?? 'default';
 const connection = state?.token ?? profileId;
 useEffect(()=>{if(view==='tts'&&state&&discovered.current!==connection&&!state.tts.resources?.task?.running){discovered.current=connection;void api('tts/refresh');}},[view,state,api,connection]);
 useEffect(() => {
   if (state && view?.startsWith('layout:') && !state.tools.layout.compositions?.some(item => item.id === view.slice(7))) {
     setView('layout', { replace: true });
   }
 }, [view, state, setView]);
 const compositions=state?.tools.layout.compositions ?? [];
 const currentTitle=navigationItems.find(item=>item.id===view)?.title
   ?? compositions.find(composition=>'layout:'+composition.id===view)?.name;
 useEffect(()=>{document.title=currentTitle?currentTitle+' · Stream Buddy':'Stream Buddy';},[currentTitle]);
 useEffect(()=>{document.documentElement.scrollTop=0;document.body.scrollTop=0;},[view]);
 const go=id=>{setView(id);setMenu(false);}; const open=async id=>{go(id);if(id!=='tts')await api('start',{tool:id});};
 const t=state?.tts;
 return <div className="app-shell" ref={appShell}><aside className={menu?'sidebar mobile-open':'sidebar'}><a className="brand" href="/" onClick={e=>{if(!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&!e.altKey){e.preventDefault();go('home');}}} aria-label="Stream Buddy inicio"><span className="brand-mark"><AudioLines/></span><span>stream<span className="brand-light"> buddy</span><small>CENTRO DE DIRECTO</small></span></a>
 {state?.profiles ? <ProfilePicker key={profileId} profiles={state.profiles} online={online} connected={Boolean(t?.connected || t?.connecting)} api={api} notice={notice} dialogRoot={appShell}/>
   : <div className="workspace"><span className="avatar">SB</span><span>Mi espacio de trabajo<small>Personal · Local</small></span><Badge>LOCAL</Badge></div>}
 <SidebarNavigation view={view} go={go}/><div className="sidebar-bottom"><div className="local-card"><span className="online-dot"/><strong>Todo en tu equipo</strong><p>Tu espacio de producción local, siempre a mano.</p><ShieldCheck size={18}/></div><span className="sidebar-foot"><CircleHelp size={16}/> Stream Buddy <small>v0.3</small></span></div></aside>{menu&&<button className="sidebar-scrim" aria-label="Cerrar menú" onClick={()=>setMenu(false)}/>}
 <div className="main-shell"><header className="topbar"><div className="breadcrumb"><Button variant="ghost" size="icon" className="mobile-menu" aria-label="Abrir menú" onClick={()=>setMenu(true)}><Menu/></Button><span>Espacio de trabajo</span><ChevronRight size={14}/><strong>{currentTitle}</strong></div><TikTokConnection key={profileId} state={state} online={online} api={api}/></header>
 <StudioProfileContext.Provider key={profileId} value={profileId}>
 <main>{view !== 'home' && view !== 'spotify' && view !== 'notifications' && view !== 'likes' && view !== 'gifters' && view !== 'auction' && view !== 'commands' && view !== 'social' && view !== 'banners' && view !== 'layout' && !view?.startsWith('layout:') && <div className="page-heading"><div><p className="eyebrow">Tu espacio. Tu directo.</p><h1>{view==='tts'?'La voz de tu comunidad.':'Tus anuncios, en orden.'}</h1><p className="muted">{view==='tts'?'Haz que cada mensaje forme parte del directo.': 'Prepara y controla tu herramienta desde tu espacio de trabajo.'}</p></div></div>}
 {view==='home'&&<Home widgets={widgets} state={state} online={online} open={open} notice={notice}/>}
 <div hidden={view!=='tts'}>{state?<VoiceStudio state={state} api={api} notice={notice}/>:<Card className="loading" role="status">Conectando con tu estudio…</Card>}</div>
 <div hidden={view!=='layout'}>{state&&<LayoutStudio tool={state.tools.layout} api={api} notice={notice} open={go}/>}</div>
 {state?.tools.layout.compositions?.map(composition=><div key={composition.id} hidden={view!=='layout:'+composition.id}><CompositionEditor active={view==='layout:'+composition.id} tool={state.tools.layout} compositionId={composition.id} api={api} notice={notice} open={go}/></div>)}
 {view==='ads'&&<ToolView id="ads" tool={state?.tools.ads} api={api} notice={notice}/>}
 <div hidden={view!=='notifications'}>{state?.tools.notifications?<NotificationsStudio tool={state.tools.notifications} api={api} notice={notice} connected={online&&t?.connected} online={online}/>:view==='notifications'&&<Card className="loading">{state?'Reinicia Stream Buddy para cargar el módulo de notificaciones.':'Conectando con tu estudio…'}</Card>}</div>
 <div hidden={view!=='likes'}>{state?.tools.likes?<LikesStudio tool={state.tools.likes} api={api} notice={notice} online={online} connected={online&&t?.connected}/>:view==='likes'&&<Card>Reinicia Stream Buddy para cargar Top likes.</Card>}</div>
 <div hidden={view!=='gifters'}>{state?.tools.gifters?<GiftersStudio tool={state.tools.gifters} api={api} notice={notice} online={online} connected={online&&t?.connected}/>:view==='gifters'&&<Card>Reinicia Stream Buddy para cargar Top gifters.</Card>}</div>
 <div hidden={view!=='auction'}>{state?.tools.auction?<AuctionStudio tool={state.tools.auction} api={api} notice={notice} online={online} connected={online&&t?.connected}/>:view==='auction'&&<Card>Reinicia Stream Buddy para cargar Subasta.</Card>}</div>
 <div hidden={view!=='social'}>{state?.tools.social?<SocialStudio tool={state.tools.social} fonts={state.tools.notifications?.fonts} api={api} notice={notice} online={online}/>:view==='social'&&<Card>Reinicia Stream Buddy para cargar Social Media Rotator.</Card>}</div>
 <div hidden={view!=='banners'}>{state?.tools.banners?<BannersStudio tool={state.tools.banners} api={api} notice={notice} online={online}/>:view==='banners'&&<Card>Reinicia Stream Buddy para cargar Ad Banner Rotator.</Card>}</div>
 <div hidden={view!=='commands'}>{state?.tools.commands&&<CommandsStudio tool={state.tools.commands} api={api} notice={notice} online={online} connected={online&&t?.connected}/>}</div>
 <div hidden={view!=='spotify'}>{state?.tools.spotify?<SpotifyStudio tool={state.tools.spotify} api={api} notice={notice} online={online}/>:view==='spotify'&&<Card className="loading" role="status">{state?'Reinicia Stream Buddy para cargar el módulo de música.':'Conectando con tu estudio…'}</Card>}</div>
 <footer><span><span className="online-dot"/> Hecho para tu próximo directo.</span><span>Stream Buddy <span className="footer-separator">/</span> Tu producción, bajo control.</span></footer></main></StudioProfileContext.Provider></div><ToastRegion toasts={toasts} onDismiss={dismissToast}/></div>;
}
function ToolView({id,tool,api,notice}){const url=tool?.url||(id==='layout'?'http://localhost:8787':'http://127.0.0.1:17843');return <Card className="tool-view"><div className="tool-toolbar"><strong>{id==='layout'?'Layout Studio':'AdQueue'}</strong><div className="actions"><Button variant="outline" size="sm" onClick={()=>api('start',{tool:id})} disabled={tool?.starting}><RefreshCw size={14}/>Iniciar / reconectar</Button><Button asChild variant="outline" size="sm"><a href={url} target="_blank" rel="noopener noreferrer">Abrir aparte<ExternalLink size={14}/></a></Button>{id==='ads'&&<CopyLinkButton url={adQueueOutputURL(url)} notice={notice} message="Enlace de salida copiado." size="sm"><Copy size={14}/>Copiar salida</CopyLinkButton>}</div></div>{tool?.running?<iframe src={url} title={id==='layout'?'Layout Studio':'AdQueue'} allow="autoplay; clipboard-write"/>:<div className="tool-empty"><Monitor size={38}/><h2>{tool?.starting?'Preparando tu herramienta…':'Tu herramienta está detenida'}</h2><p>{tool?.error||(!tool?.available?'No se encontraron los archivos de la herramienta. Revisa su instalación.':'Inicia la herramienta para abrir su espacio de trabajo.')}</p></div>}</Card>;}

function CompositionEditor({active,...props}) {
 const [visited,setVisited]=useState(active);
 useEffect(()=>{if(active)setVisited(true);},[active]);
 return visited||active?<LayoutStudio {...props}/>:null;
}

const sidebarCollapsedKey = 'live-studio.sidebar.collapsed.v1';

function readCollapsedGroups() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(sidebarCollapsedKey) || '{}');
    return new Set(Object.keys(saved).filter(id => saved[id] === true));
  } catch {
    return new Set();
  }
}

function writeCollapsedGroups(groups) {
  try {
    window.localStorage.setItem(sidebarCollapsedKey, JSON.stringify(Object.fromEntries([...groups].map(id => [id, true]))));
  } catch {
    // El sidebar sigue funcionando aunque el navegador no permita guardar preferencias.
  }
}

function SidebarNavigation({ view, go }) {
  const [collapsed, setCollapsed] = useState(readCollapsedGroups);
  const previousView = useRef(view);

  useEffect(() => {
    if (previousView.current === view) return;
    previousView.current = view;
    const open = navigationGroups.flatMap(group => {
      const topLevel = group.items.some(item =>
        item.id === view || (item.id === 'layout' && view?.startsWith('layout:')));
      if (topLevel) return [group.id];
      const nested = group.items.find(item => item.items?.some(child => child.id === view));
      return nested ? [group.id, nested.id] : [];
    });
    if (!open.length) return;
    setCollapsed(current => {
      if (!open.some(id => current.has(id))) return current;
      const next = new Set(current);
      open.forEach(id => next.delete(id));
      writeCollapsedGroups(next);
      return next;
    });
  }, [view]);

  function toggleGroup(id) {
    setCollapsed(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      writeCollapsedGroups(next);
      return next;
    });
  }

  const renderItem = ({ id, title, icon: Icon }) => {
    const active = view === id;
    const inLayout = id === 'layout' && view?.startsWith('layout:');
    return <button key={id} type="button" aria-current={active ? 'page' : inLayout ? 'location' : undefined}
      className={active || inLayout ? 'nav-item active' : 'nav-item'} onClick={() => go(id)}>
      <Icon size={19} aria-hidden="true"/>{title}{(active || inLayout) && <span className="nav-indicator"/>}
    </button>;
  };

  return <nav aria-label="Menú principal">
    {navigationGroups.map(group => <section className="nav-category" key={group.id} aria-labelledby={`nav-${group.id}`}>
      <h2 className="nav-label" id={`nav-${group.id}`}>
        <button type="button" className="nav-category-toggle" aria-expanded={!collapsed.has(group.id)}
          aria-controls={`nav-${group.id}-items`} onClick={() => toggleGroup(group.id)}>
          <span>{group.title}</span><ChevronDown size={13} aria-hidden="true"/>
        </button>
      </h2>
      <div className="nav-category-items" id={`nav-${group.id}-items`} hidden={collapsed.has(group.id)}>
        {group.items.map(item => {
          if (!item.items) return renderItem(item);
          const ItemIcon = item.icon;
          const childActive = item.items.some(({ id }) => id === view);
          return <section className="nav-subcategory" key={item.id} aria-labelledby={`nav-${item.id}`}>
            <h3 className="nav-subcategory-label" id={`nav-${item.id}`}>
              <button type="button" className={childActive ? 'nav-item nav-subitem-toggle nav-subitem-current' : 'nav-item nav-subitem-toggle'}
                aria-expanded={!collapsed.has(item.id)} aria-controls={`nav-${item.id}-items`}
                onClick={() => toggleGroup(item.id)}>
                {ItemIcon && <ItemIcon size={19} aria-hidden="true"/>}{item.title}
                <ChevronDown className="nav-subitem-chevron" size={14} aria-hidden="true"/>
              </button>
            </h3>
            <div className="nav-category-items nav-subcategory-items" id={`nav-${item.id}-items`} hidden={collapsed.has(item.id)}>
              {item.items.map(renderItem)}
            </div>
          </section>;
        })}
      </div>
    </section>)}
  </nav>;
}
