import { downloadFile } from '../lib/download-file';
import { DownloadButton } from './ui/download-button';
import { OutputLinks, OutputToolbar } from './output-controls';
import {createPortal} from 'react-dom';
import boardCSS from './likes.css?raw';
import {validateThemeCSS} from '../../../shared/custom-themes';
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {Heart,RotateCcw,Crown} from 'lucide-react';
import { Button, Card, Input, Badge, Select, Textarea } from './ui';
import { Field, NumberSettings, OverlayColors, Toggle } from './fields';
import {useStudio} from '../hooks/use-studio';
import {useNotificationSettings} from '../hooks/use-notification-settings';
import {defaultLikes,validateLikes,likesOutputPath,safeAvatar,likesStyles,likesPresets} from '../../../modules/likes/config';
import './likes.css';
import { EditorViewSwitch } from './editor-view-switch';
import './editor-workspace.css';
import './likes-editor.css';
import {LikesCount,useLikesMotion,useLikesDemo} from './likes-motion';
const storage={key:'live-studio.likes.pending.v1',validate:validateLikes,migrate:validateLikes,action:'likes/save'};
const sample=[{id:'a',name:'María',likes:2500},{id:'b',name:'Carlos',likes:1800},{id:'c',name:'Ana',likes:950},{id:'d',name:'José',likes:830},{id:'e',name:'Sofía',likes:420}];
function LikesAvatar({user}){
  const [failed,setFailed]=useState('');
  const src=safeAvatar(user.avatar);
  return <span className="likes-avatar">{src&&failed!==src?<img src={src} alt={'Foto de '+user.name} referrerPolicy="no-referrer" onError={()=>setFailed(src)}/>:<span aria-label={'Sin foto de '+user.name}>{Array.from(user.name||'?')[0].toUpperCase()}</span>}</span>;
}
const number=value=>Number(value||0).toLocaleString('es');
function LikesCSSSurface({css,children}){
  const host=useRef(null),[root,setRoot]=useState(null);
  useLayoutEffect(()=>setRoot(host.current.shadowRoot||host.current.attachShadow({mode:'open'})),[]);
  return <div className="likes-css-surface" ref={host}>{root&&createPortal(<><style>{boardCSS}</style><style>{css}</style>{children}</>,root)}</div>;
}
export function LikesBoard(props){
  const config={...defaultLikes,...props.config};
  let css='';try{css=validateThemeCSS(config.customCss);}catch{}
  const board=<LikesBoardContent {...props} config={config}/>;
  return css?<LikesCSSSurface css={css}>{board}</LikesCSSSurface>:board;
}
function LikesBoardContent({config,ranking=[],total=0,preview=false}){
  const list=useLikesMotion(JSON.stringify([config.enabled,config.limit,config.width,config.fontSize,config.style,config.customCss,ranking.map(user=>[user.id,user.name])]));
  if(!config.enabled&&!preview)return null;
  const alpha=value=>Math.round(value*2.55).toString(16).padStart(2,'0');
  return <section className={"likes-board likes-style-"+config.style+(config.rgbNames?" likes-rgb-names":"")+(config.animateNames?" likes-animated-names":"")+(config.pulseHearts?" likes-pulse-hearts":"")} aria-label="Clasificación de likes" style={{'--likes-width':config.width+'px','--likes-font-size':config.fontSize+'px','--likes-color':config.color,'--likes-background':config.background+alpha(config.opacity),'--likes-border':config.accent+alpha(config.borderOpacity),'--likes-radius':config.radius+'px','--likes-accent':config.accent}}>
    {config.showTitle&&<header><Heart aria-hidden="true"/><strong>{config.title}</strong></header>}
    {ranking.length?<ol ref={list}>{ranking.slice(0,config.limit).map((user,index)=><li key={user.id} data-user-id={user.id}><span className="likes-rank">{config.style==='medals'&&index<3?['🥇','🥈','🥉'][index]:index+1+'.'}</span><span className="likes-portrait"><LikesAvatar user={user}/>{index===0&&<Crown className="likes-crown" role="img" aria-label="Primer puesto"/>}</span><span className="likes-name">{user.name}</span><strong className="likes-score"><span className="likes-heart" aria-label="likes">♥</span> <LikesCount value={user.likes}/></strong></li>)}</ol>:<p className="likes-empty">Esperando los primeros likes…</p>}
    {config.showTotal&&<footer>{number(total)} likes recibidos</footer>}
  </section>;
}
export function LikesOutput(){
  const {state,online}=useStudio('likes');const tool=state?.tools.likes;
  useEffect(()=>{document.documentElement.classList.add('likes-output');document.documentElement.style.colorScheme='normal';return()=>{document.documentElement.classList.remove('likes-output');document.documentElement.style.removeProperty('color-scheme');};},[]);
  return <div className={'likes-stage '+(tool?.config.position||'top-right')}>{online&&tool&&<LikesBoard {...tool}/>}</div>;
}
export function LikesStudio({tool,api,notice,online,connected}){
  const {config,setConfig,dirty,saving,error}=useNotificationSettings(tool.config,tool.revision,api,online,storage);
  const [demo,setDemo]=useState(false),[reset,setReset]=useState(false);
  const [mobileView,setMobileView]=useState('editor');
  const demoRows=useLikesDemo(demo,sample);
  const update=(key,value)=>setConfig(s=>({...s,[key]:value}));
  const url=new URL(likesOutputPath,location.origin).href;
  return <div className="likes-editor editor-workspace">
    <header className="editor-workspace-header">
      <h1 className="editor-workspace-title">Top likes</h1>
      <OutputToolbar connected={connected} description={connected ? "Recibiendo likes del LIVE." : "Conecta TikTok para recibir likes."}>
        <OutputLinks notice={notice} url={url} message="Enlace de Top likes copiado." iconSize={15} size="sm"/>
      </OutputToolbar>
    </header>
    <EditorViewSwitch view={mobileView} change={setMobileView} editorLabel="Diseño" monitorLabel="Vista previa y conteo"/>
    <div className="editor-workspace-grid" data-view={mobileView}>
      <Card className="likes-settings editor-workspace-settings">
        <div className="likes-editor-heading"><h2>Clasificación</h2><Toggle name="enabled" label="Mostrar clasificación en el directo" settings={config} update={update}/></div>
        <div className="likes-editor-fields">
          <Field label="Estilo">{id=><Select id={id} value={config.style||'classic'} onChange={e=>{const style=e.target.value;setConfig(s=>({...s,...likesPresets[style],style}));}}>{likesStyles.map(([value,label])=><option key={value} value={value}>{label}</option>)}</Select>}</Field>
          <Field label="Posición">{id=><Select id={id} value={config.position} onChange={e=>update('position',e.target.value)}>{[['top-left','Arriba · izquierda'],['top-center','Arriba · centro'],['top-right','Arriba · derecha'],['bottom-left','Abajo · izquierda'],['bottom-center','Abajo · centro'],['bottom-right','Abajo · derecha']].map(([value,label])=><option key={value} value={value}>{label}</option>)}</Select>}</Field>
          <NumberSettings fields={[['limit','Usuarios visibles',1,20]]} settings={config} update={update}/>
          <Field label="Título">{id=><Input id={id} value={config.title} maxLength={80} onChange={e=>update('title',e.target.value)}/>}</Field>
        </div>
        <div className="likes-editor-fields likes-display-options">
          <Toggle name="showTitle" label="Mostrar título" settings={{...defaultLikes,...config}} update={update}/>
          <Toggle name="showTotal" label="Mostrar total recibido" settings={config} update={update}/>
        </div>
        <OverlayColors settings={config} update={update}/>
        <details className="likes-design-section"><summary>Tamaño, opacidad y bordes</summary>
          <NumberSettings fields={[['width','Ancho · px',280,1600],['fontSize','Tamaño de texto · px',16,96],['opacity','Opacidad del fondo · %',0,100],['borderOpacity','Opacidad del borde · %',0,100],['radius','Bordes redondeados · px',0,80]]} settings={config} update={update}/>
          <Button variant="outline" size="sm" onClick={()=>setConfig(s=>({...s,fontSize:Math.max(30,Number(s.fontSize)||30),width:Math.max(400,Number(s.width)||400),color:'#ffffff'}))}>Mejorar lectura en móvil</Button>
        </details>
        <details className="likes-design-section"><summary>Efectos</summary><div className="likes-editor-fields likes-display-options">
          <Toggle name="rgbNames" label="Reflejo RGB en los nombres" settings={{...defaultLikes,...config}} update={update}/>
          <Toggle name="animateNames" label="Movimiento suave en los nombres" settings={{...defaultLikes,...config}} update={update}/>
          <Toggle name="pulseHearts" label="Corazones con latido" settings={{...defaultLikes,...config}} update={update}/>
        </div></details>
        <details className="likes-css-editor likes-design-section"><summary>Editar CSS personalizado</summary><p className="help">Se aplica a la vista previa y a la salida, aislado del panel. Selectores: .likes-board, .likes-name, .likes-score, .likes-avatar, .likes-rank y .likes-crown. Borra el CSS para recuperar el estilo.</p><Field label="CSS personalizado">{id=><Textarea id={id} rows={6} spellCheck={false} maxLength={20000} value={config.customCss||''} placeholder={'.likes-name { color: #299cdd; }'} onChange={e=>update('customCss',e.target.value)}/>}</Field><Button variant="outline" size="sm" onClick={()=>update('customCss','')}>Restablecer CSS</Button></details>
        <p role="status" className={error?"error":"help"}>{error || (saving ? "Guardando…" : dirty ? online ? "Pendiente de autoguardado" : "Pendiente de conexión" : "Configuración guardada")}</p>
      </Card>
      <div className="likes-monitor editor-workspace-monitor">
        <Card>
          <div className="likes-editor-heading"><h2>Vista previa</h2><Toggle name="demo" label="Ver ejemplo (solo vista previa)" settings={{demo}} update={(_,value)=>setDemo(value)}/></div>
          <div className={"likes-preview likes-preview-"+config.position.split("-")[1]}>
            <LikesBoard key={demo?"demo":"live"} config={config} ranking={demo?demoRows:tool.ranking} total={demo?demoRows.reduce((sum,row)=>sum+row.likes,0):tool.total} preview/>
          </div>
        </Card>
        <Card>
          <div className="likes-editor-heading"><h2>Conteo local</h2><Badge className={connected?"success":""}>{connected?"En vivo":"Conteo guardado"}</Badge></div>
          <p className="likes-totals"><strong>{number(tool.total)}</strong> likes · <strong>{number(tool.participants)}</strong> usuarios</p>
          <p className="help">{tool.channel && "@"+tool.channel+" · "}{tool.updatedAt ? "Último like a las "+new Date(tool.updatedAt).toLocaleTimeString("es") : "Esperando likes"}</p>
          {tool.error&&<p className="error">{tool.error}</p>}
          <div className="actions likes-count-actions">
            <DownloadButton disabled={!online} onClick={async()=>{const data=await api("likes/export");if(data)downloadFile("scoreboard-likes.json", JSON.stringify(data,null,2), "application/json");}}>Descargar scoreboard</DownloadButton>
            {reset?<div role="alert"><p>¿Borrar el conteo actual? El diseño se conservará.</p><div className="actions"><Button disabled={!online} onClick={async()=>{if(await api('likes/reset')){setReset(false);notice('Conteo de likes reiniciado.');}}}>Confirmar reinicio</Button><Button variant="outline" onClick={()=>setReset(false)}>Cancelar</Button></div></div>:<Button variant="outline" size="sm" disabled={!online} onClick={()=>setReset(true)}><RotateCcw size={16}/>Reiniciar conteo</Button>}
          </div>
        </Card>
      </div>
    </div>
  </div>;
}
