import { useNotificationSettings } from '../hooks/use-notification-settings';
import { notificationFontStack, NotificationFontResource } from './notification-fonts';
import { imageMimeFromBytes, maxImageBytes } from '../../../modules/notifications/image-files';
import { videoSite } from '../../../modules/notifications/video-sites';
import { inspectNotificationMedia } from '../lib/notification-media';
import { MediaPicker, AudioPreview, AlertAudio, VideoClip } from './notification-media';
import { useEffect, useRef, useState } from 'react';
import { Bell, Gift, Heart, Share2, Star, Copy, ExternalLink, Save, Play, SkipForward, Trash2 } from 'lucide-react';
import { Badge, Button, Card, Input, Textarea } from './ui';
import { Field, Toggle } from './fields';
import { useStudio } from '../hooks/use-studio';
import { eventNames, notificationText, notificationOutputPath, validateNotifications, notificationDesign, designExtras, isRemoteMediaURL } from '../../../modules/notifications/config';
import { NotificationDesign } from './notification-design';
const icons = { follow: Heart, gift: Gift, share: Share2, superfan: Star };
const example = { user: 'María', gift: 'Rosa', count: 3 };

function VideoTrimmer({event,duration,update}) {
  const site=videoSite(event.video);
  const length=event.videoDuration, start=event.videoStart??0, end=event.videoEnd??Math.min(length,duration);
  useEffect(()=>{if(end-start>duration)update('videoEnd',start+duration);},[duration,start,end]);
  const changeStart=value=>{const next=Math.max(0,Math.min(length-.1,Number(value)));update('videoStart',next);update('videoEnd',Math.min(length,next+Math.min(duration,end-start)));};
  const changeEnd=value=>update('videoEnd',Math.max(start+.1,Math.min(length,start+duration,Number(value))));
  return <div className="alert-video-trimmer"><VideoClip src={event.video} start={start} end={end} muted={event.videoMuted} volume={event.volume??80}/><p className="help">{site?('Sitio: '+(site.provider==='youtube'?'YouTube':'Vimeo')):('Archivo: '+length.toFixed(1)+' s')} · Fragmento: {(end-start).toFixed(1)} s · Máximo: {duration} s. El video sustituye a la imagen mientras esté seleccionado.</p>
    <div className="form-row"><Field label="Inicio · segundos">{id=><Input id={id} type="number" min="0" max={Math.max(0,length-.1)} step="any" value={start} onChange={e=>changeStart(e.target.value)}/>}</Field><Field label="Fin · segundos">{id=><Input id={id} type="number" min={start+.1} max={Math.min(length,start+duration)} step="any" value={end} onChange={e=>changeEnd(e.target.value)}/>}</Field></div>
    {!site&&<Field label="Desplazar inicio del fragmento">{id=><input id={id} type="range" min="0" max={Math.max(0,length-.1)} step="0.1" value={start} onChange={e=>changeStart(e.target.value)}/>}</Field>}
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
      {notification.video?<VideoClip src={notification.video} start={notification.videoStart} end={notification.videoEnd} muted={!live||!!notification.audio||notification.videoMuted} volume={notification.volume} fit={style.imageFit} autoPlay expiresAt={notification.expiresAt} duration={style.duration} style={{width:style.imageSize+'px',height:style.imageSize+'px',maxWidth:'100%',borderRadius:style.imageRadius+'px',overflow:'hidden'}}/>:image?<img className="notification-image" src={image} alt={style.layout==='image-only'?title:''} style={{width:style.imageSize+'px',height:style.imageSize+'px',objectFit:style.imageFit,borderRadius:style.imageRadius+'px'}}/>:<span className="notification-symbol"><Icon aria-hidden="true"/></span>}{style.layout!=='image-only'&&<div className="notification-copy"><strong style={{fontWeight:style.fontWeight}}>{title}</strong><p>{message}</p></div>}
    </div>
  </div>;
}

export function NotificationsOutput() {
  const { state, online } = useStudio();
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
  return <div className="notification-stage output-stage">{online && current && current.expiresAt > Date.now() && expired !== current.id && <div key={current.id}><NotificationVisual notification={current} live/><AlertAudio notification={current}/></div>}</div>;
}

