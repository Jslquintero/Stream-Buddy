import { OutputLinks, OutputToolbar } from './output-controls';
import { useNotificationSettings } from '../hooks/use-notification-settings';
import { notificationFontStack, NotificationFontResource } from './notification-fonts';
import { imageMimeFromBytes, maxImageBytes } from '../../../modules/notifications/image-files';
import { inspectNotificationMedia } from '../lib/notification-media';
import { MediaPicker, AlertAudio, VideoClip } from './notification-media';
import { useEffect, useRef, useState } from 'react';
import { Bell, Gift, Heart, Share2, Star, Play, SkipForward, Trash2, SlidersHorizontal, Type } from 'lucide-react';
import { Badge, Button, Card, Input, Textarea, Tabs, TabsList, TabsTrigger, TabsContent } from './ui';
import { Field, Toggle } from './fields';
import { useStudio } from '../hooks/use-studio';
import { eventNames, notificationText, notificationOutputPath, notificationDesign, designExtras, isLocalNotificationAsset } from '../../../modules/notifications/config';
import { NotificationDesign } from './notification-design';
import { EditorViewSwitch } from './editor-view-switch';
import './editor-workspace.css';
import './notification-editor.css';
const icons = { follow: Heart, gift: Gift, share: Share2, superfan: Star };
const example = { user: 'María', gift: 'Rosa', count: 3 };

function AlertPreview({ visual, replay }) {
  const stage = useRef(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(stage.current);
    return () => observer.disconnect();
  }, []);
  const canvasWidth = Math.max(800, Number(visual.style.width) + 48);
  return <div className="notification-stage" ref={stage}>
    <div className="notification-preview-canvas" style={{ width:canvasWidth, height:canvasWidth * 9/16, transform:`scale(${width ? width/canvasWidth : 1})` }}>
      <NotificationVisual key={replay + visual.type} notification={visual}/>
    </div>
  </div>;
}

function VideoTrimmer({event,duration,update}) {
  const length=event.videoDuration, start=event.videoStart??0, end=event.videoEnd??Math.min(length,duration);
  useEffect(()=>{if(end-start>duration)update('videoEnd',start+duration);},[duration,start,end]);
  const changeStart=value=>{const next=Math.max(0,Math.min(length-.1,Number(value)));update('videoStart',next);update('videoEnd',Math.min(length,next+Math.min(duration,end-start)));};
  const changeEnd=value=>update('videoEnd',Math.max(start+.1,Math.min(length,start+duration,Number(value))));
  return <div className="alert-video-trimmer"><p className="help">Archivo: {length.toFixed(1)} s · Fragmento: {(end-start).toFixed(1)} s · Máximo: {duration} s.</p>
    <div className="form-row"><Field label="Inicio · segundos">{id=><Input id={id} type="number" min="0" max={Math.max(0,length-.1)} step="any" value={start} onChange={e=>changeStart(e.target.value)}/>}</Field><Field label="Fin · segundos">{id=><Input id={id} type="number" min={start+.1} max={Math.min(length,start+duration)} step="any" value={end} onChange={e=>changeEnd(e.target.value)}/>}</Field></div>
    <Field label="Desplazar inicio del fragmento">{id=><input id={id} type="range" min="0" max={Math.max(0,length-.1)} step="0.1" value={start} onChange={e=>changeStart(e.target.value)}/>}</Field>
    <Toggle name="videoMuted" label="Silenciar sonido del video" settings={{videoMuted:event.videoMuted??true}} update={update}/>
    {!event.videoMuted&&!event.audio&&<Field label={'Volumen del video: '+(event.volume??80)+'%'}>{id=><input id={id} type="range" min="0" max="100" value={event.volume??80} onChange={e=>update('volume',Number(e.target.value))}/>}</Field>}
    {event.audio&&<p className="help">El audio personalizado sustituye al sonido del video.</p>}
  </div>;
}

