import { validateCustomThemes } from './custom-themes.js';
export const themes = { xp: 'Windows XP', dark: 'Estudio oscuro', neon: 'Neón', minimal: 'Minimalista' };
export function isCameraWindow(element) {
  return element.kind === 'frame' && (element.id === 'camera' || element.id.startsWith('camera-') || /^(c[aá]mara|camera|webcam)(?:\.exe)?$/i.test(element.title.trim()));
}
export const legacyLayout = {
  theme: 'xp', format: 'landscape', background: '#14223d', transparent: true,
  elements: [
    { id: 'welcome', title: 'Mi directo', text: '¡Bienvenidos al stream!', x: 5, y: 5, w: 60, h: 15, fontSize: 26, hidden: false, kind: 'text' },
    { id: 'camera', title: 'Cámara', text: '', x: 68, y: 52, w: 28, h: 40, fontSize: 22, hidden: false, kind: 'frame' },
    { id: 'social', title: 'Sígueme', text: '@tu_usuario · Gracias por estar aquí', x: 5, y: 82, w: 58, h: 12, fontSize: 20, hidden: false, kind: 'text' },
  ],
};
const element = (id, title, text, kind, x, y, w, h, fontSize=30) => ({id,title,text,kind,x,y,w,h,fontSize,hidden:false});
export const layoutTemplates = {
  gaming: { name:'Gaming vertical', description:'Cámara arriba, juego protagonista y cierre con tus redes.', elements:[
    element('welcome','En directo.exe','@tu_usuario  •  GAMING LIVE','text',5,5,84,7,34),
    element('camera','Cámara.exe','','frame',5,14,84,24),
    element('game','Juego.exe','','frame',5,40,84,37),
    element('social','Comunidad.txt','¡Sígueme y juega con nosotros!','text',5,79,84,6,28),
    element('bar','start','','taskbar',0,97.9166666667,100,2.0833333333),
  ]},
  chatting: { name:'Charlando', description:'Tu cámara en grande y una tarjeta para el tema del directo.', elements:[
    element('welcome','En directo.exe','@tu_usuario  •  HABLEMOS','text',5,5,84,7,34),
    element('camera','Cámara.exe','','frame',5,14,84,51),
    element('topic','Tema de hoy.txt','Escribe aquí el tema del directo','text',5,67,84,10,32),
    element('social','Comunidad.txt','Tu comentario forma parte del directo','text',5,79,84,6,28),
    element('bar','start','','taskbar',0,97.9166666667,100,2.0833333333),
  ]},
  gameplay: { name:'Juego en grande', description:'Más altura para el juego, con cámara compacta y tu nombre.', elements:[
    element('camera','Cámara.exe','','frame',5,6,40,17),
    element('welcome','En directo.exe','@tu_usuario\nGAMING LIVE','text',47,6,42,17,32),
    element('game','Juego.exe','','frame',5,25,84,52),
    element('social','Comunidad.txt','¡Bienvenidos al stream!','text',5,79,84,6,28),
    element('bar','start','','taskbar',0,97.9166666667,100,2.0833333333),
  ]},
};
export function createVerticalLayout(template='gaming', theme='xp') {
  if (!Object.hasOwn(layoutTemplates,template) || !Object.hasOwn(themes,theme)) throw new Error('Plantilla inválida');
  return {theme,format:'portrait',background:'#245edb',transparent:true,elements:layoutTemplates[template].elements.map(e=>({...e}))};
}
export const defaultLayout = createVerticalLayout();
export function canvasSize(layout) {
  return {width:layout.canvasWidth ?? (layout.format==='portrait'?1080:1920),height:layout.canvasHeight ?? (layout.format==='portrait'?1920:1080)};
}
export const maxBackgroundImageLength = 2000000;
export const maxIconImageLength = 120000;
export const maxLayoutImageLength = 6000000;
export const iconStyles = {theme:'Usar tema del layout',xp:'Acceso directo Windows',dark:'Oscuro',neon:'Neón',minimal:'Minimalista'};
export function createIcon(id, index=1) { return {id,name:'Acceso '+index,image:'',size:64,labelPosition:'bottom',style:'theme'}; }
export function createIconRow(id) {
  return {id,title:'Fila de iconos',text:'',kind:'icons',x:5,y:86,w:84,h:10,fontSize:20,hidden:false,gap:20,align:'center',icons:Array.from({length:6},(_,i)=>createIcon(id+'-'+i,i+1))};
}
function validRaster(image, maxLength) { return typeof image==='string' && image.length<=maxLength && (!image || /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(image)); }
export function backgroundMode(layout) { return layout.transparent ? 'transparent' : (layout.backgroundMode || (layout.backgroundImage ? 'image' : 'color')); }
export function validateLayout(input) {
  const customThemes=input?.customThemes===undefined?[]:validateCustomThemes(input.customThemes);
  if (!input || (!Object.hasOwn(themes, input.theme)&&!customThemes.some(theme=>theme.id===input.theme)) || !['landscape', 'portrait'].includes(input.format) || !/^#[0-9a-f]{6}$/i.test(input.background) || typeof input.transparent !== 'boolean' || !Array.isArray(input.elements) || input.elements.length > 30) throw new Error('Layout inválido');
  const ids = new Set();
  let imageLength=0;
  const elements = input.elements.map(e => {
    if (!e || typeof e.id !== 'string' || e.id.length > 80 || !e.id || ids.has(e.id) || typeof e.title !== 'string' || e.title.length > 80 || typeof e.text !== 'string' || e.text.length > 300 || !['text', 'frame', 'taskbar', 'icons'].includes(e.kind) || typeof e.hidden !== 'boolean') throw new Error('Elemento inválido');
    ids.add(e.id);
    for (const [key, min, max] of [['x',0,99],['y',0,99],['w',5,100],['h',e.kind==='taskbar'?1:5,100],['fontSize',10,72]]) if (!Number.isFinite(e[key]) || e[key] < min || e[key] > max) throw new Error('Dimensiones inválidas');
    if (e.x + e.w > 100.001 || e.y + e.h > 100.001) throw new Error('El elemento debe estar dentro del lienzo');
    const result=Object.fromEntries(['id','title','text','kind','hidden','x','y','w','h','fontSize'].map(k => [k,e[k]]));
    if(e.xpControls!==undefined){
      if(!e.xpControls||!['text','frame'].includes(e.kind)||!['x','y'].every(key=>Number.isFinite(e.xpControls[key])&&e.xpControls[key]>=0&&e.xpControls[key]<=1))throw new Error('Posición de controles XP inválida');
      result.xpControls={x:e.xpControls.x,y:e.xpControls.y};
      if(e.xpControls.scale!==undefined){
        if(!Number.isFinite(e.xpControls.scale)||e.xpControls.scale<0.5||e.xpControls.scale>4)throw new Error('Tamaño de controles XP inválido');
        result.xpControls.scale=e.xpControls.scale;
      }
    }
    if(e.kind==='icons'){
      if(!Array.isArray(e.icons)||e.icons.length<1||e.icons.length>12||!Number.isFinite(e.gap)||e.gap<0||e.gap>120||!['start','center','end'].includes(e.align))throw new Error('Fila de iconos inválida');
      const iconIds=new Set();
      result.icons=e.icons.map(icon=>{
        if(!icon||typeof icon.id!=='string'||!icon.id||icon.id.length>100||iconIds.has(icon.id)||typeof icon.name!=='string'||icon.name.length>60||!validRaster(icon.image,maxIconImageLength)||!Number.isFinite(icon.size)||icon.size<16||icon.size>256||!['top','bottom'].includes(icon.labelPosition)||!Object.hasOwn(iconStyles,icon.style))throw new Error('Icono inválido');
        iconIds.add(icon.id);imageLength+=icon.image.length;
        return Object.fromEntries(['id','name','image','size','labelPosition','style'].map(k=>[k,icon[k]]));
      });
      result.gap=e.gap;result.align=e.align;
    }
    return result;
  });
  const extras = {};
  if(input.canvasWidth!==undefined||input.canvasHeight!==undefined){
    for(const key of ['canvasWidth','canvasHeight']){
      if(!Number.isInteger(input[key])||input[key]<240||input[key]>7680)throw new Error('El lienzo debe medir entre 240 y 7680 píxeles por lado');
      extras[key]=input[key];
    }
  }
  if(input.customThemes!==undefined)extras.customThemes=customThemes;
  if (input.backgroundMode !== undefined) {
    if (!['transparent','color','image'].includes(input.backgroundMode)) throw new Error('Tipo de fondo inválido');
    extras.backgroundMode = input.backgroundMode;
  }
  if (input.backgroundFit !== undefined) {
    if (!['cover','contain','stretch'].includes(input.backgroundFit)) throw new Error('Ajuste de imagen inválido');
    extras.backgroundFit = input.backgroundFit;
  }
  if (input.backgroundImage !== undefined) {
    const image=input.backgroundImage;
    if (!validRaster(image,maxBackgroundImageLength)) throw new Error('Imagen de fondo inválida o demasiado grande');
    extras.backgroundImage=image;
    imageLength+=image.length;
  }
  if(imageLength>maxLayoutImageLength)throw new Error('El conjunto de imágenes es demasiado grande. Quita algunas imágenes.');
  return { theme: input.theme, format: input.format, background: input.background, transparent: input.transparent, elements, ...extras };
}