export function NotificationsStudio({ tool, api, notice, connected, online }) {
  const {config,setConfig,dirty,saving,error:saveError,save:saveSettings}=useNotificationSettings(tool.config,tool.revision,api,online);
  const [uploading,setUploading] = useState('');
  const [type,setType]=useState('follow'),[preview,setPreview]=useState(0);
  const update=(key,value)=>setConfig(s=>({...s,[key]:value}));
  const updateEvent=(key,value)=>setConfig(s=>({...s,events:{...s.events,[type]:{...s.events[type],[key]:value}}}));
  const output = new URL(notificationOutputPath, window.location.origin).href;
  const event = config.events[type];
  const design = notificationDesign(config,type);
  const updateDesign = (key,value) => event.appearance ? updateEvent('appearance',{...design,[key]:value}) : update(key,value);
  const visual = { type, video:event.video, videoStart:event.videoStart, videoEnd:event.videoEnd, videoMuted:true, image:event.image, style: design, title: notificationText(event.title, example), message: notificationText(event.message, example) };
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
      if(result?.[kind]){setConfig(s=>({...s,events:{...s.events,[target]:{...s.events[target],[kind]:result[kind],[kind+'Name']:file.name.slice(0,180),...metadata,...(kind==='image'?{video:'',videoName:''}:{})}}}));notice('Archivo preparado. Guarda la notificación para usarla en el directo.');}
    } catch(error){notice(error.message);throw error;} finally{setUploading('');}
  };
  const attachURL = async (value,kind) => {
    if(!isRemoteMediaURL(value))throw new Error('Introduce una URL completa http o https, sin credenciales.');
    const target=type;setUploading(kind);
    try {
      const metadata=await inspectNotificationMedia(value,kind,design.duration);
      const parsed=new URL(value),name=(parsed.pathname.split('/').pop()||parsed.hostname).slice(0,180);

      setConfig(s=>({...s,events:{...s.events,[target]:{...s.events[target],[kind]:value,[kind+'Name']:name,...metadata,...(kind==='image'?{video:'',videoName:''}:{})}}}));
      notice('Enlace preparado. Guarda los cambios para usarlo en el directo.');
    } finally {setUploading('');}
  };
  const save=async e=>{e.preventDefault();if(await saveSettings())notice('Notificaciones guardadas en este equipo.');};
  return <div className="notifications-studio">
    <Card className="notifications-toolbar"><div><Badge className={connected ? 'success' : ''}>{connected ? 'TikTok conectado' : 'TikTok sin conectar'}</Badge><p className="help">{connected ? 'Las alertas reciben los eventos de tu LIVE.' : 'Conecta TikTok desde el navbar para recibir eventos. Puedes probar las alertas ahora.'}</p></div><div className="actions"><Button variant="outline" onClick={async () => { try { await navigator.clipboard.writeText(output); notice('Enlace de notificaciones copiado.'); } catch { notice('Enlace de notificaciones: ' + output); } }}><Copy size={15}/>Copiar enlace de alertas</Button><Button asChild variant="outline"><a href={output} target="_blank" rel="noopener noreferrer"><ExternalLink size={15}/>Abrir salida de alertas</a></Button></div></Card>
    {tool.error && <p className="notice" role="alert">{tool.error}</p>}
    <div className="notifications-grid">
      <Card className="notifications-settings"><form onSubmit={save}>
        <h2>Configura tus alertas</h2><Toggle name="enabled" label="Activar notificaciones" description="Desactivar también limpia las alertas en curso al guardar." settings={config} update={update}/>
        <div className="notification-types" role="group" aria-label="Tipo de alerta">{Object.entries(eventNames).map(([id, label]) => { const Icon = icons[id]; return <Button key={id} variant="outline" aria-pressed={type === id} onClick={() => setType(id)}><Icon size={16}/>{label}</Button>; })}</div>
        <Toggle name="enabled" label={'Mostrar: ' + eventNames[type]} settings={event} update={updateEvent}/>
        <Field label="Título de la alerta">{id => <Input id={id} value={event.title} required maxLength={100} onChange={e => updateEvent('title', e.target.value)}/>}</Field>
        <Field label="Mensaje" hint="Variables: {usuario}, {regalo} y {cantidad}. Se sustituyen con los datos del evento.">{id => <Textarea id={id} rows={3} value={event.message} maxLength={300} onChange={e => updateEvent('message', e.target.value)}/>}</Field>
        <MediaPicker kind="image" src={event.image} name={event.imageName} busy={uploading==='image'} disabled={!!uploading||!online} onURL={value=>attachURL(value,'image')} onFile={file=>upload(file,'image')} onRemove={()=>updateEvent('image','')}/>
        <MediaPicker kind="video" src={event.video} name={event.videoName} busy={uploading==='video'} disabled={!!uploading||!online} onURL={value=>attachURL(value,'video')} onFile={file=>upload(file,'video')} onRemove={()=>updateEvent('video','')}>
          {event.video&&<VideoTrimmer key={type+event.video} event={event} duration={design.duration} update={updateEvent}/>}
        </MediaPicker>
        <MediaPicker kind="audio" src={event.audio} name={event.audioName} busy={uploading==='audio'} disabled={!!uploading||!online} onFile={file=>upload(file,'audio')} onRemove={()=>updateEvent('audio','')}>
          {event.audio&&<><AudioPreview key={type+event.audio} src={event.audio} volume={event.volume??80}/><Field label={'Volumen: '+(event.volume??80)+'%'}>{id=><input id={id} type="range" min="0" max="100" value={event.volume??80} onChange={e=>updateEvent('volume',Number(e.target.value))}/>}</Field><p className="help">Se reproduce una vez y se detiene al terminar la alerta.</p></>}
        </MediaPicker>
        <Toggle name="custom" label="Diseño propio para esta alerta" description="Actívalo para personalizar este evento sin cambiar los otros." settings={{custom:!!event.appearance}} update={(_,value)=>updateEvent('appearance',value?notificationDesign(config,type):null)}/>
        <h3>{event.appearance?'Diseño de '+eventNames[type]:'Diseño compartido'}</h3><p className="help">{event.appearance?'Estos ajustes solo cambian esta alerta.':'Estos ajustes se aplican a las alertas que usan el diseño compartido.'}</p>
        <NotificationDesign design={design} update={updateDesign} resize={values=>setConfig(s=>s.events[type].appearance?{...s,events:{...s.events,[type]:{...s.events[type],appearance:{...s.events[type].appearance,...values}}}}:{...s,...values})} fonts={tool.fonts} api={api} online={online}/>
        <p className="help">Guardado automático en este equipo.</p>{saveError&&<p className="error" role="alert">{saveError}</p>}<div className="save-bar"><span className={dirty ? 'unsaved' : 'help'}>{dirty ? 'Cambios sin guardar' : 'Configuración guardada'}</span><Button type="submit" disabled={!online || saving || uploading}><Save size={15}/>{saving ? 'Guardando…' : 'Guardar notificaciones'}</Button></div>
      </form></Card>
      <div className="notifications-monitor"><Card className="notification-preview"><div className="section-heading"><h2>Vista previa</h2><Badge>DATOS DE EJEMPLO</Badge></div><div className="notification-stage"><NotificationVisual key={preview + type} notification={visual}/></div><p className="help">La vista previa muestra tus cambios sin enviarlos al directo.</p><div className="actions"><Button variant="outline" onClick={() => setPreview(n => n + 1)}>Repetir animación</Button><Button disabled={!online || uploading || !config.enabled || !event.enabled} onClick={async () => { if (await api('notifications/test', { type, config })) notice('Prueba enviada a la salida de alertas.'); }}><Play size={15}/>Enviar prueba al directo</Button></div></Card>
        <Card className="notifications-queue"><h2>Cola de alertas</h2><p className="muted">{tool.current ? `Mostrando: ${eventNames[tool.current.type]}` : 'Esperando eventos'} · {tool.queued} pendientes</p><div className="actions"><Button variant="outline" disabled={!online || !tool.current} onClick={() => api('notifications/skip')}><SkipForward size={15}/>Saltar alerta</Button><Button variant="outline" disabled={!online || (!tool.current && !tool.queued)} onClick={() => api('notifications/clear')}><Trash2 size={15}/>Vaciar alertas</Button></div></Card>
        <Card className="notifications-help"><h3>Añádelo a tu directo</h3><p className="muted">Copia el enlace de alertas y añádelo como fuente de navegador en OBS o TikTok LIVE Studio. Usa el tamaño de tu lienzo, por ejemplo 1920 × 1080 o 1080 × 1920.</p><p className="help">La salida tiene fondo transparente y permanece vacía hasta recibir una alerta. Los regalos en racha se muestran al finalizar, con su cantidad total.</p></Card>
      </div>
    </div>
  </div>;
}
