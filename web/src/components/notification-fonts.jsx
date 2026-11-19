import { useEffect, useState } from 'react';
import { Button, Input } from './ui';
import { Field } from './fields';
export const systemFonts=[['sans','Sans serif'],['serif','Serif'],['mono','Monoespaciada'],['arial','Arial'],['georgia','Georgia'],['verdana','Verdana'],['trebuchet','Trebuchet MS'],['impact','Impact'],['courier','Courier New']];
export function notificationFontStack(value){
  if(/^google:[a-f0-9]{24}$/.test(value))return '"GoogleFont-'+value.slice(7)+'", sans-serif';
  return {sans:'Arial, sans-serif',serif:'Georgia, serif',mono:'Consolas, monospace',arial:'Arial, sans-serif',georgia:'Georgia, serif',verdana:'Verdana, sans-serif',trebuchet:'"Trebuchet MS", sans-serif',impact:'Impact, sans-serif',courier:'"Courier New", monospace'}[value]||'Arial, sans-serif';
}
export function NotificationFontResource({family}){
  useEffect(()=>{
    if(!/^google:[a-f0-9]{24}$/.test(family))return;
    const id='notification-font-'+family.slice(7);if(document.getElementById(id))return;
    const link=document.createElement('link');link.id=id;link.rel='stylesheet';link.href='/notification-fonts/'+family.slice(7)+'.css';document.head.append(link);
  },[family]);return null;
}
export function NotificationFonts({fonts,api,select,online}){
  const [name,setName]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  return <div className="notification-font-installer"><h4>Instalar desde Google Fonts</h4><p className="help">Se descarga a este estudio y queda disponible sin Internet. No modifica las fuentes de Windows.</p><Field label="Nombre de la familia">{id=><Input id={id} value={name} onChange={e=>setName(e.target.value)} placeholder="Por ejemplo, Montserrat" list="google-font-suggestions"/>}</Field><datalist id="google-font-suggestions">{['Roboto','Montserrat','Poppins','Oswald','Lato','Nunito','Bebas Neue','Playfair Display','Pacifico'].map(font=><option key={font} value={font}/>)}</datalist><Button variant="outline" disabled={!online||busy||fonts?.installing||!name.trim()} onClick={async()=>{setBusy(true);setError('');try{const result=await api('notifications/fonts/install',{name:name.trim()},{throwOnError:true});if(result?.id){select('google:'+result.id);setName('');}}catch(e){setError(e.message);}finally{setBusy(false);}}}>{busy||fonts?.installing?'Instalando fuente…':'Instalar y seleccionar'}</Button>{error&&<p className="error" role="alert">{error}</p>}</div>;
}
