import { downloadFile } from '../lib/download-file';
import { DownloadButton } from './ui/download-button';
import { OutputLinks, OutputToolbar } from './output-controls';
import {createPortal} from 'react-dom';
import boardCSS from './gifters.css?raw';
import {validateThemeCSS} from '../../../shared/custom-themes';
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {Gift,RotateCcw,Crown} from 'lucide-react';
import { Button, Card, Input, Badge, Select, Textarea } from './ui';
import { Field, NumberSettings, OverlayColors, Toggle } from './fields';
import {useStudio} from '../hooks/use-studio';
import {useNotificationSettings} from '../hooks/use-notification-settings';
import {defaultGifters,validateGifters,giftersOutputPath,safeAvatar,giftersStyles,giftersPresets,giftersMetrics} from '../../../modules/gifters/config';
import './gifters.css';
import { EditorViewSwitch } from './editor-view-switch';
import './editor-workspace.css';
import './gifters-editor.css';
import {GiftersCount,useGiftersMotion,useGiftersDemo} from './gifters-motion';
const storage={key:'live-studio.gifters.pending.v1',validate:validateGifters,migrate:validateGifters,action:'gifters/save'};
const sample=[{id:'a',name:'María',gifts:18,diamonds:2500},{id:'b',name:'Carlos',gifts:14,diamonds:1800},{id:'c',name:'Ana',gifts:9,diamonds:950},{id:'d',name:'José',gifts:7,diamonds:830},{id:'e',name:'Sofía',gifts:4,diamonds:420}];
function GiftersAvatar({user}){
  const [failed,setFailed]=useState('');
  const src=safeAvatar(user.avatar);
  return <span className="gifters-avatar">{src&&failed!==src?<img src={src} alt={'Foto de '+user.name} referrerPolicy="no-referrer" onError={()=>setFailed(src)}/>:<span aria-label={'Sin foto de '+user.name}>{Array.from(user.name||'?')[0].toUpperCase()}</span>}</span>;
}
const number=value=>Number(value||0).toLocaleString('es');
const valueOf=(config,user)=>config.metric==='diamonds'?Number(user.diamonds||0):Number(user.gifts||0);
const unitOf=config=>config.metric==='diamonds'?'diamantes':'regalos';
function GiftersCSSSurface({css,children}){
  const host=useRef(null),[root,setRoot]=useState(null);
  useLayoutEffect(()=>setRoot(host.current.shadowRoot||host.current.attachShadow({mode:'open'})),[]);
  return <div className="gifters-css-surface" ref={host}>{root&&createPortal(<><style>{boardCSS}</style><style>{css}</style>{children}</>,root)}</div>;
}
export function GiftersBoard(props){
  const config={...defaultGifters,...props.config};
  let css='';try{css=validateThemeCSS(config.customCss);}catch{}
  const board=<GiftersBoardContent {...props} config={config}/>;
  return css?<GiftersCSSSurface css={css}>{board}</GiftersCSSSurface>:board;
}
function GiftersBoardContent({config,ranking=[],total=0,preview=false}){
  const list=useGiftersMotion(JSON.stringify([config.enabled,config.limit,config.width,config.fontSize,config.style,config.metric,config.customCss,ranking.map(user=>[user.id,user.name])]));
  if(!config.enabled&&!preview)return null;
  const alpha=value=>Math.round(value*2.55).toString(16).padStart(2,'0');
  const unit=unitOf(config);
  return <section className={"gifters-board gifters-style-"+config.style+(config.rgbNames?" gifters-rgb-names":"")+(config.animateNames?" gifters-animated-names":"")+(config.pulseGifts?" gifters-pulse-gifts":"")} aria-label="Clasificación de regalos" style={{'--gifters-width':config.width+'px','--gifters-font-size':config.fontSize+'px','--gifters-color':config.color,'--gifters-background':config.background+alpha(config.opacity),'--gifters-border':config.accent+alpha(config.borderOpacity),'--gifters-radius':config.radius+'px','--gifters-accent':config.accent}}>
    {config.showTitle&&<header><Gift aria-hidden="true"/><strong>{config.title}</strong></header>}
    {ranking.length?<ol ref={list}>{ranking.slice(0,config.limit).map((user,index)=><li key={user.id} data-user-id={user.id}><span className="gifters-rank">{config.style==='medals'&&index<3?['🥇','🥈','🥉'][index]:index+1+'.'}</span><span className="gifters-portrait"><GiftersAvatar user={user}/>{index===0&&<Crown className="gifters-crown" role="img" aria-label="Primer puesto"/>}</span><span className="gifters-name">{user.name}</span><strong className="gifters-score"><span className="gifters-gift" role="img" aria-label={unit}>{config.metric==='diamonds'?'◆':'🎁'}</span> <GiftersCount value={valueOf(config,user)}/></strong></li>)}</ol>:<p className="gifters-empty">Esperando los primeros regalos…</p>}
    {config.showTotal&&<footer>{number(total)} {unit} recibidos</footer>}
  </section>;
}
export function GiftersOutput(){
  const {state,online}=useStudio('gifters');const tool=state?.tools.gifters;
  useEffect(()=>{document.documentElement.classList.add('gifters-output');document.documentElement.style.colorScheme='normal';return()=>{document.documentElement.classList.remove('gifters-output');document.documentElement.style.removeProperty('color-scheme');};},[]);
  return <div className={'gifters-stage '+(tool?.config.position||'top-right')}>{online&&tool&&<GiftersBoard {...tool}/>}</div>;
}
export function GiftersStudio({tool,api,notice,online,connected}){
  const {config,setConfig,dirty,saving,error}=useNotificationSettings(tool.config,tool.revision,api,online,storage);
  const [demo,setDemo]=useState(false),[reset,setReset]=useState(false);
  const [mobileView,setMobileView]=useState('editor');
  const demoRows=useGiftersDemo(demo,sample);
  const demoTotal=demoRows.reduce((sum,row)=>sum+valueOf(config,row),0);
  const update=(key,value)=>setConfig(s=>({...s,[key]:value}));
  const url=new URL(giftersOutputPath,location.origin).href;
  return <div className="gifters-editor editor-workspace">
    <header className="editor-workspace-header">
      <h1 className="editor-workspace-title">Top gifters</h1>
      <OutputToolbar connected={connected} description={connected ? "Recibiendo regalos del LIVE." : "Conecta TikTok para recibir regalos."}>
        <OutputLinks notice={notice} url={url} message="Enlace de Top gifters copiado." iconSize={15} size="sm"/>
      </OutputToolbar>
    </header>
    <EditorViewSwitch view={mobileView} change={setMobileView} editorLabel="Diseño" monitorLabel="Vista previa y conteo"/>
    <div className="editor-workspace-grid" data-view={mobileView}>
      <Card className="gifters-settings editor-workspace-settings">
        <div className="gifters-editor-heading"><h2>Clasificación</h2><Toggle name="enabled" label="Mostrar clasificación en el directo" settings={config} update={update}/></div>
        <div className="gifters-editor-fields">
          <Field label="Estilo">{id=><Select id={id} value={config.style||'classic'} onChange={e=>{const style=e.target.value;setConfig(s=>({...s,...giftersPresets[style],style}));}}>{giftersStyles.map(([value,label])=><option key={value} value={value}>{label}</option>)}</Select>}</Field>
          <Field label="Posición">{id=><Select id={id} value={config.position} onChange={e=>update('position',e.target.value)}>{[['top-left','Arriba · izquierda'],['top-center','Arriba · centro'],['top-right','Arriba · derecha'],['bottom-left','Abajo · izquierda'],['bottom-center','Abajo · centro'],['bottom-right','Abajo · derecha']].map(([value,label])=><option key={value} value={value}>{label}</option>)}</Select>}</Field>
          <Field label="Métrica">{id=><Select id={id} value={config.metric} onChange={e=>update('metric',e.target.value)}>{giftersMetrics.map(([value,label])=><option key={value} value={value}>{label}</option>)}</Select>}</Field>
          <NumberSettings fields={[['limit','Usuarios visibles',1,20]]} settings={config} update={update}/>
          <Field label="Título">{id=><Input id={id} value={config.title} maxLength={80} onChange={e=>update('title',e.target.value)}/>}</Field>
        </div>
        <div className="gifters-editor-fields gifters-display-options">
          <Toggle name="showTitle" label="Mostrar título" settings={{...defaultGifters,...config}} update={update}/>
          <Toggle name="showTotal" label="Mostrar total recibido" settings={config} update={update}/>
        </div>
        <OverlayColors settings={config} update={update}/>
        <details className="gifters-design-section"><summary>Tamaño, opacidad y bordes</summary>
          <NumberSettings fields={[['width','Ancho · px',280,1600],['fontSize','Tamaño de texto · px',16,96],['opacity','Opacidad del fondo · %',0,100],['borderOpacity','Opacidad del borde · %',0,100],['radius','Bordes redondeados · px',0,80]]} settings={config} update={update}/>
          <Button variant="outline" size="sm" onClick={()=>setConfig(s=>({...s,fontSize:Math.max(30,Number(s.fontSize)||30),width:Math.max(400,Number(s.width)||400),color:'#ffffff'}))}>Mejorar lectura en móvil</Button>
        </details>
        <details className="gifters-design-section"><summary>Efectos</summary><div className="gifters-editor-fields gifters-display-options">
          <Toggle name="rgbNames" label="Reflejo RGB en los nombres" settings={{...defaultGifters,...config}} update={update}/>
          <Toggle name="animateNames" label="Movimiento suave en los nombres" settings={{...defaultGifters,...config}} update={update}/>
          <Toggle name="pulseGifts" label="Regalos con movimiento" settings={{...defaultGifters,...config}} update={update}/>
        </div></details>
        <details className="gifters-css-editor gifters-design-section"><summary>Editar CSS personalizado</summary><p className="help">Se aplica a la vista previa y a la salida, aislado del panel. Selectores: .gifters-board, .gifters-name, .gifters-score, .gifters-avatar, .gifters-rank, .gifters-gift y .gifters-crown. Borra el CSS para recuperar el estilo.</p><Field label="CSS personalizado">{id=><Textarea id={id} rows={6} spellCheck={false} maxLength={20000} value={config.customCss||''} placeholder={'.gifters-name { color: #299cdd; }'} onChange={e=>update('customCss',e.target.value)}/>}</Field><Button variant="outline" size="sm" onClick={()=>update('customCss','')}>Restablecer CSS</Button></details>
        <p role="status" className={error?"error":"help"}>{error || (saving ? "Guardando…" : dirty ? online ? "Pendiente de autoguardado" : "Pendiente de conexión" : "Configuración guardada")}</p>
      </Card>
      <div className="gifters-monitor editor-workspace-monitor">
        <Card>
          <div className="gifters-editor-heading"><h2>Vista previa</h2><Toggle name="demo" label="Ver ejemplo (solo vista previa)" settings={{demo}} update={(_,value)=>setDemo(value)}/></div>
          <div className={"gifters-preview gifters-preview-"+config.position.split("-")[1]}>
            <GiftersBoard key={demo?"demo":"live"} config={config} ranking={demo?demoRows:tool.ranking} total={demo?demoTotal:tool.total} preview/>
          </div>
        </Card>
        <Card>
          <div className="gifters-editor-heading"><h2>Conteo local</h2><Badge className={connected?"success":""}>{connected?"En vivo":"Conteo guardado"}</Badge></div>
          <p className="gifters-totals"><strong>{number(tool.totalDiamonds)}</strong> diamantes · <strong>{number(tool.totalGifts)}</strong> regalos · <strong>{number(tool.participants)}</strong> usuarios</p>
          <p className="help">{tool.channel && "@"+tool.channel+" · "}{tool.updatedAt ? "Último regalo a las "+new Date(tool.updatedAt).toLocaleTimeString("es") : "Esperando regalos"}</p>
          {tool.error&&<p className="error">{tool.error}</p>}
          <div className="actions gifters-count-actions">
            <DownloadButton disabled={!online} onClick={async()=>{const data=await api("gifters/export");if(data)downloadFile("scoreboard-gifters.json", JSON.stringify(data,null,2), "application/json");}}>Descargar scoreboard</DownloadButton>
            {reset?<div role="alert"><p>¿Borrar el conteo actual? El diseño se conservará.</p><div className="actions"><Button disabled={!online} onClick={async()=>{if(await api('gifters/reset')){setReset(false);notice('Conteo de regalos reiniciado.');}}}>Confirmar reinicio</Button><Button variant="outline" onClick={()=>setReset(false)}>Cancelar</Button></div></div>:<Button variant="outline" size="sm" disabled={!online} onClick={()=>setReset(true)}><RotateCcw size={16}/>Reiniciar conteo</Button>}
          </div>
        </Card>
      </div>
    </div>
  </div>;
}
