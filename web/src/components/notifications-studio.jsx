import { OutputLinks, OutputToolbar } from './output-controls';
import { useNotificationSettings } from '../hooks/use-notification-settings';
import { notificationFontStack, NotificationFontResource } from './notification-fonts';
import { imageMimeFromBytes, maxImageBytes } from '../../../modules/notifications/image-files';
import { inspectNotificationMedia } from '../lib/notification-media';
import { MediaPicker, AlertAudio, AudioTrimmer, VideoClip } from './notification-media';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Bell, Film, Gift, Heart, ImagePlus, Music2, Share2, Star, Play, SkipForward, Trash2, SlidersHorizontal, Type, X } from 'lucide-react';
import { Badge, Button, Card, Dialog, Input, Textarea, Tabs, TabsList, TabsTrigger, TabsContent } from './ui';
import { Field, Toggle } from './fields';
import { useStudio } from '../hooks/use-studio';
import { eventNames, notificationText, notificationOutputPath, notificationDesign, designExtras, isLocalNotificationAsset } from '../../../modules/notifications/config';
import { NotificationDesign } from './notification-design';
import { EditorViewSwitch } from './editor-view-switch';
import './editor-workspace.css';
import './notification-editor.css';

const icons = { follow: Heart, gift: Gift, share: Share2, superfan: Star };
const example = { user: 'María', gift: 'Rosa', count: 3 };
const typeInfo = {
  follow: { description: 'Cuando alguien nuevo empieza a seguirte.', action: 'Nuevo seguidor' },
  gift: { description: 'Cuando alguien te envía un regalo.', action: 'Regalo recibido' },
  share: { description: 'Cuando alguien comparte tu directo.', action: 'Directo compartido' },
  superfan: { description: 'Cuando alguien se convierte en Super Fan.', action: 'Nuevo Super Fan' },
};
const positionLabels = {
  'top-left': 'Arriba · izquierda', 'top-center': 'Arriba · centro', 'top-right': 'Arriba · derecha',
  'bottom-left': 'Abajo · izquierda', 'bottom-center': 'Abajo · centro', 'bottom-right': 'Abajo · derecha',
};
const variables = ['usuario', 'regalo', 'cantidad'];

