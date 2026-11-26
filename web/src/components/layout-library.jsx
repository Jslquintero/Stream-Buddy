import { downloadFile } from '../lib/download-file';
import { DownloadButton } from './ui/download-button';
import { FilePicker } from './ui/file-picker';
import { OutputLinks } from './output-controls';
import {useState} from 'react';
import { Button, Card, Input } from './ui';
import {Pencil, Plus, Trash2} from 'lucide-react';
import {canvasSize} from '../../../shared/layout';
import {parseLayoutFile,serializeLayoutFile} from '../../../shared/layout-file';
import {layoutOutputURL} from '../../../shared/layout-url';

export function LayoutLibrary({document,tool,api,notice,open,compositionId,busy,preview}) {
  const [name,setName]=useState(''),[working,setWorking]=useState(false);
  const [management, setManagement] = useState(null);
  const current=tool.compositions?.find(item=>item.id===compositionId);
  const create=async()=>{
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
  return <Card className="layout-library">
    <div className="library-heading"><div><p className="eyebrow">TU BIBLIOTECA</p><h3>Mis composiciones</h3><p className="help">Elige una composición para editarla. Cada una conserva su propia salida.</p></div><div className="actions"><DownloadButton disabled={busy||working} onClick={exportFile}>Exportar layout</DownloadButton><FilePicker label="Importar layout" inputLabel="Archivo de layout para importar" accept=".json,application/json" disabled={working||busy} onFile={importFile}/></div></div>
    <div className="library-save"><label>Nombre de la composición<Input value={name} maxLength={80} onChange={event=>setName(event.target.value)} placeholder={current?.name||'Mi nueva composición'}/></label><Button disabled={busy||working||!name.trim()} onClick={create}><Plus size={14}/>Guardar composición actual</Button></div>
    <div className="library-grid">{entries.map(item=>{
      const active=(item.id||undefined)===compositionId,layout=active?document:item.document;
      const {width,height}=canvasSize(layout);
      const url=layoutOutputURL(window.location.href,item.id);
      const action = management?.id === item.id ? management.action : null;
      return <article className={'library-composition'+(active?' is-active':'')} key={item.id||'principal'}>
        <button className="library-composition-open" aria-label={'Editar '+item.name} aria-current={active?'true':undefined} onClick={()=>open?.(item.id?'layout:'+item.id:'layout')}>
          <span className="library-thumbnail" aria-hidden="true">{preview?.(layout)}</span>
          <span className="library-composition-info"><span className="library-status">{active?'EN EDICIÓN':item.id?'GUARDADA':'PRINCIPAL'}</span><strong>{item.name}</strong><small>{width} × {height} · {height>width?'Vertical':'Horizontal'}</small><b>Editar composición →</b></span>
        </button>
        <div className="library-composition-actions"><OutputLinks notice={notice} url={url} message={'Enlace de '+item.name+' copiado.'} fallback="Salida" openLabel="Ver salida" iconSize={13} size="sm" variant="ghost"/></div>
        {item.id && <div className="library-composition-actions">
          {action ? <form className="library-composition-form" onSubmit={event => manage(event, item)}>
            {action === 'rename' ? <label>Nuevo nombre<Input autoFocus value={management.name} maxLength={80} disabled={working} onChange={event => setManagement({...management, name: event.target.value})}/></label>
              : <p className="help" role="alert">¿Eliminar «{item.name}»? Su enlace de salida dejará de funcionar.</p>}
            <div className="actions">
              {action === 'rename' ? <Button type="submit" size="sm" disabled={working || !management.name.trim() || management.name.trim() === item.name}>Guardar nombre</Button>
                : <Button type="submit" size="sm" variant="destructive" disabled={working}>Confirmar eliminación</Button>}
              <Button type="button" size="sm" variant="outline" disabled={working} onClick={() => setManagement(null)}>Cancelar</Button>
            </div>
          </form> : <>
            <Button size="sm" variant="ghost" aria-label={'Renombrar '+item.name} disabled={working} onClick={() => setManagement({id: item.id, action: 'rename', name: item.name})}><Pencil size={13}/>Renombrar</Button>
            <Button size="sm" variant="destructive" aria-label={'Eliminar '+item.name} disabled={working} onClick={() => setManagement({id: item.id, action: 'delete', name: item.name})}><Trash2 size={13}/>Eliminar</Button>
          </>}
        </div>}
      </article>;
    })}</div>
    <p className="help">En TikTok LIVE Studio, crea una fuente de enlace nueva por escena y pega la salida de su composición. Los archivos incluyen imágenes y temas. Hasta 20 composiciones.</p>
  </Card>;
}
