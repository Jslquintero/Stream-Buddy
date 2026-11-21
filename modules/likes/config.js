import {validateThemeCSS} from '../../shared/custom-themes.js';
export const defaultLikes = {enabled:true,title:'TOP LIKES',limit:5,width:680,fontSize:32,background:'#171b24',color:'#ffffff',accent:'#ff668e',opacity:90,borderOpacity:50,radius:20,position:'top-right',showTotal:true,style:'classic',showTitle:true,customCss:'',rgbNames:false,animateNames:false,pulseHearts:false};
export const likesStyles=[['classic','Clásico'],['medals','Columna con medallas'],['compact','Compacto'],['cards','Tarjetas']];
export const likesPresets={classic:{width:420,fontSize:32,color:'#ffffff'},medals:{width:400,fontSize:30,color:'#ffffff',accent:'#299cdd',background:'#222222',opacity:100,borderOpacity:0,radius:0,showTitle:false,showTotal:false},compact:{width:360,fontSize:28,color:'#ffffff',showTitle:true,showTotal:false},cards:{width:400,fontSize:30,color:'#ffffff',opacity:0,borderOpacity:0,showTitle:true,showTotal:false}};
export const likesOutputPath='/?likes-output=1#tiktok.studio';
export function safeAvatar(value){
  if(typeof value!=='string'||value.length>4096)return '';
  try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)&&!url.username&&!url.password?url.href:'';}catch{return '';}
}
export function validateLikes(input){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Configuración inválida');
  const value={...defaultLikes,...input},result={};
  for(const key of ['enabled','showTotal','showTitle','rgbNames','animateNames','pulseHearts']){if(typeof value[key]!=='boolean')throw new Error('Estado inválido');result[key]=value[key];}
  if(!likesStyles.some(([id])=>id===value.style))throw new Error('Estilo inválido');result.style=value.style;
  result.customCss=validateThemeCSS(value.customCss);
  if(typeof value.title!=='string'||!value.title.trim()||value.title.length>80)throw new Error('Escribe un título de hasta 80 caracteres');result.title=value.title;
  for(const [key,min,max] of [['limit',1,20],['width',280,1600],['fontSize',16,96],['opacity',0,100],['borderOpacity',0,100],['radius',0,80]]){if(!Number.isInteger(value[key])||value[key]<min||value[key]>max)throw new Error('Valor inválido: '+key);result[key]=value[key];}
  for(const key of ['background','color','accent']){if(!/^#[a-f0-9]{6}$/i.test(value[key]))throw new Error('Color inválido');result[key]=value[key];}
  if(!['top-left','top-center','top-right','bottom-left','bottom-center','bottom-right'].includes(value.position))throw new Error('Posición inválida');result.position=value.position;
  return result;
}
