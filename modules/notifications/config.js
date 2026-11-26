export const eventNames = { follow: 'Nuevo seguidor', gift: 'Regalo', share: 'Compartido', superfan: 'Super Fan' };
export const notificationAnimations = { none:'Sin animación', slide:'Deslizar desde abajo', 'slide-down':'Deslizar desde arriba', 'slide-left':'Entrar desde la izquierda', 'slide-right':'Entrar desde la derecha', fade:'Desvanecer', zoom:'Zoom', bounce:'Rebote', flip:'Giro', roll:'Rodar', pop:'Aparecer con impulso' };
const localMedia = {
  image: /^\/notification-assets\/[a-f0-9]{64}\.(png|gif|jpg|webp)$/,
  video: /^\/notification-assets\/[a-f0-9]{64}\.(mp4|webm)$/,
  audio: /^\/notification-assets\/[a-f0-9]{64}\.(mp3|wav|ogg)$/,
};
export function isLocalNotificationAsset(kind, path) {
  return typeof path === 'string' && localMedia[kind].test(path);
}
export const designExtras = { layout: 'left', imageSize: 96, imageRadius: 0, imageFit: 'contain', width: 680, padding: 24, backgroundOpacity: 100, borderOpacity:100, animationSpeed:500, borderWidth: 2, shadow: true, textShadow: false, fontFamily: 'sans', textAlign: 'left', fontWeight: '700' };
export const defaultNotifications = {
  ...designExtras,
  enabled: true, duration: 6, position: 'top-center', animation: 'slide',
  background: '#191a1e', color: '#ffffff', accent: '#b9f678', fontSize: 28, radius: 18,
  events: {
    superfan: { enabled: true, title: '¡Nuevo Super Fan!', message: '¡Gracias, {usuario}, por convertirte en Super Fan!' },
    follow: { enabled: true, title: '¡Gracias por seguirme!', message: '{usuario} se une a la comunidad.' },
    gift: { enabled: true, title: '¡Gracias por tu regalo!', message: '{usuario} envió {cantidad} × {regalo}.' },
    share: { enabled: true, title: '¡Gracias por compartir!', message: '{usuario} compartió el directo.' },
  },
};
for (const event of Object.values(defaultNotifications.events)) { event.image = ''; event.appearance = null; event.audio = ''; event.volume = 80; event.imageName = ''; event.audioName = ''; event.audioStart = 0; event.audioEnd = 0; event.audioDuration = 0; }
for(const event of Object.values(defaultNotifications.events)){event.video='';event.videoName='';event.videoStart=0;event.videoEnd=6;event.videoDuration=6;event.videoMuted=true;}
export function notificationDesign(config, type) {
  const merged = { ...designExtras, ...config, ...config.events?.[type]?.appearance };
  return Object.fromEntries([...Object.keys(designExtras),'duration','position','animation','background','color','accent','fontSize','radius'].map(key => [key,merged[key]]));
}
export function migrateNotifications(value) {
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Configuración local inválida');
  const merged={...defaultNotifications,...value,events:{}};
  for(const type of Object.keys(eventNames)){
    merged.events[type]={...defaultNotifications.events[type],...value?.events?.[type]};
    const event = merged.events[type];
    for (const kind of ['image', 'video']) {
      if (/^https?:\/\//i.test(event[kind])) {
        event[kind] = '';
        event[kind + 'Name'] = '';
      }
    }
    // Older configurations displayed the video when both visual assets were present.
    if (merged.events[type].video) {
      merged.events[type].image = '';
      merged.events[type].imageName = '';
    }
    if(merged.events[type].appearance)merged.events[type].appearance={...notificationDesign(merged),...merged.events[type].appearance};
  }
  return validateNotifications(merged);
}
export function validateNotifications(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Configuración de notificaciones inválida');
  const result = validateDesign(value);
  if (typeof value.enabled !== 'boolean') throw new Error('Estado de notificaciones inválido');
  result.enabled = value.enabled;
  result.events = {};
  for (const type of Object.keys(eventNames)) {
    const event = value.events?.[type];
    if (!event || typeof event.enabled !== 'boolean' || typeof event.title !== 'string' || !event.title.trim() || event.title.length > 100 || typeof event.message !== 'string' || event.message.length > 300) throw new Error('Revisa los textos de ' + eventNames[type]);
    const image = event.image ?? '';
    if (typeof image !== 'string' || (image && !isLocalNotificationAsset('image', image))) throw new Error('Imagen de alerta inválida');
    const audio = event.audio ?? '', volume = event.volume ?? 80;
    if (typeof audio !== 'string' || (audio && !isLocalNotificationAsset('audio', audio))) throw new Error('Audio de alerta inválido');
    if (!Number.isFinite(volume) || volume<0 || volume>100) throw new Error('Volumen inválido');
    const audioStart = event.audioStart ?? 0, audioEnd = event.audioEnd ?? 0, audioDuration = event.audioDuration ?? 0;
    if (![audioStart, audioEnd, audioDuration].every(Number.isFinite) || [audioStart, audioEnd, audioDuration].some(value => value < 0 || value > 86400)) throw new Error('Recorte de audio inválido');
    if (audioEnd > 0 && audioEnd <= audioStart) throw new Error('El fin del audio debe ser posterior al inicio');
    if (audioDuration > 0 && audioEnd > audioDuration + .001) throw new Error('El fin del audio supera la duración del archivo');
    if (audioDuration > 0 && audioStart >= audioDuration) throw new Error('El inicio del audio supera la duración del archivo');
    if (audioEnd > 0 && audioEnd - audioStart > 30.001) throw new Error('Elige un fragmento de audio de hasta 30 segundos');
    const imageName = event.imageName ?? '', audioName = event.audioName ?? '';
    if ([imageName,audioName].some(name=>typeof name!=='string'||name.length>180)) throw new Error('Nombre de archivo inválido');
    result.events[type] = { enabled: event.enabled, title: event.title, message: event.message, image, audio, volume, imageName, audioName, audioStart, audioEnd, audioDuration, appearance: event.appearance == null ? null : validateDesign(event.appearance) };
    const video=event.video??'',videoName=event.videoName??'',videoStart=event.videoStart??0,videoEnd=event.videoEnd??6,videoDuration=event.videoDuration??6,videoMuted=event.videoMuted??true;
    if(typeof video!=='string'||(video&&!isLocalNotificationAsset('video', video)))throw new Error('Video inválido');
    if (video && image) throw new Error('Elige una imagen o un video para ' + eventNames[type]);
    if(typeof videoName!=='string'||videoName.length>180||typeof videoMuted!=='boolean')throw new Error('Opciones de video inválidas');
    if(![videoStart,videoEnd,videoDuration].every(Number.isFinite)||videoStart<0||videoEnd<=videoStart||videoEnd-videoStart>30.001||videoEnd>videoDuration||videoDuration>86400)throw new Error('Elige un fragmento de video de hasta 30 segundos dentro del archivo');
    Object.assign(result.events[type],{video,videoName,videoStart,videoEnd,videoDuration,videoMuted});
  }
  return result;
}
function validateDesign(input) {
  const value = { ...designExtras, ...input }, result = {};
  for (const [key, min, max] of [['duration',2,30],['fontSize',16,96],['radius',0,80],['imageSize',32,400],['imageRadius',0,200],['width',200,1200],['padding',0,80],['backgroundOpacity',0,100],['borderOpacity',0,100],['animationSpeed',100,2000],['borderWidth',0,12]]) {
    if (!Number.isFinite(value[key]) || value[key] < min || value[key] > max) throw new Error('Valor inválido: ' + key);
    result[key] = value[key];
  }
  for (const key of ['background','color','accent']) {
    if (typeof value[key] !== 'string' || !/^#[0-9a-f]{6}$/i.test(value[key])) throw new Error('Color inválido');
    result[key] = value[key];
  }
  for (const [key, options] of [['position',['top-left','top-center','top-right','bottom-left','bottom-center','bottom-right']],['animation',Object.keys(notificationAnimations)],['layout',['left','right','top','bottom','image-only']],['imageFit',['contain','cover']],['textAlign',['left','center','right']],['fontWeight',['400','600','700','900']]]) {
    if (!options.includes(value[key])) throw new Error('Opción inválida: ' + key);
    result[key] = value[key];
  }
  if(!['sans','serif','mono','arial','georgia','verdana','trebuchet','impact','courier'].includes(value.fontFamily)&&!/^google:[a-f0-9]{24}$/.test(value.fontFamily))throw new Error('Fuente inválida');
  result.fontFamily=value.fontFamily;
  if (typeof value.shadow !== 'boolean') throw new Error('Sombra inválida');
  result.shadow = value.shadow;
  if (typeof value.textShadow !== 'boolean') throw new Error('Sombra del texto inválida');
  result.textShadow = value.textShadow;
  return result;
}
export function notificationText(template, data = {}) {
  const values = { usuario: String(data.user || 'Tu comunidad').slice(0,80), regalo: String(data.gift || 'Rosa').slice(0,80), cantidad: String(data.count || 1).slice(0,8) };
  return template.replace(/\{(usuario|regalo|cantidad)\}/g, (_, key) => values[key]);
}
export const notificationOutputPath = '/?notifications-output=1#tiktok.studio';
