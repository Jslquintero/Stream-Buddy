import { DownloadButton } from './ui/download-button';
import { FilePicker } from './ui/file-picker';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, Input } from './ui';
import { baseThemeCSS, maxCustomThemes, validateThemeCSS } from '../../../shared/custom-themes';
import baseCSS from './custom-theme-base.css?raw';
import { readThemeFile, downloadThemeCSS } from '../lib/theme-files';

export function CustomThemeSurface({ css, children }) {
  const host=useRef(null),[root,setRoot]=useState(null);
  useLayoutEffect(()=>{setRoot(host.current.shadowRoot||host.current.attachShadow({mode:'open'}));},[]);
  return <div ref={host} className="custom-theme-host">{root&&createPortal(<><style>{baseCSS}</style><style data-custom-css>{css}</style><div className="overlay-root">{children}</div></>,root)}</div>;
}
export function ThemeSurface({ theme, children }) { return theme?<CustomThemeSurface css={theme.css}>{children}</CustomThemeSurface>:children; }

function ThemeCodeEditor({ theme, update }) {
  const [code,setCode]=useState(theme.css),[error,setError]=useState('');
  const lastApplied=useRef(theme.css);
  useEffect(()=>{if(theme.css!==lastApplied.current){setCode(theme.css);lastApplied.current=theme.css;setError('');}},[theme.css]);
  useEffect(()=>{
    if(code===lastApplied.current)return;
    const timer=setTimeout(()=>{
      try{validateThemeCSS(code);setError('');lastApplied.current=code;update({css:code});}
      catch(e){setError(e.message);}
    },300);
    return ()=>clearTimeout(timer);
  },[code,update]);
  useEffect(()=>{
    if(code===theme.css)return;
    const protect=event=>{event.preventDefault();event.returnValue='';};
    window.addEventListener('beforeunload',protect);
    return ()=>window.removeEventListener('beforeunload',protect);
  },[code,theme.css]);
  return <div className="theme-code-editor"><label>Nombre del tema<Input maxLength={60} value={theme.name} onChange={e=>update({name:e.target.value||'Mi tema'})}/></label><label>CSS del overlay<textarea className="input css-source" spellCheck={false} value={code} maxLength={20000} onChange={e=>setCode(e.target.value)} rows={22}/></label>
    {error?<p className="error" role="alert">{error} El CSS con errores no se aplica ni se guarda.</p>:<p className="help">Vista previa en vivo. El CSS válido se guarda automáticamente y se aplica también a la salida.</p>}
    <div className="actions"><DownloadButton onClick={()=>{try{downloadThemeCSS({name:theme.name,css:code});}catch(e){setError(e.message);}}}>Exportar CSS</DownloadButton><Button size="sm" variant="outline" onClick={()=>setCode(baseThemeCSS)}>Restablecer plantilla CSS</Button></div>
    <details><summary>Selectores disponibles</summary><p className="help">:host · .layout-element · .layout-title · .layout-content · .frame · .taskbar · .layout-icon-row · .row-icon-picture · .row-icon-name. Puedes usar variables CSS, @media, @supports y @keyframes. El CSS queda aislado del panel.</p></details>
  </div>;
}

export function CustomThemeEditor({ document, change, preview }) {
  const [importing,setImporting]=useState(false),[fileMessage,setFileMessage]=useState(''),[fileError,setFileError]=useState('');
  const library=document.customThemes||[],active=library.find(t=>t.id===document.theme);
  const create=source=>{
    const theme={id:'custom-'+crypto.randomUUID(),name:source?(source.name+' (copia)').slice(0,60):'Mi tema '+(library.length+1),css:source?.css||baseThemeCSS};
    change({theme:theme.id,customThemes:[...library,theme]});
  };
  const importCSS=async file => {
    setImporting(true);setFileError('');setFileMessage('');
    try{
      const theme=await readThemeFile(file);
      change(current=>{
        const themes=current.customThemes||[];
        if(themes.length>=maxCustomThemes)throw new Error('La biblioteca ya tiene 20 temas. Elimina uno antes de importar.');
        return {theme:theme.id,customThemes:[...themes,theme]};
      });
      setFileMessage('Tema importado: '+theme.name+'. Se guardará automáticamente.');
    }catch(error){setFileError(error.message);}finally{setImporting(false);}
  };
  return <section className="custom-theme-editor"><div className="section-heading"><div><h3>Temas con CSS</h3><p className="help">Crea un overlay a partir de una plantilla editable.</p></div><div className="actions"><DownloadButton onClick={()=>{try{downloadThemeCSS({name:'plantilla-base',css:baseThemeCSS});}catch(error){setFileError(error.message);}}}>Descargar plantilla</DownloadButton><FilePicker label={importing?'Importando…':'Importar CSS'} inputLabel="Archivo de tema CSS" accept=".css,text/css" disabled={importing||library.length>=maxCustomThemes} onFile={importCSS}/><Button size="sm" variant="outline" disabled={library.length>=maxCustomThemes} onClick={()=>create()}>+ Crear tema CSS</Button></div></div>
    {fileError&&<p className="error" role="alert">{fileError}</p>}{fileMessage&&<p className="help" role="status">{fileMessage}</p>}
    {library.length>0&&<div className="custom-theme-list">{library.map(theme=><button key={theme.id} className={theme.id===document.theme?'active':''} onClick={()=>change({theme:theme.id})}>{theme.name}</button>)}</div>}
    {active&&<><div className="theme-editing-grid"><ThemeCodeEditor key={active.id} theme={active} update={patch=>change({customThemes:library.map(t=>t.id===active.id?{...t,...patch}:t)})}/><div className="theme-live-preview"><h4>Vista previa de la salida</h4><div className={'theme-preview-stage '+document.format}>{preview}</div><p className="help">Mismos elementos y proporciones que la salida del directo.</p></div></div><div className="actions"><Button size="sm" variant="outline" disabled={library.length>=maxCustomThemes} onClick={()=>create(active)}>Duplicar tema</Button><Button size="sm" variant="destructive" onClick={()=>change({theme:'dark',customThemes:library.filter(t=>t.id!==active.id)})}>Eliminar tema CSS</Button></div></>}
  </section>;
}
