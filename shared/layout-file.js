import { validateLayout } from './layout.js';

export function parseLayoutFile(text) {
  const input=JSON.parse(text.replace(/^\uFEFF/,''));
  if(input?.type==='live-studio-layout'){
    if(input.version!==1)throw new Error('Versión de archivo no compatible');
    return {name:typeof input.name==='string'?input.name.trim().slice(0,80):'',document:validateLayout(input.document)};
  }
  return {name:'',document:validateLayout(input)};
}
export function serializeLayoutFile(name,document) {
  return JSON.stringify({type:'live-studio-layout',version:1,name,document:validateLayout(document)},null,2);
}