export function NotificationVisual({ notification, live = false }) {
  if (!notification) return null;
  const { type, title, message, image } = notification;
  const style = { ...designExtras, ...notification.style };
  const Icon = icons[type] || Bell;
  return <div className={'notification-position ' + style.position}><NotificationFontResource family={style.fontFamily}/>
    <div className={'notification-banner layout-' + style.layout + ' animate-' + style.animation} style={{ background: style.background + Math.round(style.backgroundOpacity*2.55).toString(16).padStart(2,'0'), color: style.color, '--alert-accent': style.accent, fontSize: style.fontSize + 'px', borderRadius: style.radius + 'px', width:style.width+'px', padding:style.padding+'px', borderWidth:style.borderWidth+'px', boxShadow:style.shadow?undefined:'none', textAlign:style.textAlign, fontFamily:notificationFontStack(style.fontFamily),borderColor:style.accent+Math.round((style.borderOpacity??100)*2.55).toString(16).padStart(2,'0'),animationDuration:(style.animationSpeed??500)+'ms' }}>
      {isLocalNotificationAsset('video',notification.video)?<VideoClip src={notification.video} start={notification.videoStart} end={notification.videoEnd} muted={!live||!!notification.audio||notification.videoMuted} volume={notification.volume} fit={style.imageFit} autoPlay expiresAt={notification.expiresAt} duration={style.duration} style={{width:style.imageSize+'px',height:style.imageSize+'px',maxWidth:'100%',borderRadius:style.imageRadius+'px',overflow:'hidden'}}/>:isLocalNotificationAsset('image',image)?<img className="notification-image" src={image} alt={style.layout==='image-only'?title:''} style={{width:style.imageSize+'px',height:style.imageSize+'px',objectFit:style.imageFit,borderRadius:style.imageRadius+'px'}}/>:<span className="notification-symbol"><Icon aria-hidden="true"/></span>}
      {style.layout !== 'image-only' && <div className="notification-copy" style={{textShadow: style.textShadow ? '0 1px 2px #000, 0 2px 6px #000c' : undefined}}>
        <strong style={{fontWeight:style.fontWeight}}>{title}</strong><p>{message}</p>
      </div>}
    </div>
  </div>;
}

export function NotificationsOutput() {
  const { state, online } = useStudio('notifications');
  const current = state?.tools.notifications?.current;
  const [expired, setExpired] = useState(null);
  useEffect(() => {
    document.documentElement.classList.add('notifications-output');
    document.documentElement.style.colorScheme = 'normal';
    return () => {document.documentElement.classList.remove('notifications-output');document.documentElement.style.removeProperty('color-scheme');};
  }, []);
  useEffect(() => {
    if (!current) return;
    const timer = setTimeout(() => setExpired(current.id), Math.max(0, current.expiresAt - Date.now()));
    return () => clearTimeout(timer);
  }, [current?.id, current?.expiresAt]);
  return <div className="notification-stage output-stage">{online && current && current.expiresAt > Date.now() && expired !== current.id && <div key={current.id}><NotificationVisual notification={current} live/>{isLocalNotificationAsset('audio',current.audio) && <AlertAudio notification={current}/>}</div>}</div>;
}

