import { boardStyle } from '../lib/widget-css';
import {createPortal} from 'react-dom';
import boardCSS from './gifters.css?raw';
import {validateThemeCSS} from '../../../shared/custom-themes';
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {Gift,Gem,Crown,Users} from 'lucide-react';
import {useStudio} from '../hooks/use-studio';
import {useNotificationSettings} from '../hooks/use-notification-settings';
import {defaultGifters,validateGifters,safeAvatar} from '../../../modules/gifters/config';
import './gifters.css';
import {GiftersCount,useGiftersMotion,useGiftersDemo} from './gifters-motion';
import {RankingEditor} from './ranking-editor';
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
  let css='';try{if(config.cssEnabled)css=validateThemeCSS(config.customCss);}catch{}
  const board=<GiftersBoardContent {...props} config={config}/>;
  return css?<GiftersCSSSurface css={css}>{board}</GiftersCSSSurface>:board;
}
function GiftersBoardContent({config,ranking=[],total=0,preview=false}){
  const list=useGiftersMotion(JSON.stringify([config.enabled,config.limit,config.width,config.fontSize,config.style,config.metric,config.customCss,ranking.map(user=>[user.id,user.name])]));
  if(!config.enabled&&!preview)return null;
  const alpha=value=>Math.round(value*2.55).toString(16).padStart(2,'0');
  const unit=unitOf(config);
  const rows=ranking.slice(0,config.limit);
  const peak=Math.max(1,...rows.map(user=>valueOf(config,user)));
  return <section className={"gifters-board gifters-style-"+config.style+(config.rgbNames?" gifters-rgb-names":"")+(config.animateNames?" gifters-animated-names":"")+(config.pulseGifts?" gifters-pulse-gifts":"")+(Number(config.opacity)<=0?" gifters-flat":"")} aria-label="Clasificación de regalos" style={boardStyle('gifters', config)}>
    {config.showTitle&&<header><Gift aria-hidden="true"/><strong>{config.title}</strong></header>}
    {rows.length?<ol ref={list}>{rows.map((user,index)=>{
      const value=valueOf(config,user);
      const share=Math.max(4,Math.round(value/peak*100));
      return <li key={user.id} data-user-id={user.id} style={{'--gifters-share':share+'%'}}>
        <span className="gifters-rank">{config.style==='medals'&&index<3?['🥇','🥈','🥉'][index]:index+1}</span>
        <span className="gifters-portrait"><GiftersAvatar user={user}/>{index===0&&<Crown className="gifters-crown" role="img" aria-label="Primer puesto"/>}</span>
        <span className="gifters-name">{user.name}</span>
        <strong className="gifters-score"><span className="gifters-gift" role="img" aria-label={unit}>{config.metric==='diamonds'?'◆':'🎁'}</span> <GiftersCount value={value}/></strong>
      </li>;
    })}</ol>:<p className="gifters-empty">Esperando los primeros regalos…</p>}
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
  const [demo,setDemo]=useState(false);
  const demoRows=useGiftersDemo(demo,sample);
  const demoTotal=demoRows.reduce((sum,row)=>sum+valueOf(config,row),0);
  const total=demo?demoTotal:tool.total;
  const diamonds=demo?demoRows.reduce((sum,row)=>sum+Number(row.diamonds||0),0):(tool.totalDiamonds||0);
  const gifts=demo?demoRows.reduce((sum,row)=>sum+Number(row.gifts||0),0):(tool.totalGifts||0);
  const participants=demo?demoRows.length:tool.participants||0;
  return <RankingEditor
    variant="gifters"
    tool={tool}
    api={api}
    notice={notice}
    online={online}
    connected={connected}
    config={config}
    setConfig={setConfig}
    dirty={dirty}
    saving={saving}
    error={error}
    demo={demo}
    setDemo={setDemo}
    stats={[
      {label:'Diamantes',value:diamonds,icon:Gem},
      {label:'Regalos',value:gifts,icon:Gift},
      {label:'Usuarios',value:participants,icon:Users},
    ]}
    preview={<GiftersBoard key={demo?'demo':'live'} config={config} ranking={demo?demoRows:tool.ranking} total={total} preview/>}
  />;
}
