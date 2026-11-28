import {validateThemeCSS} from '../../shared/custom-themes.js';
export const defaultGifters = {enabled:true,title:'TOP GIFTERS',limit:5,width:680,fontSize:32,background:'#171b24',color:'#ffffff',accent:'#f5b942',opacity:90,borderOpacity:50,radius:20,position:'top-right',showTotal:true,style:'classic',showTitle:true,customCss:'',cssEnabled:true,rgbNames:false,animateNames:false,pulseGifts:false,metric:'gifts'};
export const giftersStyles=[['classic','Clásico'],['medals','Columna con medallas'],['compact','Compacto'],['cards','Tarjetas']];
export const giftersMetrics=[['gifts','Regalos enviados'],['diamonds','Diamantes enviados']];
export const giftersPresets={classic:{width:420,fontSize:32,color:'#ffffff'},medals:{width:400,fontSize:30,color:'#ffffff',accent:'#299cdd',background:'#222222',opacity:100,borderOpacity:0,radius:0,showTitle:false,showTotal:false},compact:{width:360,fontSize:28,color:'#ffffff',showTitle:true,showTotal:false},cards:{width:400,fontSize:30,color:'#ffffff',opacity:0,borderOpacity:0,showTitle:true,showTotal:false}};
export const giftersOutputPath='/?gifters-output=1#tiktok.studio';
export function safeAvatar(value){
  if(typeof value!=='string'||value.length>4096)return '';
  try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)&&!url.username&&!url.password?url.href:'';}catch{return '';}
}
export function validateGifters(input){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Configuración inválida');
  const value={...defaultGifters,...input},result={};
  for(const key of ['enabled','cssEnabled','showTotal','showTitle','rgbNames','animateNames','pulseGifts']){if(typeof value[key]!=='boolean')throw new Error('Estado inválido');result[key]=value[key];}
  if(!giftersStyles.some(([id])=>id===value.style))throw new Error('Estilo inválido');result.style=value.style;
  if(!giftersMetrics.some(([id])=>id===value.metric))throw new Error('Métrica inválida');result.metric=value.metric;
  result.customCss=validateThemeCSS(value.customCss);
  if(typeof value.title!=='string'||!value.title.trim()||value.title.length>80)throw new Error('Escribe un título de hasta 80 caracteres');result.title=value.title;
  for(const [key,min,max] of [['limit',1,20],['width',280,1600],['fontSize',16,96],['opacity',0,100],['borderOpacity',0,100],['radius',0,80]]){if(!Number.isInteger(value[key])||value[key]<min||value[key]>max)throw new Error('Valor inválido: '+key);result[key]=value[key];}
  for(const key of ['background','color','accent']){if(!/^#[a-f0-9]{6}$/i.test(value[key]))throw new Error('Color inválido');result[key]=value[key];}
  if(!['top-left','top-center','top-right','bottom-left','bottom-center','bottom-right'].includes(value.position))throw new Error('Posición inválida');result.position=value.position;
  return result;
}