export function NotificationsStudio({ tool, api, notice, connected, online }) {
  const {config,setConfig,dirty,saving,error:saveError}=useNotificationSettings(tool.config,tool.revision,api,online);
  const [uploading,setUploading] = useState('');
  const [type,setType]=useState('follow'),[preview,setPreview]=useState(0);
  const [panel, setPanel] = useState('content');
  const [mobileView, setMobileView] = useState('editor');
  const update=(key,value)=>setConfig(s=>({...s,[key]:value}));
  const updateEvent=(key,value)=>setConfig(s=>({...s,events:{...s.events,[type]:{...s.events[type],[key]:value}}}));
  const output = new URL(notificationOutputPath, window.location.origin).href;
  const event = config.events[type];
  const design = notificationDesign(config,type);
  const updateDesign = (key,value) => event.appearance ? updateEvent('appearance',{...design,[key]:value}) : update(key,value);
  const visual = { type, video:event.video, videoStart:event.videoStart, videoEnd:event.videoEnd, videoMuted:true, image:event.image, style: design, title: notificationText(event.title, example), message: notificationText(event.message, example) };
  const setMedia = (target, kind, src, name, metadata = {}) => {
    const patch = { [kind]:src, [kind + 'Name']:name, ...metadata };
    if (src && kind === 'image') Object.assign(patch, { video:'', videoName:'' });
    if (src && kind === 'video') Object.assign(patch, { image:'', imageName:'' });
    setConfig(s => ({...s, events:{...s.events, [target]:{...s.events[target], ...patch}}}));
  };
  const upload = async (file,kind='image') => {
    const target=type; if(!file)return;
    const formats={image:['image/png','image/jpeg','image/webp','image/gif'],audio:['audio/mpeg','audio/mp3','audio/wav','audio/x-wav','audio/ogg'],video:['video/mp4','video/webm']};
    const limit=kind==='image'?maxImageBytes:(kind==='video'?30:5)*1024*1024;
    if(file.size>limit)throw new Error('El archivo pesa '+(file.size/1024/1024).toFixed(1)+' MB; el máximo es '+(limit/1024/1024)+' MB.');
    if(kind!=='image'&&!formats[kind].includes(file.type))throw new Error(kind==='audio'?'Elige MP3, WAV u OGG.':'Elige MP4 o WebM.');
    setUploading(kind);
    try {
      let data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('No se pudo leer la imagen'));reader.readAsDataURL(file);});
      if(kind==='image'){
        const encoded=data.slice(data.indexOf(',')+1),signature=Uint8Array.from(atob(encoded.slice(0,24)),c=>c.charCodeAt(0));
        const mime=imageMimeFromBytes(signature);
        if(!mime)throw new Error('El contenido no es una imagen PNG, JPG, WebP o GIF válida.');
        data='data:'+mime+';base64,'+encoded;
      }
      const metadata=kind==='audio'?{}:await inspectNotificationMedia(data,kind,design.duration);
      const result=await api('notifications/upload',{data,kind},{throwOnError:true});
      if(result?.[kind]) setMedia(target,kind,result[kind],file.name.slice(0,180),metadata);
    } catch(error){notice(error.message,{type:'error'});throw error;} finally{setUploading('');}
  };
  return <div className="notifications-studio editor-workspace">
    <header className="editor-workspace-header"><h1 className="editor-workspace-title">Notificaciones</h1>
    <OutputToolbar connected={connected} description={connected ? 'Recibiendo eventos del LIVE.' : 'Conecta TikTok para recibir eventos.'}>
      <OutputLinks notice={notice} url={output} message="Enlace de notificaciones copiado." fallback="Enlace de notificaciones" copyLabel="Copiar enlace" openLabel="Abrir salida" iconSize={15} size="sm"/>
    </OutputToolbar>
    </header>
    {tool.error && <p className="error" role="alert">{tool.error}</p>}
    <EditorViewSwitch view={mobileView} change={setMobileView} editorLabel="Editar alerta" monitorLabel="Vista previa y cola"/>
    <div className="notifications-grid editor-workspace-grid" data-view={mobileView}>
      <Card className="notifications-settings editor-workspace-settings">
        <div className="notification-editor-heading"><h2>Editor de alertas</h2><Toggle name="enabled" label="Activar notificaciones" settings={config} update={update}/></div>
        <div className="notification-types" role="group" aria-label="Tipo de alerta">{Object.entries(eventNames).map(([id, label]) => { const Icon = icons[id]; return <Button key={id} variant="outline" aria-pressed={type === id} onClick={() => setType(id)}><Icon size={16}/>{label}</Button>; })}</div>
        <Tabs value={panel} onValueChange={setPanel}>
        <div className="notification-panel-heading"><TabsList aria-label="Ajustes de la alerta"><TabsTrigger value="content"><Type size={15}/>Contenido</TabsTrigger><TabsTrigger value="design"><SlidersHorizontal size={15}/>Diseño</TabsTrigger></TabsList>
        <Toggle name="enabled" label={'Mostrar: ' + eventNames[type]} settings={event} update={updateEvent}/></div>
        <TabsContent value="content" data-panel="content" forceMount hidden={panel !== 'content'}>
        <Field label="Título de la alerta">{id => <Input id={id} value={event.title} required maxLength={100} onChange={e => updateEvent('title', e.target.value)}/>}</Field>
        <Field label="Mensaje" hint="Variables disponibles: {usuario}, {regalo}, {cantidad}">{id => <Textarea id={id} rows={2} value={event.message} maxLength={300} onChange={e => updateEvent('message', e.target.value)}/>}</Field>
        <p className="help notification-media-hint">Elige una imagen/GIF o un video. Puedes añadir sonido a cualquiera.</p>
        <div className="notification-attachments">
        <MediaPicker kind="image" src={event.image} name={event.imageName} busy={uploading==='image'} disabled={!!uploading||!online} onFile={file=>upload(file,'image')} onRemove={()=>setMedia(type,'image','','')}/>
        <MediaPicker kind="video" src={event.video} name={event.videoName} busy={uploading==='video'} disabled={!!uploading||!online} onFile={file=>upload(file,'video')} onRemove={()=>setMedia(type,'video','','')}/>
        <MediaPicker kind="audio" src={event.audio} name={event.audioName} busy={uploading==='audio'} disabled={!!uploading||!online} onFile={file=>upload(file,'audio')} onRemove={()=>setMedia(type,'audio','','')}/>
        </div>
        {event.video && <details className="notification-design-section"><summary>Recorte y sonido del video</summary><VideoTrimmer key={type+event.video} event={event} duration={design.duration} update={updateEvent}/></details>}
        {event.audio && <Field label={'Volumen: '+(event.volume??80)+'%'}>{id=><input id={id} type="range" min="0" max="100" value={event.volume??80} onChange={e=>updateEvent('volume',Number(e.target.value))}/>}</Field>}
        </TabsContent>
        <TabsContent value="design" data-panel="design" forceMount hidden={panel !== 'design'}>
        <Toggle name="custom" label="Diseño propio para esta alerta" description={event.appearance?'Solo cambia '+eventNames[type]+'.':'Estás editando el diseño compartido.'} settings={{custom:!!event.appearance}} update={(_,value)=>updateEvent('appearance',value?notificationDesign(config,type):null)}/>
        <NotificationDesign design={design} update={updateDesign} resize={values=>setConfig(s=>s.events[type].appearance?{...s,events:{...s.events,[type]:{...s.events[type],appearance:{...s.events[type].appearance,...values}}}}:{...s,...values})} fonts={tool.fonts} api={api} online={online}/>
        </TabsContent></Tabs>
        {saveError&&<p className="error" role="alert">{saveError}</p>}<div className="save-bar"><span role="status" className={dirty ? 'unsaved' : 'help'}>{saving ? 'Guardando…' : dirty ? online ? 'Pendiente de autoguardado' : 'Pendiente de conexión' : 'Configuración guardada'}</span></div>
      </Card>
      <div className="notifications-monitor editor-workspace-monitor"><Card className="notification-preview"><div className="section-heading"><h2>Vista previa</h2><Badge>DATOS DE EJEMPLO</Badge></div><AlertPreview visual={visual} replay={preview}/><div className="actions"><Button variant="outline" onClick={() => setPreview(n => n + 1)}>Repetir animación</Button><Button disabled={!online || uploading || !config.enabled || !event.enabled} onClick={async () => { if (await api('notifications/test', { type, config })) notice('Prueba enviada a la salida de alertas.'); }}><Play size={15}/>Enviar prueba al directo</Button></div></Card>
        <Card className="notifications-queue"><h2>Cola de alertas</h2><p className="muted">{tool.current ? `Mostrando: ${eventNames[tool.current.type]}` : 'Esperando eventos'} · {tool.queued} pendientes</p><div className="actions"><Button variant="outline" disabled={!online || !tool.current} onClick={() => api('notifications/skip')}><SkipForward size={15}/>Saltar alerta</Button><Button variant="outline" disabled={!online || (!tool.current && !tool.queued)} onClick={() => api('notifications/clear')}><Trash2 size={15}/>Vaciar alertas</Button></div></Card>
        <details className="notifications-help"><summary>Añádelo a tu directo</summary><p className="help">Copia el enlace de alertas y añádelo como fuente de navegador en OBS o TikTok LIVE Studio. Usa el tamaño de tu lienzo, por ejemplo 1920 × 1080 o 1080 × 1920. La salida es transparente hasta recibir un evento. Los regalos en racha se muestran al finalizar.</p></details>
      </div>
    </div>
  </div>;
}
