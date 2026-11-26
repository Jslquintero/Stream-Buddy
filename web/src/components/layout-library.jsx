import { downloadFile } from '../lib/download-file';
import { DownloadButton } from './ui/download-button';
import { FilePicker } from './ui/file-picker';
import { OutputLinks } from './output-controls';
import {useState} from 'react';
import { Button, Input } from './ui';
import {Pencil, Plus, Trash2} from 'lucide-react';
import {canvasSize, themes} from '../../../shared/layout';
import {parseLayoutFile,serializeLayoutFile} from '../../../shared/layout-file';
import {layoutOutputURL} from '../../../shared/layout-url';

const themeName = layout => themes[layout.theme] || layout.customThemes?.find(theme => theme.id === layout.theme)?.name || 'Tema personalizado';

export function LayoutLibrary({document,tool,api,notice,open,compositionId,busy,preview}) {
  const [name,setName]=useState(''),[working,setWorking]=useState(false);
  const [management, setManagement] = useState(null);
  const current=tool.compositions?.find(item=>item.id===compositionId);
  const create=async()=>{
    if (!name.trim() || working) return;
    setWorking(true);
    try{const result=await api('layout/create',{name,document});if(result){setName('');notice('Composición guardada en Mis composiciones.');}}
    finally{setWorking(false);}
  };
  const importFile=async file => {
    setWorking(true);
    try{
      if(file.size>8000000)throw new Error('El archivo supera 8 MB.');
      const text=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('No se pudo leer el archivo'));reader.readAsText(file);});
      const imported=parseLayoutFile(text);
      const result=await api('layout/create',{name:imported.name||file.name.replace(/\.json$/i,'').slice(0,80)||'Layout importado',document:imported.document});
      if(result)notice('Layout importado en Mis composiciones.');
    }catch(error){notice(error.message,{type:'error'});}finally{setWorking(false);}
  };
  const exportFile=()=>{
    try{
      const title=current?.name||name.trim()||'Layout principal';
      const filename = (title.replace(/[^\p{L}\p{N}_-]/gu,'-')||'layout')+'.json';
      downloadFile(filename, serializeLayoutFile(title,document), 'application/json');
    }catch(error){notice(error.message,{type:'error'});}
  };
  const manage = async (event, item) => {
    event.preventDefault();
    const renaming = management.action === 'rename';
    const nextName = management.name.trim();
    if (working || (renaming && (!nextName || nextName === item.name))) return;
    setWorking(true);
    try {
      const result = await api(renaming ? 'layout/rename' : 'layout/delete', renaming ? { id: item.id, name: nextName } : { id: item.id });
      if (result) {
        setManagement(null);
        notice(renaming ? 'Nombre actualizado.' : 'Composición eliminada.');
      }
    } finally {
      setWorking(false);
    }
  };
  const entries=[{id:null,name:'Layout principal',document:tool.document},...(tool.compositions||[])];
  return <div className="layout-library" aria-labelledby="layout-library-title">
    <header className="layout-library-head">
      <div>
        <p className="eyebrow">TU BIBLIOTECA</p>
        <h2 id="layout-library-title">Mis composiciones</h2>
        <p className="help">Elige una escena para editarla. Cada composición conserva su propio documento y enlace de salida.</p>
      </div>
      <div className="layout-library-tools">
        <DownloadButton disabled={busy||working} onClick={exportFile}>Exportar layout</DownloadButton>
        <FilePicker label="Importar layout" inputLabel="Archivo de layout para importar" accept=".json,application/json" disabled={working||busy} onFile={importFile}/>
      </div>
    </header>
    <form className="library-save layout-library-save" onSubmit={event=>{event.preventDefault();void create();}}>
      <label>Guardar la escena actual como<Input value={name} maxLength={80} onChange={event=>setName(event.target.value)} placeholder={current?.name||'Mi nueva composición'}/></label>
      <Button type="submit" disabled={busy||working||!name.trim()}><Plus size={14}/>Guardar composición actual</Button>
    </form>
    <div className="library-grid layout-library-grid">{entries.map(item=>{
      const active=(item.id||undefined)===compositionId,layout=active?document:item.document;
      const {width,height}=canvasSize(layout);
      const url=layoutOutputURL(window.location.href,item.id);
      const action = management?.id === item.id ? management.action : null;
      return <article className={'library-composition layout-composition'+(active?' is-active':'')} key={item.id||'principal'}>
        <button type="button" className="layout-composition-open" aria-label={'Editar '+item.name} aria-current={active?'true':undefined} onClick={()=>open?.(item.id?'layout:'+item.id:'layout')}>
          <span className={'library-thumbnail layout-composition-thumb '+(height>width?'is-portrait':'is-landscape')} aria-hidden="true">{preview?.(layout)}</span>
          <span className="layout-composition-info">
            <span className="layout-composition-status">{active?'EN EDICIÓN':item.id?'GUARDADA':'PRINCIPAL'}</span>
            <strong>{item.name}</strong>
            <small>{width} × {height} · {themeName(layout)}</small>
            <span className="layout-composition-meta">{layout.elements?.length??0} {(layout.elements?.length??0)===1?'elemento':'elementos'}</span>
            <b>Editar escena →</b>
          </span>
        </button>
        <div className="layout-composition-actions">
          <OutputLinks notice={notice} url={url} message={'Enlace de '+item.name+' copiado.'} fallback="Salida" openLabel="Ver salida" iconSize={13} size="sm" variant="ghost"/>
          {item.id && !action && <>
            <Button size="icon" variant="ghost" title="Renombrar escena" aria-label={'Renombrar '+item.name} disabled={working} onClick={() => setManagement({id: item.id, action: 'rename', name: item.name})}><Pencil size={13}/></Button>
            <Button size="icon" variant="destructive" title="Eliminar escena" aria-label={'Eliminar '+item.name} disabled={working} onClick={() => setManagement({id: item.id, action: 'delete', name: item.name})}><Trash2 size={13}/></Button>
          </>}
        </div>
        {item.id && action && <form className="library-composition-form layout-composition-form" onSubmit={event => manage(event, item)}>
          {action === 'rename'
            ? <label>Nuevo nombre<Input autoFocus value={management.name} maxLength={80} disabled={working} onChange={event => setManagement({...management, name: event.target.value})}/></label>
            : <p className="help" role="alert">¿Eliminar «{item.name}»? Su enlace de salida dejará de funcionar.</p>}
          <div className="layout-composition-form-actions">
            {action === 'rename'
              ? <Button type="submit" size="sm" disabled={working || !management.name.trim() || management.name.trim() === item.name}>Guardar nombre</Button>
              : <Button type="submit" size="sm" variant="destructive" disabled={working}>Confirmar eliminación</Button>}
            <Button type="button" size="sm" variant="outline" disabled={working} onClick={() => setManagement(null)}>Cancelar</Button>
          </div>
        </form>}
      </article>;
    })}</div>
    <p className="help layout-library-foot">Hasta 20 composiciones. Los archivos exportados incluyen imágenes y temas. En TikTok LIVE Studio, crea una fuente de enlace nueva por escena y pega la salida de su composición.</p>
  </div>;
}
