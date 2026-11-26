import {validateThemeCSS} from '../../shared/custom-themes.js';
export const defaultAuction = {enabled:true,title:'SUBASTA EN VIVO',itemTitle:'Lote sorpresa',limit:5,duration:120,width:560,fontSize:30,background:'#16121f',color:'#ffffff',accent:'#ffb020',opacity:90,borderOpacity:55,radius:20,position:'top-right',showTitle:true,showItem:true,showTimer:true,showTotal:true,showRanking:true,style:'classic',customCss:'',rgbNames:false,pulseLeader:true};
export const auctionStyles=[['classic','Clásico'],['spotlight','Foco'],['compact','Compacto']];
export const auctionPresets={classic:{width:560,fontSize:30,color:'#ffffff'},spotlight:{width:520,fontSize:32,color:'#ffffff',accent:'#ffb020',background:'#120f1c',opacity:100,borderOpacity:0,radius:24,showRanking:true},compact:{width:380,fontSize:26,color:'#ffffff',showRanking:false,showTotal:false}};
export const auctionOutputPath='/?auction-output=1#tiktok.studio';
export function safeAvatar(value){
  if(typeof value!=='string'||value.length>4096)return '';
  try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)&&!url.username&&!url.password?url.href:'';}catch{return '';}
}
export function validateAuction(input){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Configuración inválida');
  const value={...defaultAuction,...input},result={};
  for(const key of ['enabled','showTitle','showItem','showTimer','showTotal','showRanking','rgbNames','pulseLeader']){if(typeof value[key]!=='boolean')throw new Error('Estado inválido');result[key]=value[key];}
  if(!auctionStyles.some(([id])=>id===value.style))throw new Error('Estilo inválido');result.style=value.style;
  result.customCss=validateThemeCSS(value.customCss);
  for(const [key,label,max] of [['title','título',80],['itemTitle','título del lote',80]]){if(typeof value[key]!=='string'||!value[key].trim()||value[key].length>max)throw new Error(`Escribe un ${label} de hasta ${max} caracteres`);result[key]=value[key];}
  for(const [key,min,max] of [['limit',1,10],['duration',0,7200],['width',280,1600],['fontSize',16,96],['opacity',0,100],['borderOpacity',0,100],['radius',0,80]]){if(!Number.isInteger(value[key])||value[key]<min||value[key]>max)throw new Error('Valor inválido: '+key);result[key]=value[key];}
  for(const key of ['background','color','accent']){if(!/^#[a-f0-9]{6}$/i.test(value[key]))throw new Error('Color inválido');result[key]=value[key];}
  if(!['top-left','top-center','top-right','bottom-left','bottom-center','bottom-right'].includes(value.position))throw new Error('Posición inválida');result.position=value.position;
  return result;
}
