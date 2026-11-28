import { boardStyle } from '../lib/widget-css';
import {createPortal} from 'react-dom';
import boardCSS from './likes.css?raw';
import {validateThemeCSS} from '../../../shared/custom-themes';
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {Heart,Crown,Users} from 'lucide-react';
import {useStudio} from '../hooks/use-studio';
import {useNotificationSettings} from '../hooks/use-notification-settings';
import {defaultLikes,validateLikes,safeAvatar} from '../../../modules/likes/config';
import './likes.css';
import {LikesCount,useLikesMotion,useLikesDemo} from './likes-motion';
import {RankingEditor} from './ranking-editor';
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
  let css='';try{if(config.cssEnabled)css=validateThemeCSS(config.customCss);}catch{}
  const board=<LikesBoardContent {...props} config={config}/>;
  return css?<LikesCSSSurface css={css}>{board}</LikesCSSSurface>:board;
}
function LikesBoardContent({config,ranking=[],total=0,preview=false}){
  const list=useLikesMotion(JSON.stringify([config.enabled,config.limit,config.width,config.fontSize,config.style,config.customCss,ranking.map(user=>[user.id,user.name])]));
  if(!config.enabled&&!preview)return null;
  const alpha=value=>Math.round(value*2.55).toString(16).padStart(2,'0');
  const rows=ranking.slice(0,config.limit);
  const peak=Math.max(1,...rows.map(user=>Number(user.likes)||0));
  return <section className={"likes-board likes-style-"+config.style+(config.rgbNames?" likes-rgb-names":"")+(config.animateNames?" likes-animated-names":"")+(config.pulseHearts?" likes-pulse-hearts":"")+(Number(config.opacity)<=0?" likes-flat":"")} aria-label="Clasificación de likes" style={boardStyle('likes', config)}>
    {config.showTitle&&<header><Heart aria-hidden="true"/><strong>{config.title}</strong></header>}
    {rows.length?<ol ref={list}>{rows.map((user,index)=>{
      const likes=Number(user.likes)||0;
      const share=Math.max(4,Math.round(likes/peak*100));
      return <li key={user.id} data-user-id={user.id} style={{'--likes-share':share+'%'}}>
        <span className="likes-rank">{config.style==='medals'&&index<3?['🥇','🥈','🥉'][index]:index+1}</span>
        <span className="likes-portrait"><LikesAvatar user={user}/>{index===0&&<Crown className="likes-crown" role="img" aria-label="Primer puesto"/>}</span>
        <span className="likes-name">{user.name}</span>
        <strong className="likes-score"><span className="likes-heart" aria-label="likes">♥</span> <LikesCount value={likes}/></strong>
      </li>;
    })}</ol>:<p className="likes-empty">Esperando los primeros likes…</p>}
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
  const [demo,setDemo]=useState(false);
  const demoRows=useLikesDemo(demo,sample);
  const total=demo?demoRows.reduce((sum,row)=>sum+row.likes,0):tool.total;
  const participants=demo?demoRows.length:tool.participants||0;
  return <RankingEditor
    variant="likes"
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
      {label:'Likes',value:total,icon:Heart},
      {label:'Usuarios',value:participants,icon:Users},
    ]}
    preview={<LikesBoard key={demo?'demo':'live'} config={config} ranking={demo?demoRows:tool.ranking} total={total} preview/>}
  />;
}
