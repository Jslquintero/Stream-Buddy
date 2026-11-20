import {useRef,useState} from 'react';
import {Button,Card} from './ui';
import {Download,Upload,Plus,Copy,ExternalLink} from 'lucide-react';
import {canvasSize} from '../../../shared/layout';
import {parseLayoutFile,serializeLayoutFile} from '../../../shared/layout-file';
import {layoutOutputURL} from '../../../shared/layout-url';

export function LayoutLibrary({document,tool,api,notice,open,compositionId,busy,preview}) {
  const [name,setName]=useState(''),[working,setWorking]=useState(false);
  const fileInput=useRef(null);
  const current=tool.compositions?.find(item=>item.id===compositionId);
  const create=async()=>{
    setWorking(true);
    try{const result=await api('layout/create',{name,document});if(result){setName('');notice('Composición guardada en Mis composiciones.');}}
    finally{setWorking(false);}
  };
  const importFile=async event=>{
    const file=event.target.files?.[0];event.target.value='';if(!file)return;
    setWorking(true);
    try{
      if(file.size>8000000)throw new Error('El archivo supera 8 MB.');
      const text=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('No se pudo leer el archivo'));reader.readAsText(file);});
      const imported=parseLayoutFile(text);
      const result=await api('layout/create',{name:imported.name||file.name.replace(/\.json$/i,'').slice(0,80)||'Layout importado',document:imported.document});
      if(result)notice('Layout importado en Mis composiciones.');
    }catch(error){notice(error.message);}finally{setWorking(false);}
  };
  const exportFile=()=>{
    try{
      const title=current?.name||name.trim()||'Layout principal';
      const url=URL.createObjectURL(new Blob([serializeLayoutFile(title,document)],{type:'application/json'}));
      const link=window.document.createElement('a');link.href=url;link.download=(title.replace(/[^\p{L}\p{N}_-]/gu,'-')||'layout')+'.json';
      window.document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch(error){notice(error.message);}
  };
  const entries=[{id:null,name:'Layout principal',document:tool.document},...(tool.compositions||[])];
  return <Card className="layout-library">
    <div className="library-heading"><div><p className="eyebrow">TU BIBLIOTECA</p><h3>Mis composiciones</h3><p className="help">Elige una composición para editarla. Cada una conserva su propia salida.</p></div><div className="actions"><Button variant="outline" disabled={busy||working} onClick={exportFile}><Download size={14}/>Exportar layout</Button><Button variant="outline" disabled={working||busy} onClick={()=>fileInput.current?.click()}><Upload size={14}/>Importar layout</Button></div></div>
    <input ref={fileInput} hidden type="file" accept=".json,application/json" aria-label="Archivo de layout para importar" disabled={working||busy} onChange={importFile}/>
    <div className="library-save"><label>Nombre de la composición<input className="input" value={name} maxLength={80} onChange={event=>setName(event.target.value)} placeholder={current?.name||'Mi nueva composición'}/></label><Button disabled={busy||working||!name.trim()} onClick={create}><Plus size={14}/>Guardar composición actual</Button>{current&&<Button variant="outline" disabled={working||!name.trim()} onClick={async()=>{setWorking(true);try{if(await api('layout/rename',{id:compositionId,name})){setName('');notice('Nombre actualizado.');}}finally{setWorking(false);}}}>Renombrar</Button>}</div>
    <div className="library-grid">{entries.map(item=>{
      const active=(item.id||undefined)===compositionId,layout=active?document:item.document;
      const {width,height}=canvasSize(layout);
      const url=layoutOutputURL(window.location.href,item.id);
      return <article className={'library-composition'+(active?' is-active':'')} key={item.id||'principal'}>
        <button className="library-composition-open" aria-label={'Editar '+item.name} aria-current={active?'true':undefined} onClick={()=>open?.(item.id?'layout:'+item.id:'layout')}>
          <span className="library-thumbnail" aria-hidden="true">{preview?.(layout)}</span>
          <span className="library-composition-info"><span className="library-status">{active?'EN EDICIÓN':item.id?'GUARDADA':'PRINCIPAL'}</span><strong>{item.name}</strong><small>{width} × {height} · {height>width?'Vertical':'Horizontal'}</small><b>Editar composición →</b></span>
        </button>
        <div className="library-composition-actions"><Button size="sm" variant="ghost" onClick={async()=>{try{await navigator.clipboard.writeText(url);notice('Enlace de '+item.name+' copiado.');}catch{notice('Salida: '+url);}}}><Copy size={13}/>Copiar salida</Button><Button asChild size="sm" variant="ghost"><a href={url} target="_blank" rel="noreferrer"><ExternalLink size={13}/>Ver salida</a></Button></div>
      </article>;
    })}</div>
    <p className="help">Usa los enlaces para emitir varios layouts a la vez. Los archivos incluyen imágenes y temas. Hasta 20 composiciones.</p>
  </Card>;
}