function AlertPreview({ visual, replay }) {
  const stage = useRef(null);
  const banner = useRef(null);
  const [width, setWidth] = useState(0);
  const [bannerHeight, setBannerHeight] = useState(0);
  useLayoutEffect(() => {
    const frame = stage.current;
    const content = banner.current;
    const resize = () => {
      setWidth(frame.clientWidth);
      setBannerHeight(content.offsetHeight);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(frame);
    observer.observe(content, { box: 'border-box' });
    window.addEventListener('resize', resize);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, [replay, visual.type]);
  const canvasWidth = Math.max(800, Number(visual.style.width) + 48);
  const canvasHeight = Math.max(canvasWidth * 9/16, bannerHeight + 48);
  return <div className="notification-stage" ref={stage} style={{ aspectRatio: `${canvasWidth} / ${canvasHeight}` }}>
    <div className="notification-preview-canvas" style={{ width:canvasWidth, height:canvasHeight, transform:`scale(${width ? width/canvasWidth : 1})` }}>
      <NotificationVisual key={replay + visual.type} notification={visual} bannerRef={banner}/>
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

export function NotificationVisual({ notification, live = false, bannerRef }) {
  if (!notification) return null;
  const { type, title, message, image } = notification;
  const style = { ...designExtras, ...notification.style };
  const Icon = icons[type] || Bell;
  return <div className={'notification-position ' + style.position}><NotificationFontResource family={style.fontFamily}/>
    <div ref={bannerRef} className={'notification-banner layout-' + style.layout + ' animate-' + style.animation} style={{ background: style.background + Math.round(style.backgroundOpacity*2.55).toString(16).padStart(2,'0'), color: style.color, '--alert-accent': style.accent, fontSize: style.fontSize + 'px', borderRadius: style.radius + 'px', width:style.width+'px', padding:style.padding+'px', borderWidth:style.borderWidth+'px', boxShadow:style.shadow?undefined:'none', textAlign:style.textAlign, fontFamily:notificationFontStack(style.fontFamily),borderColor:style.accent+Math.round((style.borderOpacity??100)*2.55).toString(16).padStart(2,'0'),animationDuration:(style.animationSpeed??500)+'ms' }}>
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
  const [mediaOpen, setMediaOpen] = useState(false);
  const update=(key,value)=>setConfig(s=>({...s,[key]:value}));
  const updateEvent=(key,value)=>setConfig(s=>({...s,events:{...s.events,[type]:{...s.events[type],[key]:value}}}));
  const output = new URL(notificationOutputPath, window.location.origin).href;
  const event = config.events[type];
  const design = notificationDesign(config,type);
  const TypeIcon = icons[type] || Bell;
  const updateDesign = (key,value) => event.appearance ? updateEvent('appearance',{...design,[key]:value}) : update(key,value);
  const visual = { type, video:event.video, videoStart:event.videoStart, videoEnd:event.videoEnd, videoMuted:true, image:event.image, style: design, title: notificationText(event.title, example), message: notificationText(event.message, example) };
  const setMedia = (target, kind, src, name, metadata = {}) => {
    const patch = { [kind]:src, [kind + 'Name']:name, ...metadata };
    if (src && kind === 'image') Object.assign(patch, { video:'', videoName:'' });
    if (src && kind === 'video') Object.assign(patch, { image:'', imageName:'' });
    if (kind === 'audio') Object.assign(patch, { audioStart:0, audioEnd:0, audioDuration:0 });
    setConfig(s => ({...s, events:{...s.events, [target]:{...s.events[target], ...patch}}}));
  };
  const addVariable = name => updateEvent('message', (event.message || '') + (event.message && !/\s$/.test(event.message) ? ' ' : '') + '{' + name + '}');
  const visualName = event.video ? event.videoName : event.imageName;
  const hasMedia = Boolean(event.image || event.video || event.audio);
  useEffect(() => {
    if (!mediaOpen) return;
    const onKey = keyEvent => { if (keyEvent.key === 'Escape') { keyEvent.preventDefault(); setMediaOpen(false); } };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = setTimeout(() => document.getElementById('notification-media-dialog')?.focus(), 20);
    return () => { clearTimeout(focusTimer); document.removeEventListener('keydown', onKey); document.body.style.overflow = previousOverflow; };
  }, [mediaOpen]);
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
  const saveLabel = saving ? 'Guardando…' : dirty ? online ? 'Pendiente de autoguardado' : 'Pendiente de conexión' : 'Configuración guardada';
  return <div className="notifications-studio editor-workspace">
    <header className="editor-workspace-header notifications-header">
      <div className="notifications-heading">
        <p className="eyebrow">Alertas del directo</p>
        <h1 className="editor-workspace-title">Notificaciones</h1>
        <p className="help">Diseña cómo reacciona tu directo a cada muestra de apoyo de la comunidad.</p>
      </div>
      <OutputToolbar connected={connected} description={connected ? 'Recibiendo eventos del LIVE.' : 'Conecta TikTok para recibir eventos.'}>
        <OutputLinks notice={notice} url={output} message="Enlace de notificaciones copiado." fallback="Enlace de notificaciones" copyLabel="Copiar enlace" openLabel="Abrir salida" iconSize={15} size="sm"/>
      </OutputToolbar>
    </header>
    {tool.error && <p className="error" role="alert">{tool.error}</p>}
    <EditorViewSwitch view={mobileView} change={setMobileView} editorLabel="Editar alerta" monitorLabel="Vista previa y cola"/>
    <div className="notifications-grid editor-workspace-grid" data-view={mobileView}>
      <Card className="notifications-settings editor-workspace-settings">
        <div className="notification-editor-heading">
          <div className="notification-editor-title">
            <span className="notification-editor-icon" aria-hidden="true"><Bell size={18}/></span>
            <div><h2>Editor de alertas</h2><p className="help">Elige el evento y ajusta su aspecto.</p></div>
          </div>
          <Toggle name="enabled" label="Activar notificaciones" settings={config} update={update}/>
        </div>
        <div className="notification-type-section">
          <div className="notification-section-heading"><h3>Tipo de alerta</h3><span className="help">Cuatro momentos, un mismo estilo.</span></div>
          <div className="notification-types" role="group" aria-label="Tipo de alerta">{Object.entries(eventNames).map(([id, label]) => { const Icon = icons[id]; return <Button key={id} variant="outline" data-type={id} data-enabled={config.events[id].enabled} title={typeInfo[id].description} aria-pressed={type === id} onClick={() => setType(id)}><Icon size={17}/><span>{label}</span></Button>; })}</div>
        </div>
        <Tabs value={panel} onValueChange={setPanel}>
          <div className="notification-alert-heading">
            <div className="notification-alert-identity">
              <span className="notification-alert-icon" data-type={type} aria-hidden="true"><TypeIcon size={17}/></span>
              <div><h3>{eventNames[type]}</h3><p className="help">{typeInfo[type].description}</p></div>
            </div>
            <Toggle name="enabled" label={'Mostrar: ' + eventNames[type]} settings={event} update={updateEvent}/>
          </div>
          <TabsList className="tabs-list notification-panel-tabs" aria-label="Ajustes de la alerta">
            <TabsTrigger value="content"><Type size={15}/>Contenido</TabsTrigger>
            <TabsTrigger value="design"><SlidersHorizontal size={15}/>Diseño</TabsTrigger>
          </TabsList>
          <TabsContent value="content" data-panel="content" forceMount hidden={panel !== 'content'}>
            <section className="notification-form-section">
              <div className="notification-form-heading">
                <div><h4>Texto de la alerta</h4><p className="help">Aparece en la vista previa y en el directo.</p></div>
              </div>
              <Field label="Título de la alerta">{id => <Input id={id} value={event.title} required maxLength={100} onChange={e => updateEvent('title', e.target.value)}/>}</Field>
              <Field label="Mensaje">{id => <Textarea id={id} rows={2} value={event.message} maxLength={300} onChange={e => updateEvent('message', e.target.value)}/>}</Field>
              <div className="notification-variables" aria-label="Insertar variables en el mensaje">
                <span className="help">Insertar variable</span>
                {variables.map(name => <button key={name} type="button" className="notification-variable" onClick={() => addVariable(name)}>{'{' + name + '}'}</button>)}
              </div>
            </section>
            <section className="notification-form-section">
              <div className="notification-form-heading">
                <div><h4>Multimedia</h4><p className="help">Una imagen o un video, con sonido opcional.</p></div>
              </div>
              <div className="notification-media-summary">
                <div className="notification-media-summary-slots">
                  <div className={'notification-media-summary-item' + (event.image || event.video ? ' is-filled' : '')}>
                    <span className="notification-media-summary-thumb">
                      {event.image ? <img src={event.image} alt="Miniatura de la imagen de la alerta"/> : event.video ? <Film size={17}/> : <ImagePlus size={17}/>}
                    </span>
                    <div className="notification-media-summary-copy">
                      <strong>{event.video ? 'Video' : event.image ? 'Imagen o GIF' : 'Contenido visual'}</strong>
                      <span className={visualName ? '' : 'is-empty'} title={visualName || undefined}>{visualName || 'Sin archivo'}</span>
                    </div>
                  </div>
                  <div className={'notification-media-summary-item' + (event.audio ? ' is-filled' : '')}>
                    <span className="notification-media-summary-thumb is-audio"><Music2 size={17}/></span>
                    <div className="notification-media-summary-copy">
                      <strong>Sonido</strong>
                      <span className={event.audio ? '' : 'is-empty'} title={event.audioName || undefined}>{event.audio ? event.audioName : 'Sin sonido'}</span>
                      {event.audio && event.audioEnd > 0 && <span className="notification-media-summary-extra">Fragmento {Number(event.audioStart || 0).toFixed(1)}–{Number(event.audioEnd).toFixed(1)} s</span>}
                    </div>
                  </div>
                </div>
                <Button variant="outline" onClick={() => setMediaOpen(true)}><SlidersHorizontal size={15}/>{hasMedia ? 'Gestionar multimedia' : 'Añadir multimedia'}</Button>
              </div>
              <Dialog open={mediaOpen} onClose={() => setMediaOpen(false)} keepMounted backdropClassName="notification-media-backdrop" className="notification-media-dialog" id="notification-media-dialog" tabIndex={-1} aria-label={'Multimedia de ' + eventNames[type]}>
                <div className="notification-media-dialog-header">
                  <div><h2>Multimedia de {eventNames[type]}</h2><p className="help">Elige una imagen o un video y, si quieres, añade un sonido. También puedes recortar el video, elegir un fragmento del audio y ajustar el volumen.</p></div>
                  <Button variant="ghost" size="icon" onClick={() => setMediaOpen(false)} aria-label="Cerrar multimedia"><X size={18}/></Button>
                </div>
                <div className="notification-media-dialog-body">
                  <div className="notification-attachments">
                    <div className="notification-media-visual">
                      <MediaPicker kind="image" src={event.image} name={event.imageName} busy={uploading==='image'} disabled={!!uploading||!online} onFile={file=>upload(file,'image')} onRemove={()=>setMedia(type,'image','','')}/>
                      <span className="notification-media-divider" aria-hidden="true">o</span>
                      <MediaPicker kind="video" src={event.video} name={event.videoName} busy={uploading==='video'} disabled={!!uploading||!online} onFile={file=>upload(file,'video')} onRemove={()=>setMedia(type,'video','','')}/>
                    </div>
                    <MediaPicker kind="audio" src={event.audio} name={event.audioName} busy={uploading==='audio'} disabled={!!uploading||!online} onFile={file=>upload(file,'audio')} onRemove={()=>setMedia(type,'audio','','')}/>
                  </div>
                  {event.video && <details className="notification-design-section notification-media-options"><summary>Recorte y sonido del video</summary><VideoTrimmer key={type+event.video} event={event} duration={design.duration} update={updateEvent}/></details>}
                  {event.audio && <section className="notification-audio-options">
                    <div className="notification-form-heading"><div><h4>Fragmento de audio</h4><p className="help">Elige la parte que sonará con la alerta.</p></div></div>
                    <AudioTrimmer key={type+event.audio} src={event.audio} start={event.audioStart??0} end={event.audioEnd??0} duration={event.audioDuration??0} limit={design.duration} accent={design.accent} active={mediaOpen} onChange={updateEvent}/>
                    <div className="notification-volume"><Field label={'Volumen: '+(event.volume??80)+'%'}>{id=><input id={id} type="range" min="0" max="100" value={event.volume??80} onChange={e=>updateEvent('volume',Number(e.target.value))}/>}</Field></div>
                  </section>}
                </div>
                <div className="notification-media-dialog-footer">
                  <p className="help">Los cambios se guardan automáticamente.</p>
                  <Button onClick={() => setMediaOpen(false)}>Listo</Button>
                </div>
              </Dialog>
            </section>
          </TabsContent>
          <TabsContent value="design" data-panel="design" forceMount hidden={panel !== 'design'}>
            <div className={'notification-custom-design' + (event.appearance ? ' is-active' : '')}>
              <Toggle name="custom" label="Diseño propio para esta alerta" description={event.appearance?'Solo cambia '+eventNames[type]+'.':'Estás editando el diseño compartido.'} settings={{custom:!!event.appearance}} update={(_,value)=>updateEvent('appearance',value?notificationDesign(config,type):null)}/>
            </div>
            <NotificationDesign design={design} update={updateDesign} resize={values=>setConfig(s=>s.events[type].appearance?{...s,events:{...s.events,[type]:{...s.events[type],appearance:{...s.events[type].appearance,...values}}}}:{...s,...values})} fonts={tool.fonts} api={api} online={online}/>
          </TabsContent>
        </Tabs>
        {saveError&&<p className="error" role="alert">{saveError}</p>}
        <div className="save-bar"><span role="status" className={dirty ? 'unsaved' : 'help'}>{saveLabel}</span></div>
      </Card>
      <div className="notifications-monitor editor-workspace-monitor">
        <Card className="notification-preview">
          <div className="notification-preview-heading">
            <div><h2>Vista previa</h2><p className="help">Así se verá la alerta en tu directo.</p></div>
            <Badge>DATOS DE EJEMPLO</Badge>
          </div>
          <div className="notification-preview-meta">
            <span className="notification-preview-chip" data-type={type}><TypeIcon size={13}/>{eventNames[type]}</span>
            <span className="notification-preview-chip">{design.duration} s</span>
            <span className="notification-preview-chip">{positionLabels[design.position] || design.position}</span>
            {(!config.enabled || !event.enabled) && <span className="notification-preview-chip is-paused">Pausada</span>}
          </div>
          <AlertPreview visual={visual} replay={preview}/>
          <div className="actions notification-preview-actions">
            <Button variant="outline" onClick={() => setPreview(n => n + 1)}>Repetir animación</Button>
            <Button disabled={!online || uploading || !config.enabled || !event.enabled} onClick={async () => { if (await api('notifications/test', { type, config })) notice('Prueba enviada a la salida de alertas.'); }}><Play size={15}/>Enviar prueba al directo</Button>
          </div>
        </Card>
        <Card className="notifications-queue">
          <div className="notifications-queue-heading">
            <div><h2>Cola de alertas</h2><p className="muted">{tool.current ? `Mostrando: ${eventNames[tool.current.type]}` : 'Esperando eventos'} · {tool.queued} pendientes</p></div>
            <Badge className={tool.current ? 'success' : ''}>{tool.current ? 'En pantalla' : 'En espera'}</Badge>
          </div>
          <div className="notification-queue-stats">
            <div className="notification-queue-stat"><strong>{tool.queued}</strong><span>en cola</span></div>
            <div className="notification-queue-stat"><strong>{tool.current ? eventNames[tool.current.type] : '—'}</strong><span>en pantalla</span></div>
          </div>
          <div className="actions">
            <Button variant="outline" disabled={!online || !tool.current} onClick={() => api('notifications/skip')}><SkipForward size={15}/>Saltar alerta</Button>
            <Button variant="outline" disabled={!online || (!tool.current && !tool.queued)} onClick={() => api('notifications/clear')}><Trash2 size={15}/>Vaciar alertas</Button>
          </div>
        </Card>
        <details className="notifications-help"><summary>Añádelo a tu directo</summary><p className="help">Copia el enlace de alertas y añádelo como fuente de navegador en OBS o TikTok LIVE Studio. Usa el tamaño de tu lienzo, por ejemplo 1920 × 1080 o 1080 × 1920. La salida es transparente hasta recibir un evento. Los regalos en racha se muestran al finalizar.</p></details>
      </div>
    </div>
  </div>;
}
