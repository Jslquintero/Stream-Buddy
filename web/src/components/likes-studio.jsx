import {useEffect,useState} from 'react';
import {Heart,Copy,ExternalLink,RotateCcw,Crown} from 'lucide-react';
import {Button,Card,Input,Badge} from './ui';
import {Field,Toggle} from './fields';
import {useStudio} from '../hooks/use-studio';
import {useNotificationSettings} from '../hooks/use-notification-settings';
import {defaultLikes,validateLikes,likesOutputPath,safeAvatar} from '../../../modules/likes/config';
import './likes.css';
import {LikesCount,useLikesMotion,useLikesDemo} from './likes-motion';
const storage={key:'live-studio.likes.pending.v1',validate:validateLikes,migrate:validateLikes,action:'likes/save'};
const sample=[{id:'a',name:'María',likes:2500},{id:'b',name:'Carlos',likes:1800},{id:'c',name:'Ana',likes:950}];
function LikesAvatar({user}){
  const [failed,setFailed]=useState('');
  const src=safeAvatar(user.avatar);
  return <span className="likes-avatar">{src&&failed!==src?<img src={src} alt={'Foto de '+user.name} referrerPolicy="no-referrer" onError={()=>setFailed(src)}/>:<span aria-label={'Sin foto de '+user.name}>{Array.from(user.name||'?')[0].toUpperCase()}</span>}</span>;
}
const number=value=>Number(value||0).toLocaleString('es');
export function LikesBoard({config,ranking=[],total=0,preview=false}){
  const list=useLikesMotion(JSON.stringify([config.enabled,config.limit,config.width,config.fontSize,ranking.map(user=>[user.id,user.name])]));
  if(!config.enabled&&!preview)return null;
  const alpha=value=>Math.round(value*2.55).toString(16).padStart(2,'0');
  return <section className="likes-board" aria-label="Clasificación de likes" style={{width:config.width,fontSize:config.fontSize,color:config.color,background:config.background+alpha(config.opacity),borderColor:config.accent+alpha(config.borderOpacity),borderRadius:config.radius,'--likes-accent':config.accent}}>
    <header><Heart aria-hidden="true"/><strong>{config.title}</strong></header>
    {ranking.length?<ol ref={list}>{ranking.slice(0,config.limit).map((user,index)=><li key={user.id} data-user-id={user.id}><span className="likes-rank">{index+1}</span><span className="likes-portrait"><LikesAvatar user={user}/>{index===0&&<Crown className="likes-crown" role="img" aria-label="Primer puesto"/>}</span><span className="likes-name">{user.name}</span><strong><LikesCount value={user.likes}/> <span aria-label="likes">♥</span></strong></li>)}</ol>:<p className="likes-empty">Esperando los primeros likes…</p>}
    {config.showTotal&&<footer>{number(total)} likes recibidos</footer>}
  </section>;
}
export function LikesOutput(){
  const {state,online}=useStudio();const tool=state?.tools.likes;
  useEffect(()=>{document.documentElement.classList.add('likes-output');document.documentElement.style.colorScheme='normal';return()=>{document.documentElement.classList.remove('likes-output');document.documentElement.style.removeProperty('color-scheme');};},[]);
  return <div className={'likes-stage '+(tool?.config.position||'top-right')}>{online&&tool&&<LikesBoard {...tool}/>}</div>;
}
export function LikesStudio({tool,api,notice,online,connected}){
  const {config,setConfig,dirty,saving,error,save}=useNotificationSettings(tool.config,tool.revision,api,online,storage);
  const [demo,setDemo]=useState(false),[reset,setReset]=useState(false);
  const demoRows=useLikesDemo(demo,sample);
  const update=(key,value)=>setConfig(s=>({...s,[key]:value}));
  const url=new URL(likesOutputPath,location.origin).href;
  return <div className="likes-editor">
    <Card className="notifications-toolbar"><div><Badge className={connected?'success':''}>{connected?'TikTok conectado':'TikTok sin conectar'}</Badge><p className="help">Se cuentan los likes recibidos desde la conexión. No se recuperan likes anteriores. El conteo continúa al reconectar; reinícialo para otro directo.</p></div><div className="actions"><Button variant="outline" onClick={async()=>{try{await navigator.clipboard.writeText(url);notice('Enlace de Top likes copiado.');}catch{notice('Enlace: '+url);}}}><Copy size={16}/>Copiar salida</Button><Button asChild variant="outline"><a href={url} target="_blank" rel="noopener noreferrer"><ExternalLink size={16}/>Abrir salida</a></Button></div></Card>
    <div className="notifications-grid"><Card className="likes-settings">
      <h2>Diseño del Top likes</h2><Toggle name="enabled" label="Mostrar clasificación en el directo" settings={config} update={update}/>
      <Field label="Título">{id=><Input id={id} value={config.title} maxLength={80} onChange={e=>update('title',e.target.value)}/>}</Field>
      <div className="form-row">{[['limit','Usuarios visibles',1,20],['width','Ancho · px',280,1600],['fontSize','Tamaño de texto · px',16,96],['opacity','Opacidad del fondo · %',0,100],['borderOpacity','Opacidad del borde · %',0,100],['radius','Bordes redondeados · px',0,80]].map(([key,label,min,max])=><Field key={key} label={label}>{id=><Input id={id} type="number" min={min} max={max} value={config[key]} onChange={e=>update(key,e.target.value===''?'':Number(e.target.value))}/>}</Field>)}</div>
      <div className="form-row">{[['background','Fondo'],['color','Texto'],['accent','Acento']].map(([key,label])=><Field key={key} label={label}>{id=><Input id={id} type="color" value={config[key]} onChange={e=>update(key,e.target.value)}/>}</Field>)}</div>
      <Field label="Posición">{id=><select id={id} className="input" value={config.position} onChange={e=>update('position',e.target.value)}>{[['top-left','Arriba · izquierda'],['top-center','Arriba · centro'],['top-right','Arriba · derecha'],['bottom-left','Abajo · izquierda'],['bottom-center','Abajo · centro'],['bottom-right','Abajo · derecha']].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>}</Field>
      <Toggle name="showTotal" label="Mostrar total recibido" settings={config} update={update}/>
      <p role="status" className={error?'error':'help'}>{error||(saving?'Guardando…':dirty?'Cambios pendientes…':'Guardado en este equipo.')}</p><Button variant="outline" disabled={!online||saving} onClick={save}>Guardar diseño</Button>
    </Card><div className="likes-monitor"><Card><h2>Vista previa</h2><Toggle name="demo" label="Ver ejemplo (solo vista previa)" settings={{demo}} update={(_,value)=>setDemo(value)}/><p className="help">{demo?'Simulación: nuevos likes y adelantamientos cada 2 segundos. No modifica el scoreboard.':'Los contadores y las posiciones se animan al recibir likes en vivo.'}</p><div className="likes-preview"><LikesBoard key={demo?'demo':'live'} config={config} ranking={demo?demoRows:tool.ranking} total={demo?demoRows.reduce((sum,row)=>sum+row.likes,0):tool.total} preview/></div></Card>
    <Card><h2>Scoreboard local</h2><Badge className={connected?'success':''}>{connected?'Actualizando en tiempo real':'Conteo guardado'}</Badge><p className="help">{tool.updatedAt?'?ltimo like: '+new Date(tool.updatedAt).toLocaleTimeString('es'):'Esperando likes.'} {tool.savedAt?'Guardado local: '+new Date(tool.savedAt).toLocaleTimeString('es'):''}</p><Button variant="outline" disabled={!online} onClick={async()=>{const data=await api('likes/export');if(!data)return;const file=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=file;link.download='scoreboard-likes.json';link.click();setTimeout(()=>URL.revokeObjectURL(file),1000);}}>Descargar scoreboard</Button><p>{number(tool.total)} likes · {number(tool.participants)} usuarios</p><p className="help">Canal: {tool.channel?'@'+tool.channel:'esperando likes'}. La clasificación se guarda localmente. Cambiar de canal inicia un conteo nuevo.</p>{tool.error&&<p className="error">{tool.error}</p>}
    {reset?<div role="alert"><p>¿Borrar el conteo actual? El diseño se conservará.</p><div className="actions"><Button disabled={!online} onClick={async()=>{if(await api('likes/reset')){setReset(false);notice('Conteo de likes reiniciado.');}}}>Confirmar reinicio</Button><Button variant="outline" onClick={()=>setReset(false)}>Cancelar</Button></div></div>:<Button variant="outline" disabled={!online} onClick={()=>setReset(true)}><RotateCcw size={16}/>Reiniciar conteo</Button>}</Card></div></div>
  </div>;
}
