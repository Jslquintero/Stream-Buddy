import { downloadFile } from './download-file.js';
import { validateThemeCSS } from '../../../shared/custom-themes';

export async function readThemeFile(file) {
  if(!/\.css$/i.test(file.name))throw new Error('Selecciona un archivo .css.');
  if(file.size>80000)throw new Error('El archivo CSS es demasiado grande. El editor admite 20 000 caracteres.');
  const text=await new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(String(reader.result));
    reader.onerror=()=>reject(new Error('No se pudo leer el archivo CSS.'));
    reader.readAsText(file,'UTF-8');
  });
  const css=validateThemeCSS(text.replace(/^\uFEFF/,''));
  const name=file.name.replace(/\.css$/i,'').trim().slice(0,60)||'Tema importado';
  return {id:'custom-'+crypto.randomUUID(),name,css};
}

export function downloadThemeCSS(theme) {
  const css=validateThemeCSS(theme.css);
  const slug=theme.name.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60)||'tema';
  downloadFile('overlay-'+slug+'.css', css, 'text/css;charset=utf-8');
}
