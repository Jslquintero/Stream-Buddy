import { useEffect, useRef, useState } from 'react';
import { AudioLines, Pause, Play, RefreshCw, Save, SkipForward, Square, Trash2, Volume2 } from 'lucide-react';
import { migrateVoiceEngine, pocketVoices } from '../../../shared/pocket-voices.js';
import { downloadFile } from '../lib/download-file';
import { DownloadButton } from './ui/download-button';
import { FilePicker } from './ui/file-picker';
import { Badge, Button, Card, Tabs, TabsContent, TabsList, TabsTrigger, Textarea } from './ui';
import { Field, Setting, Toggle } from './fields';
import { useProfileChangeGuard } from '../hooks/use-studio-profile';

export function VoiceStudio({ state, api, notice }) {
 const [settings,setSettings]=useState(()=>({...state.settings,Engine:migrateVoiceEngine(state.settings.Engine)}));
 const [dirty,setDirty]=useState(false),[tab,setTab]=useState('voice'),[preview,setPreview]=useState('Hola, bienvenidos al directo.'),[comment,setComment]=useState(''),[saving,setSaving]=useState(false);
 useProfileChangeGuard(dirty || saving);
 const t=state.tts,r=t.resources||{},task=r.task;
 const configured=useRef(r.configured?.id);
 const pocketVoiceReady=typeof state.settings.PocketVoice==='string';
 const pocketActive=settings.Engine==='PocketTTS';
 useEffect(()=>{
  if(r.configured && r.configured.id!==configured.current){
   configured.current=r.configured.id;
   setSettings(s=>({...s,Engine:r.configured.Engine,PocketVoice:s.PocketVoice??r.configured.PocketVoice}));
  }
 },[r.configured]);
 const update=(key,value)=>{setSettings(s=>({...s,[key]:value}));setDirty(true);};
 const save=async()=>{setSaving(true);try{const ok=await api('settings',{...settings,Username:state.settings.Username});if(ok){setDirty(false);notice('Configuración guardada.');}return ok;}finally{setSaving(false);}};
 const field=(name,label,props={})=><Setting name={name} label={label} settings={settings} update={update} {...props}/>;
 const toggle=(name,label,description)=><Toggle name={name} label={label} description={description} settings={settings} update={update}/>;
 const options=(items,value,placeholder)=>[{id:'',name:placeholder},...(items||[]),...((value&&!(items||[]).some(i=>(i.id??i.path)===value))?[{id:value,name:'Actual · '+value}]:[])];
 const importSettings=async file=>{
  try {
   if(file.size>20000) throw new Error('La configuración supera 20 KB');
   const data=JSON.parse((await file.text()).replace(/^\uFEFF/,''));
   if(!data||typeof data!=='object'||Array.isArray(data)) throw new Error('El archivo debe contener una configuración válida.');
   const next={...state.settings,...Object.fromEntries(Object.keys(state.settings).filter(key=>Object.hasOwn(data,key)).map(key=>[key,data[key]]))};
   next.Engine=migrateVoiceEngine(next.Engine);
   if(await api('settings',next)){setSettings(next);setDirty(false);notice('Configuración importada y guardada.');}
  } catch(error){notice(error.message,{type:'error'});}
 };
 return <>
 <div className="section-heading"><div><h2>Estudio de voz</h2><p className="muted">Una voz que suena como tu comunidad.</p></div><Button variant="outline" disabled={task?.running} onClick={()=>api('tts/refresh')}><RefreshCw size={15}/>Detectar voces y audio</Button></div>
 {!r.pocketBundled&&!r.pocketSetupAvailable&&<p role="alert" className="notice notice-warning">Reinicia Stream Buddy para cargar la versión actual del servidor.</p>}
 {task&&<Card className="task" role="status"><strong>{task.name}</strong><p>{task.message}</p><progress max="100" value={task.progress||0}/></Card>}
 {!r.pocketBundled&&<Card className="voice-setup">
  <div><h3>Pocket TTS</h3><p className="muted">{r.configured?'Motor y modelo en español preparados.':r.pocketInstalled?'Ejecutable instalado. Prepara el modelo en español y comprueba la voz guardada.':'Instala el motor local y descarga el modelo en español.'}</p></div>
  <Button disabled={!r.pocketSetupAvailable||task?.running||t.speaking} onClick={()=>api('tts/install-pocket')}>Preparar Pocket TTS</Button>
 </Card>}
 <div className="voice-grid"><Card className="settings-card"><form onSubmit={e=>{e.preventDefault();void save();}}>
 <Tabs value={tab} onValueChange={setTab}><TabsList><TabsTrigger value="voice">Voz y audio</TabsTrigger><TabsTrigger value="rules">Lectura y filtros</TabsTrigger><TabsTrigger value="library">Biblioteca</TabsTrigger></TabsList>
 <TabsContent value="voice">
  <div className="panel-heading"><span className="module-icon mint"><AudioLines/></span><div><h3>Tu identidad sonora</h3><p className="muted">Elige cómo quieres sonar en el directo.</p></div></div>
  {toggle('Enabled','Lectura de comentarios','Activa la voz de tu comunidad.')}
  {field('Engine','Motor de voz',{options:[{id:'Windows',name:'Windows · voces instaladas'},...(r.pocketInstalled||pocketActive?[{id:'PocketTTS',name:'Pocket TTS · español'}]:[])]})}
  {pocketActive?<>{pocketVoiceReady&&field('PocketVoice','Voz de Pocket TTS',{options:pocketVoices})}<p className="help">{r.pocketBundled?'Lola está disponible sin conexión. Las demás voces se descargan al usarlas.':r.pocketInstalled?'Modelo en español · velocidad fija.':'Pulsa Preparar Pocket TTS para instalar el motor de voz.'}</p></>:<>{field('Voice','Voz de Windows',{options:options(r.voices,settings.Voice,'Voz predeterminada de Windows')})}<Button variant="ghost" size="sm" onClick={()=>api('tts/windows-voices')}>Administrar voces de Windows ↗</Button></>}
  <div className="form-row">{!pocketActive&&field('Speed','Velocidad',{type:'number',min:.5,max:2,step:.1,required:true})}{field('Volume','Volumen · 0 a 100',{type:'number',min:0,max:100,required:true})}</div>
  {field('AudioDevice','Salida de audio',{options:options(r.devices,settings.AudioDevice,'Dispositivo predeterminado de Windows')})}
  <p className="help">Elige el dispositivo que captura TikTok LIVE Studio.</p>
 </TabsContent>
 <TabsContent value="rules"><h3>Qué comentarios leer</h3>{toggle('ReadAll','Leer todos los comentarios','Desactívalo para leer solo mensajes con comando.')}{field('Command','Comando de activación',{maxLength:30,placeholder:'!tts'})}<div className="form-row">{field('Cooldown','Espera por usuario · segundos',{type:'number',min:0,max:3600,required:true})}{field('MaxLength','Máximo de caracteres',{type:'number',min:1,max:500,required:true})}</div>{field('MaxQueue','Límite de mensajes en cola',{type:'number',min:1,max:200,required:true})}{toggle('BlockLinks','Bloquear enlaces')}{field('Blocked','Palabras o frases bloqueadas · una por línea',{multiline:true})}{field('BlockedUsers','Usuarios bloqueados · uno por línea',{multiline:true,placeholder:'Usuario sin @'})}</TabsContent>
 <TabsContent value="library">
  <h3>Copia de configuración</h3>
  <div className="actions"><DownloadButton onClick={()=>downloadFile('stream-buddy-tts.json',JSON.stringify(state.settings,null,2),'application/json')}>Exportar ajustes</DownloadButton><FilePicker label="Importar ajustes" accept=".json,application/json" onFile={importSettings}/></div>
 </TabsContent></Tabs>
 <div className="save-bar"><span className={dirty?'unsaved':'help'}>{dirty?'Cambios sin guardar':'Configuración guardada'}</span><Button type="submit" disabled={saving}><Save size={15}/>{saving?'Guardando…':'Guardar cambios'}</Button></div>
 </form></Card>
 <div className="voice-monitor"><Card><Badge>PRUEBA LOCAL</Badge><h3>Escucha tu voz</h3><p className="muted">Encuentra el sonido de tu directo.</p><Field label="Texto de prueba">{id=><Textarea id={id} rows={3} value={preview} onChange={e=>setPreview(e.target.value)}/>}</Field><Button className="full-width" disabled={!preview.trim()} onClick={()=>api('tts/preview',{text:preview,settings})}><Volume2 size={16}/>Probar estos ajustes</Button><p className="help">Prueba sin guardar ni aplicar filtros. Reanuda la cola si está pausada.</p><details><summary>Simular comentario del chat</summary><Field label="Comentario">{id=><Textarea id={id} value={comment} onChange={e=>setComment(e.target.value)} placeholder="!tts Hola"/>}</Field><Button variant="outline" disabled={!comment.trim()} onClick={()=>api('test',{text:comment})}>Enviar comentario</Button><p className="help">Usa los ajustes guardados y sus filtros.</p></details></Card><Card><div className="section-heading"><h3>Cola de voz</h3><Badge>{t.metrics?.completed||0} LEÍDOS</Badge></div><p className="muted">{t.queued} en cola · {t.paused?'Pausado':t.speaking?'Reproduciendo':'Listo para leer'}</p><div className="actions queue-actions"><Button variant="outline" size="sm" onClick={()=>api('pause')}>{t.paused?<Play size={14}/>:<Pause size={14}/>} {t.paused?'Reanudar':'Pausar'}</Button><Button variant="outline" size="sm" onClick={()=>api('skip')}><SkipForward size={14}/>Saltar</Button><Button variant="destructive" size="sm" onClick={()=>api('stop')}><Square size={13}/>Detener</Button></div><div className="current-message"><AudioLines size={20}/><p>{t.current?`${t.current.user}: ${t.current.text}`:'Sin mensaje en reproducción'}</p></div><div className="queue-list">{(t.items||[]).map(item=><div key={item.id}><p><strong>{item.user}</strong><br/>{item.text}</p><Button variant="ghost" size="icon" aria-label={'Quitar mensaje de '+item.user} onClick={()=>api('tts/remove',{id:item.id})}><XIcon/></Button></div>)}</div><Button variant="ghost" size="sm" onClick={()=>api('tts/clear')}><Trash2 size={14}/>Vaciar pendientes</Button>{(t.lastError||r.error)&&<p className="error" role="alert">{t.lastError||r.error}</p>}</Card></div></div></>;
}
function XIcon(){return <Trash2 size={14}/>;}

