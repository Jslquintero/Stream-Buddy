import { FilePicker } from './ui/file-picker';
import { OutputLinks } from './output-controls';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useId } from 'react';
import { LayoutLibrary } from './layout-library';
import { Button, Card, Dialog, Select, Input, Textarea, Badge } from './ui';
import { themes, layoutTemplates, createVerticalLayout, isCameraWindow, backgroundMode, createIconRow, canvasSize, messengerCameraKind, messengerCameraDimensions, messengerCameraMinSide, messengerCameraMaxSide } from '../../../shared/layout';
import { MessengerCameraFrame, MessengerCameraOpening, messengerCameraDefaultColor } from './messenger-camera-frame';
import { IconRow, IconRowEditor } from './icon-row';
import { CustomThemeEditor, ThemeSurface } from './custom-theme';
import { useLayoutAutosave } from '../hooks/use-layout-autosave';
import { useLayoutHistory } from '../hooks/use-layout-history';
import { LayoutNumberField } from './layout-number-field';
import { gridTransform } from '../lib/layout-grid';
import { XpControls } from './xp-controls';
import { xpControlsBounds } from '../../../shared/xp-controls';
import { readBackgroundImage } from '../lib/layout-image';
import { useStudio } from '../hooks/use-studio';
import { layoutOutputURL } from '../../../shared/layout-url';
import { EditorViewSwitch } from './editor-view-switch';
import { AppWindow, Camera, ChevronDown, ChevronUp, Eye, EyeOff, FolderOpen, Frame, Gamepad2, Image as ImageIcon, Layers, LayoutTemplate, Monitor, MousePointer2, Palette, PanelBottom, Plus, Redo2, Save, SlidersHorizontal, Square, Trash2, Type, Undo2, Wand2, X } from 'lucide-react';
import './layout.css';

function XpElement({ element, document, remove, update, select }) {
  if (element.kind === 'taskbar') {
    const {width,height} = canvasSize(document);
    const scale = element.h * height / 100 / 30;
    return <div className="xp-taskbar-surface" style={{width:element.w*width/100/scale,height:30,transform:`scale(${scale})`,transformOrigin:'top left'}}>
      <span className={'start '+(element.title==='start'?'reference-start':'custom-start')} aria-label={element.title}>{element.title!=='start'&&<><span className="xp-start-flag"/><span className="xp-start-label">{element.title}</span></>}</span>
      <div className="task-apps">{document.elements.filter(e=>e.kind!=='taskbar'&&e.kind!=='icons'&&e.kind!==messengerCameraKind&&!e.hidden).map((e,i)=><span className="task-tab" key={e.id}><span className={'xp-task-icon '+(i===1?'xp-task-recycle':'xp-task-folder')}/><span className="task-caption">{e.title}</span></span>)}</div>
      {element.text&&<span className="clock">{element.text}</span>}
    </div>;
  }
  return <><div className="xp-title"><span className="window-app-icon" aria-hidden="true"/><span className="title-text">{element.title}</span></div><div className="xp-content clear" style={{fontSize:element.fontSize,backgroundColor:'transparent'}}>{element.text}</div><XpControls element={element} document={document} remove={remove} update={update} select={select}/></>;
}

export function LayoutCanvas({ document, selected, select, update, remove, guides=false, selectedIcon, selectIcon, grid=false, gridSize=8 }) {
  const customTheme=document.customThemes?.find(theme=>theme.id===document.theme);
  const maskId=useId().replace(/[^a-zA-Z0-9_-]/g,'');
  const canvas = useRef(null), plane = useRef(null), drag = useRef(null);
  const [scale,setScale] = useState(1);
  const [apertures,setApertures]=useState(null);
  const {width,height} = canvasSize(document);
  useLayoutEffect(()=>{
    const resize=()=>{if(canvas.current?.clientWidth&&canvas.current.clientHeight){setScale(Math.min(canvas.current.clientWidth/width,canvas.current.clientHeight/height));}};
    resize(); const observer=new ResizeObserver(resize);observer.observe(canvas.current);return ()=>observer.disconnect();
  },[width,height]);
  useLayoutEffect(()=>{
    if(!customTheme){setApertures(null);return;}
    let observer;
    const timer=setTimeout(()=>{
      const root=plane.current?.querySelector('.custom-theme-host')?.shadowRoot;
      if(!root)return;
      const contents=[...root.querySelectorAll('.layout-item:not(.taskbar) .layout-content')];
      const measure=()=>{
        const bounds=plane.current.getBoundingClientRect();
        if(!bounds.width||!bounds.height)return;
        const next=contents.map(content=>{const rect=content.getBoundingClientRect();return {id:content.parentElement.dataset.elementId,x:(rect.left-bounds.left)*width/bounds.width,y:(rect.top-bounds.top)*height/bounds.height,w:rect.width*width/bounds.width,h:rect.height*height/bounds.height};});
        setApertures(previous=>JSON.stringify(previous)===JSON.stringify(next)?previous:next);
      };
      measure();observer=new ResizeObserver(measure);contents.forEach(content=>observer.observe(content));
    },0);
    return ()=>{clearTimeout(timer);observer?.disconnect();};
  },[document,customTheme,width,height,scale]);
  const begin = (event, element, resize = false) => {
    if (!update || event.button !== 0) return;
    event.stopPropagation(); select(element.id);
    if(element.kind==='icons')selectIcon?.(element.id,event.target.closest('[data-icon-id]')?.dataset.iconId||element.icons[0].id);
    canvas.current.focus({ preventScroll: true });
    const rect = plane.current.getBoundingClientRect();
    drag.current = { element, resize, x: event.clientX, y: event.clientY, rect };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const move = event => {
    const d = drag.current; if (!d) return;
    if(!d.moving&&Math.hypot(event.clientX-d.x,event.clientY-d.y)<3)return;
    d.moving=true;
    const dx=(event.clientX-d.x)/d.rect.width*width,dy=(event.clientY-d.y)/d.rect.height*height;
    update(d.element.id,gridTransform(d.element,dx,dy,width,height,{resize:d.resize,step:gridSize,snap:grid&&!event.altKey,lockAxis:event.shiftKey}));
  };
  return <div ref={canvas} tabIndex={update?0:undefined} aria-label={update?'Lienzo editable. Selecciona un elemento y pulsa Supr para eliminarlo.':undefined} className={`layout-canvas theme-${customTheme?'custom':document.theme} ${update?'editable':''}`} style={{aspectRatio:`${width} / ${height}`}} onPointerMove={move} onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}}>
    <div ref={plane} className="layout-plane" data-width={width} data-height={height} style={{width,height,transform:`translate(-50%, -50%) scale(${scale})`}}><ThemeSurface theme={customTheme}>
    {backgroundMode(document)!=='transparent'&&<svg className="layout-background" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true"><defs><mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width={width} height={height}><rect width={width} height={height} fill="white"/>{document.elements.filter(e=>!e.hidden&&e.kind!=='taskbar'&&e.kind!=='icons').map(e=>{
      if(e.kind===messengerCameraKind)return <MessengerCameraOpening key={e.id} element={e} width={width} height={height}/>;
      // Luna's transparent opening starts below its 29px title, inside the 3px frame.
      // Cutting the entire outer rectangle also removes the background at rounded corners.
      const opening=customTheme&&apertures?.find(a=>a.id===e.id);if(opening)return <rect key={e.id} x={opening.x} y={opening.y} width={opening.w} height={opening.h} fill="black"/>;
      const xp=document.theme==='xp';
      return <rect key={e.id} x={e.x*width/100+(xp?3:0)} y={e.y*height/100+(xp?29:0)} width={Math.max(0,e.w*width/100-(xp?6:0))} height={Math.max(0,e.h*height/100-(xp?32:0))} rx={xp?0:7} fill="black"/>;
    })}</mask></defs><g mask={`url(#${maskId})`}><rect width={width} height={height} fill={document.background}/>{backgroundMode(document)==='image'&&document.backgroundImage&&<image href={document.backgroundImage} width={width} height={height} preserveAspectRatio={document.backgroundFit==='stretch'?'none':document.backgroundFit==='contain'?'xMidYMid meet':'xMidYMid slice'}/>}</g></svg>}
    {document.elements.filter(e=>!e.hidden).map(e=><div key={e.id} data-element-id={e.id} className={`${e.kind===messengerCameraKind?'':e.kind==='icons'?'layout-icon-row':document.theme==='xp'?(e.kind==='taskbar'?'editable-taskbar':'xp-window'):'layout-element'} layout-item ${e.kind} ${selected===e.id?'selected':''}`} style={{left:e.x+'%',top:e.y+'%',width:e.w+'%',height:e.h+'%',zIndex:document.elements.indexOf(e),backgroundColor:customTheme?undefined:'transparent'}} onPointerDown={event=>begin(event,e)}>
      {e.kind===messengerCameraKind?<MessengerCameraFrame theme={document.theme} color={e.frameColor} animated={e.frameAnimated}/>:e.kind==='icons'?<IconRow row={e} theme={document.theme} selectedIcon={selected===e.id?selectedIcon:null} onSelect={update?iconId=>selectIcon?.(e.id,iconId):undefined}/>:document.theme==='xp'?<XpElement element={e} document={document} remove={remove} update={update} select={select}/>:<><div className="layout-title"><span>{e.title}</span></div>
      <div className="layout-content" style={{fontSize:`${e.fontSize / (width/100)}cqw`,backgroundColor:customTheme?undefined:'transparent',color:customTheme?undefined:'#fff'}}>{e.text}</div></>}
      {update&&selected===e.id&&<button className="layout-resize" aria-label="Redimensionar elemento" onPointerDown={event=>begin(event,e,true)}/>}
      {update&&(e.kind===messengerCameraKind||(e.kind==='frame'&&!e.text))&&<div className={'layout-source-placeholder '+(isCameraWindow(e)?'camera':'game')} style={e.kind===messengerCameraKind?{inset:'8%',padding:0}:document.theme==='xp'?{top:29,fontSize:26}:undefined}>{isCameraWindow(e)?<Camera/>:<Gamepad2/>}<strong>{e.title}</strong>{e.kind!==messengerCameraKind&&<span>Interior transparente · fuente debajo del overlay</span>}</div>}
    </div>)}</ThemeSurface>{update&&grid&&<svg className="layout-grid-overlay" width={width} height={height} aria-hidden="true"><defs><pattern id={'grid-'+maskId} width={gridSize} height={gridSize} patternUnits="userSpaceOnUse"><path d={`M ${gridSize} 0 H 0 V ${gridSize}`} fill="none" stroke="#a7c5e9" strokeOpacity=".22" strokeWidth={Math.min(2,1/scale)}/></pattern></defs><rect width="100%" height="100%" fill={`url(#grid-${maskId})`}/></svg>}</div>
    {guides&&document.format==='portrait'&&<div className="layout-guides" aria-hidden="true"><span className="guide-top">Perfil</span><span className="guide-left">Margen</span><span className="guide-right">Controles</span><span className="guide-bottom">Comentarios e interacción · espacio orientativo</span></div>}
  </div>;
}

export function LayoutOutput({ compositionId }) {
  const { state } = useStudio('layout');
  useEffect(()=>{ document.documentElement.classList.add('layout-output'); return ()=>document.documentElement.classList.remove('layout-output'); },[]);
  const layout = state?.tools.layout;
  const outputDocument = compositionId === null
    ? layout?.document
    : layout?.compositions?.find(item => item.id === compositionId)?.document;
  return outputDocument ? <LayoutCanvas document={outputDocument}/> : null;
}

const elementKinds = {
  text: { label: 'Texto', Icon: Type },
  frame: { label: 'Marco', Icon: Frame },
  taskbar: { label: 'Barra de tareas', Icon: PanelBottom },
  icons: { label: 'Fila de iconos', Icon: AppWindow },
  [messengerCameraKind]: { label: 'Cámara MSN', Icon: Camera },
};
const elementKind = kind => elementKinds[kind] ?? { label: 'Elemento', Icon: Square };
const backgroundLabels = { transparent: 'Transparente', color: 'Color', image: 'Imagen' };

export function LayoutStudio({ tool, api, notice, compositionId, open }) {
  const [selected,setSelected]=useState('welcome');
  const [guides,setGuides]=useState(false), [templateUndo,setTemplateUndo]=useState('');
  const [customResolution,setCustomResolution]=useState(false);
  const [grid,setGrid]=useState(true),[gridSize,setGridSize]=useState(8);
  const [loadingImage,setLoadingImage]=useState(false);
  const [selectedIcon,setSelectedIcon]=useState(null),[iconImageTasks,setIconImageTasks]=useState(0);
  const [libraryOpen,setLibraryOpen]=useState(false);
  const [templatesOpen,setTemplatesOpen]=useState(false);
  const [themeOpen,setThemeOpen]=useState(false);
  const [mobileView,setMobileView]=useState('editor');
  const composition=tool?.compositions?.find(item=>item.id===compositionId);
  const editorApi=useCallback((action,body)=>compositionId&&action==='layout/save'?api('layout/save-composition',{id:compositionId,document:body}):api(action,body),[api,compositionId]);
  const source=compositionId?composition:tool;
  const {draft,setDraft,dirty,saving,save,error:saveError}=useLayoutAutosave(source?.document,source?.revision,editorApi,loadingImage||iconImageTasks>0);
  const {commit,undo,redo,canUndo,canRedo}=useLayoutHistory(draft,setDraft);
  useEffect(()=>{
    if(!libraryOpen&&!templatesOpen&&!themeOpen)return;
    const close=event=>{if(event.key==='Escape'){setLibraryOpen(false);setTemplatesOpen(false);setThemeOpen(false);}};
    document.addEventListener('keydown',close);
    return ()=>document.removeEventListener('keydown',close);
  },[libraryOpen,templatesOpen,themeOpen]);
  if(!draft)return <Card className="loading">Cargando editor…</Card>;
  const commitEdit = (updater,key='') => {
    if(templateUndo)setTemplateUndo('');
    commit(updater,key);
  };
  const undoChange = () => {setTemplateUndo('');undo();};
  const redoChange = () => {setTemplateUndo('');redo();};
  const change = patch => {
    const key = typeof patch==='function' ? '' : 'change:'+Object.keys(patch).sort().join(',');
    commitEdit(d=>({...d,...(typeof patch==='function'?patch(d):patch)}),key);
  };
  const uploadBackground = async file => {
    setLoadingImage(true);
    try {const image=await readBackgroundImage(file);change({backgroundImage:image,backgroundMode:'image',transparent:false});}
    catch(error){notice(error.message,{type:'error'});}finally{setLoadingImage(false);}
  };
  const update = (id,patch) => {commitEdit(d=>({...d,elements:d.elements.map(e=>e.id===id?{...e,...patch}:e)}),'element:'+id+':'+Object.keys(patch).sort().join(','));};
  const updateIcon = (rowId,iconId,patch) => {commitEdit(d=>({...d,elements:d.elements.map(e=>e.id===rowId&&e.kind==='icons'?{...e,icons:e.icons.map(i=>i.id===iconId?{...i,...patch}:i)}:e)}),'icon:'+rowId+':'+iconId+':'+Object.keys(patch).sort().join(','));};
  const chooseIcon = (rowId,iconId) => {setSelected(rowId);setSelectedIcon(iconId);};
  const remove = id => {
    if (!draft.elements.some(e=>e.id===id)) return;
    commitEdit(d=>({...d,elements:d.elements.filter(e=>e.id!==id)}));
    setSelected(current=>current===id?null:current);
  };
  const moveLayer = (id,direction) => commitEdit(d=>{
    const elements=[...d.elements],index=elements.findIndex(e=>e.id===id),target=index+direction;
    if(index<0||target<0||target>=elements.length)return d;
    [elements[index],elements[target]]=[elements[target],elements[index]];
    return {...d,elements};
  });
  const deleteKey = event => {
    if (event.target.closest('.layout-library, .dialog')) return;
    const typing=event.target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])');
    if((event.ctrlKey||event.metaKey)&&!event.altKey&&!typing&&!event.isComposing){
      const key=event.key.toLowerCase();
      if(key==='z'){event.preventDefault();if(event.shiftKey)redoChange();else undoChange();return;}
      if(key==='y'){event.preventDefault();redoChange();return;}
    }
    if(typing)return;
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)&&!event.isComposing&&!event.ctrlKey&&!event.altKey&&!event.metaKey&&!event.target.closest('button,a')){
      const element=draft.elements.find(e=>e.id===selected);
      if(element){event.preventDefault();const size=canvasSize(draft),step=event.shiftKey?10:1;update(element.id,gridTransform(element,event.key==='ArrowLeft'?-step:event.key==='ArrowRight'?step:0,event.key==='ArrowUp'?-step:event.key==='ArrowDown'?step:0,size.width,size.height,{snap:false}));}
      return;
    }
    if (!['Delete','Backspace'].includes(event.key) || event.isComposing || event.ctrlKey || event.altKey || event.metaKey) return;
    if (draft.elements.some(e=>e.id===selected)) {event.preventDefault();remove(selected);}
  };
  const {width,height}=canvasSize(draft);
  const setCanvasSize=(w,h)=>commitEdit(d=>{
    const previous=canvasSize(d);
    const scale=Math.min(w,h)/Math.min(previous.width,previous.height);
    const elements=d.elements.map(e=>{
      if(e.kind!==messengerCameraKind)return e;
      const side=Math.min(w,h,Math.max(messengerCameraMinSide(w,h),e.w*previous.width/100*scale));
      const dimensions=messengerCameraDimensions(side,w,h);
      return {...e,...dimensions,x:Math.min(e.x,100-dimensions.w),y:Math.min(e.y,100-dimensions.h)};
    });
    return {...d,canvasWidth:w,canvasHeight:h,format:h>w?'portrait':'landscape',elements};
  },'canvas-size');
  const resizeCanvas=(key,value)=>setCanvasSize(key==='width'?Math.round(value):width,key==='height'?Math.round(value):height);
  const current = draft.elements.find(e=>e.id===selected);
  const messengerSelected=current?.kind===messengerCameraKind;
  const KindIcon = current ? elementKind(current.kind).Icon : null;
  const defaultCameraColor=messengerCameraDefaultColor(draft.theme);
  const controlsBounds = current && xpControlsBounds(current,width,height);
  const controlPosition = axis => {
    const range=axis==='x'?controlsBounds.rangeX:controlsBounds.rangeY;
    const position=axis==='x'?controlsBounds.left:controlsBounds.top;
    return <LayoutNumberField label={`Controles ${axis.toUpperCase()} (px)`} value={position} min={controlsBounds.padding} max={controlsBounds.padding+range} onChange={value=>update(current.id,{xpControls:{...current.xpControls,x:current.xpControls?.x??1,y:current.xpControls?.y??0,[axis]:range?Math.min(1,Math.max(0,(value-controlsBounds.padding)/range)):axis==='x'?1:0}})}/>;
  };
  const applyTemplate = template => {
    const next=layoutTemplates[template];
    if(!next)return;
    commit({...createVerticalLayout(template,Object.hasOwn(themes,draft.theme)?draft.theme:'dark'),theme:draft.theme,...(draft.customThemes?{customThemes:draft.customThemes}:{})});
    setTemplateUndo(next.name);
    setSelected('camera');setTemplatesOpen(false);
    notice?.(`Plantilla «${next.name}» aplicada. Puedes deshacerla.`,{type:'info'});
  };
  const undoTemplate = () => {
    if(!templateUndo)return;
    setTemplateUndo('');
    if(undo()){setSelected(null);notice?.('Plantilla deshecha.',{type:'info'});}
  };
  const openComposition = view => {setLibraryOpen(false);open?.(view);};
  const output = layoutOutputURL(window.location.href,compositionId);
  const addMessengerCamera = () => {
    const id=crypto.randomUUID();
    const dimensions=messengerCameraDimensions(Math.min(width,height)*.4,width,height);
    commitEdit(d=>({...d,elements:[...d.elements,{id,kind:messengerCameraKind,title:'Cámara MSN Messenger',text:'',x:10,y:25,...dimensions,fontSize:26,hidden:false}]}));
    setSelected(id);
  };
  const add = kind => {
    if(kind==='icons'){
      const row=createIconRow(crypto.randomUUID());
      if(draft.format==='landscape'){row.y=84;row.h=12;}
      commitEdit(d=>({...d,elements:[...d.elements,row]}));
      chooseIcon(row.id,row.icons[0].id);
      return;
    }
    const id=(kind==='frame'?'camera-':'')+crypto.randomUUID(),barHeight=Math.max(1,40/height*100);
    const element={id,kind,title:kind==='taskbar'?'start':kind==='frame'?'Cámara.exe':'Ventana.exe',text:kind==='text'?'Escribe aquí':'',x:kind==='taskbar'?0:10,y:kind==='taskbar'?100-barHeight:25,w:kind==='taskbar'?100:40,h:kind==='taskbar'?barHeight:25,fontSize:26,hidden:false};
    commitEdit(d=>({...d,elements:[...d.elements,element]}));
    setSelected(id);
  };

  const number = (key,label,min,max) => {
    const factor=['x','w'].includes(key)?width/100:['y','h'].includes(key)?height/100:1;
    return <LayoutNumberField key={current.id+'-'+key+'-'+draft.format} label={label} value={current[key]*factor} min={min*factor} max={max*factor} onChange={pixels=>update(current.id,{[key]:pixels/factor})}/>;
  };
  const saveState = saveError ? 'error' : saving ? 'saving' : dirty ? 'dirty' : 'saved';
  const saveLabel = saveError ? 'Error al guardar' : saving ? 'Guardando…' : dirty ? 'Cambios pendientes…' : 'Autoguardado · salida sincronizada';
  const preset = width===1080&&height===1920 ? 'portrait' : width===1920&&height===1080 ? 'landscape' : 'custom';
  const activeCustomTheme = draft.customThemes?.find(theme=>theme.id===draft.theme);
  const themeLabel = themes[draft.theme] ?? activeCustomTheme?.name ?? 'Tema personalizado';
  const backgroundLabel = backgroundLabels[backgroundMode(draft)] ?? 'Fondo';
  const layers = [...draft.elements].reverse();
  const canAdd = draft.elements.length < 30;
  const gridStepChange = event => {const next=Number(event.target.value);if(Number.isFinite(next))setGridSize(Math.min(128,Math.max(1,Math.round(next))));};

  return <div className="layout-studio layout-editor" onKeyDown={deleteKey}>
    <header className="layout-header">
      <div className="layout-heading">
        <span className="layout-heading-icon" aria-hidden="true"><Monitor size={22}/></span>
        <div className="layout-heading-copy">
          <p className="eyebrow">ESCENAS DEL DIRECTO</p>
          <h1 className="layout-heading-title">{composition?.name ?? 'Escena principal'}</h1>
          <p className="layout-heading-subtitle">{composition ? 'Composición guardada · ' : ''}Diseña el fondo y las ventanas que verá tu audiencia. La salida se actualiza sola.</p>
        </div>
      </div>
      <div className="layout-header-actions">
        <span className={'layout-status is-'+saveState} role="status"><span className="layout-status-dot"/>{saveLabel}</span>
        <div className="layout-header-buttons">
          <Button size="icon" variant="ghost" disabled={!canUndo} onClick={undoChange} aria-label="Deshacer" title="Deshacer · Ctrl+Z"><Undo2 size={16}/></Button>
          <Button size="icon" variant="ghost" disabled={!canRedo} onClick={redoChange} aria-label="Rehacer" title="Rehacer · Ctrl+Shift+Z"><Redo2 size={16}/></Button>
          <Button size="sm" disabled={!dirty||saving||loadingImage||iconImageTasks>0} onClick={save}><Save size={14}/>{saving?'Guardando…':saveError?'Reintentar':'Guardar layout'}</Button>
        </div>
      </div>
    </header>
    {tool.error&&<p className="layout-alert error" role="alert">{tool.error}</p>}
    {saveError&&<p className="layout-alert error" role="alert">{saveError} Tus cambios siguen en el editor.</p>}
    <div className="layout-toolbar">
      <div className="layout-toolbar-meta">
        <Badge>{draft.format==='portrait'?'Vertical · 9:16':'Horizontal · 16:9'}</Badge>
        <Badge>{width} × {height} px</Badge>
        <Badge>{draft.elements.length} {draft.elements.length===1?'elemento':'elementos'}</Badge>
        <Badge>{themeLabel}</Badge>
      </div>
      <div className="layout-toolbar-actions">
        <Button variant="outline" size="sm" onClick={()=>setLibraryOpen(true)}><FolderOpen size={15}/>Mis composiciones<span className="layout-toolbar-count">{1+(tool.compositions?.length||0)}</span></Button>
        <Button variant="outline" size="sm" onClick={()=>setTemplatesOpen(true)}><LayoutTemplate size={15}/>Plantillas</Button>
        <OutputLinks notice={notice} url={output} message={`Enlace de ${composition?.name ?? 'Layout principal'} copiado.`} fallback="Salida" openLabel="Ver salida" size="sm" iconSize={14}/>
      </div>
    </div>
    {templateUndo&&<div className="layout-undo-bar" role="status"><Wand2 size={15}/><span>Plantilla <strong>{templateUndo}</strong> aplicada.</span><Button variant="ghost" size="sm" onClick={undoTemplate}><Undo2 size={14}/>Deshacer plantilla</Button></div>}
    <EditorViewSwitch view={mobileView} change={setMobileView} editorLabel="Ajustes" monitorLabel="Lienzo"/>
    <div className="layout-editor-grid" data-view={mobileView}>
      <Card className="layout-options layout-panel layout-panel-setup">
        <div className="layout-panel-head"><div><h2>Escena</h2><p className="help">Estilo, lienzo y fondo del overlay.</p></div></div>
        <div className="layout-panel-block">
          <div className="layout-block-head"><h3><Palette size={14}/>Estilo</h3><span className="layout-block-meta">{themeLabel}</span></div>
          <div className="layout-theme-grid">
            {Object.entries(themes).map(([id,name])=><button key={id} type="button" data-theme={id} className="layout-theme-card" aria-pressed={draft.theme===id} onClick={()=>change({theme:id})}>
              <span className="layout-theme-preview" aria-hidden="true"/><span className="layout-theme-name">{name}</span>
            </button>)}
            <button type="button" className="layout-theme-card is-manage" aria-pressed={Boolean(activeCustomTheme)} onClick={()=>setThemeOpen(true)}>
              <span className="layout-theme-preview layout-theme-preview-custom" aria-hidden="true"><Palette size={14}/></span>
              <span className="layout-theme-name">{activeCustomTheme ? activeCustomTheme.name : draft.customThemes?.length ? `${draft.customThemes.length} temas CSS` : 'Temas CSS'}</span>
              <small>{activeCustomTheme ? 'En uso · gestionar' : 'Crear o importar'}</small>
            </button>
          </div>
        </div>
        <details className="layout-fold" open>
          <summary><span>Lienzo</span><span className="layout-fold-meta">{width} × {height}</span></summary>
          <div className="layout-fold-body">
            <label>Formato<Select value={customResolution?'custom':preset} onChange={event=>{
              const format=event.target.value;
              setCustomResolution(format==='custom');
              if(format==='custom'){
                const input=event.currentTarget.closest('.layout-panel-setup').querySelector('[aria-label="Ancho del lienzo (px)"]');
                input?.focus();input?.select();
              }else setCanvasSize(format==='portrait'?1080:1920,format==='portrait'?1920:1080);
            }}><option value="custom">Personalizado</option><option value="landscape">Horizontal · 16:9</option><option value="portrait">Vertical · 9:16</option></Select></label>
            <div className="layout-field-grid">
              <LayoutNumberField label="Ancho del lienzo (px)" value={width} min={240} max={7680} onChange={value=>resizeCanvas('width',value)}/>
              <LayoutNumberField label="Alto del lienzo (px)" value={height} min={240} max={7680} onChange={value=>resizeCanvas('height',value)}/>
            </div>
            <p className="layout-note"><SlidersHorizontal size={13}/>{preset==='custom'?'Tamaño personalizado. Los elementos conservan su posición proporcional.':'Al cambiar de formato, los elementos se adaptan de forma proporcional.'}</p>
          </div>
        </details>
        <details className="layout-fold" open>
          <summary><span>Fondo</span><span className="layout-fold-meta">{backgroundLabel}</span></summary>
          <div className="layout-fold-body">
            <div className="layout-segmented" role="group" aria-label="Tipo de fondo">
              <button type="button" aria-pressed={backgroundMode(draft)==='transparent'} disabled={loadingImage} onClick={()=>change({backgroundMode:'transparent',transparent:true})}><EyeOff size={15}/>Transparente</button>
              <button type="button" aria-pressed={backgroundMode(draft)==='color'} disabled={loadingImage} onClick={()=>change({backgroundMode:'color',transparent:false})}><Palette size={15}/>Color</button>
              <button type="button" aria-pressed={backgroundMode(draft)==='image'} disabled={loadingImage} onClick={()=>change({backgroundMode:'image',transparent:false})}><ImageIcon size={15}/>Imagen</button>
            </div>
            <label>Color de fondo<span className="layout-color-field"><Input type="color" value={draft.background} onChange={e=>change({background:e.target.value,backgroundMode:'color',transparent:false})}/><span>{draft.background}</span></span></label>
            <FilePicker label={loadingImage?'Preparando imagen…':draft.backgroundImage?'Cambiar imagen':'Subir imagen'} accept="image/png,image/jpeg,image/webp" disabled={loadingImage} onFile={uploadBackground}/>
            {draft.backgroundImage&&<><img className="layout-background-thumbnail" src={draft.backgroundImage} alt="Fondo seleccionado"/><label>Ajuste de imagen<Select value={draft.backgroundFit||'cover'} onChange={e=>change({backgroundFit:e.target.value,backgroundMode:'image',transparent:false})}><option value="cover">Rellenar (recortar bordes)</option><option value="contain">Mostrar imagen completa</option><option value="stretch">Estirar</option></Select></label><Button variant="outline" size="sm" disabled={loadingImage} onClick={()=>change({backgroundImage:'',backgroundMode:'color',transparent:false})}>Quitar imagen</Button></>}
            <p className="layout-note"><ImageIcon size={13}/>PNG, JPG o WebP · hasta 10 MB. El fondo respeta los huecos transparentes de las ventanas.</p>
          </div>
        </details>
      </Card>

      <section className="layout-preview layout-preview-body" aria-label="Lienzo de la escena">
        <div className="layout-preview-bar">
          <div className="layout-preview-title"><span>VISTA PREVIA</span><strong>{width} × {height} px</strong></div>
          <div className="layout-view-options">
            <label className="layout-check"><input type="checkbox" checked={grid} onChange={e=>setGrid(e.target.checked)}/> Cuadrícula</label>
            {grid&&<label className="layout-grid-size">Paso<Input type="number" min="1" max="128" value={gridSize} aria-label="Paso de cuadrícula (px)" onChange={gridStepChange}/>px</label>}
            {draft.format==='portrait'&&<label className="layout-check"><input type="checkbox" checked={guides} onChange={e=>setGuides(e.target.checked)}/> Guías de interfaz</label>}
          </div>
        </div>
        <p className="help layout-preview-help">Lienzo de {width} × {height} px · Arrastra para mover y pulsa un elemento para editarlo.</p>
        <div className="layout-addbar" role="group" aria-label="Añadir elemento">
          <span className="layout-addbar-title"><Plus size={14}/>Añadir</span>
          <Button size="sm" variant="outline" disabled={!canAdd} onClick={()=>add('text')}><Type size={14}/>+ Texto</Button>
          <Button size="sm" variant="outline" disabled={!canAdd} onClick={()=>add('frame')}><Frame size={14}/>+ Marco</Button>
          <Button size="sm" variant="outline" disabled={!canAdd} onClick={addMessengerCamera}><Camera size={14}/>+ Cámara MSN Messenger</Button>
          <Button size="sm" variant="outline" disabled={!canAdd} onClick={()=>add('taskbar')}><PanelBottom size={14}/>+ Barra de tareas</Button>
          <Button size="sm" variant="outline" disabled={!canAdd} onClick={()=>add('icons')}><AppWindow size={14}/>+ Fila de iconos</Button>
        </div>
        <div className={'layout-stage '+draft.format}>
          <LayoutCanvas document={draft} selected={selected} select={setSelected} update={update} remove={remove} guides={guides} grid={grid} gridSize={gridSize} selectedIcon={selectedIcon} selectIcon={chooseIcon}/>
        </div>
        <div className="layout-preview-foot">
          <p className="help">Arrastra para mover · Alt: libre · Mayús: bloquear eje · Flechas: 1 px · Mayús + flechas: 10 px</p>
          <details className="layout-hints"><summary>Guías, salida y encuadre</summary><ul>
            <li>Las guías y los indicadores de cámara o juego solo aparecen en este editor.</li>
            <li>El espacio para la interfaz es orientativo. Configura la fuente de navegador en {width} × {height} px para que llene el encuadre.</li>
            <li>Todas las ventanas tienen el interior transparente. Coloca las fuentes de cámara y juego debajo del overlay en OBS o TikTok LIVE Studio.</li>
            <li>Los cambios se guardan automáticamente y actualizan la salida del directo.</li>
            <li><kbd>Ctrl</kbd> + <kbd>Z</kbd> deshace · <kbd>Ctrl</kbd> + <kbd>Mayús</kbd> + <kbd>Z</kbd> rehace.</li>
          </ul></details>
        </div>
      </section>

      <Card className="layout-inspector layout-panel layout-panel-inspector">
        <div className="layout-panel-head">
          <div><h2>Propiedades</h2><p className="help">Ajusta el elemento seleccionado.</p></div>
          {current&&<Badge className="layout-kind-badge">{KindIcon&&<KindIcon size={12}/>}{elementKind(current.kind).label}</Badge>}
        </div>
        {current?<div className="layout-inspector-body">
          <section className="layout-prop-group">
            <div className="layout-block-head"><h3>Contenido</h3></div>
            <label>{current.kind==='taskbar'?'Texto de Inicio':'Título'}<Input maxLength={80} value={current.title} onChange={e=>update(current.id,{title:e.target.value})}/></label>
            {current.kind!=='icons'&&!messengerSelected&&<label>{current.kind==='taskbar'?'Reloj (vacío para ocultar)':'Texto'}<Textarea rows={3} maxLength={300} value={current.text} onChange={e=>update(current.id,{text:e.target.value})}/></label>}
            {!messengerSelected&&number('fontSize',current.kind==='icons'?'Tamaño del texto de los iconos (px)':'Tamaño de texto (px)',10,72)}
          </section>
          <section className="layout-prop-group">
            <div className="layout-block-head"><h3>Posición y tamaño</h3></div>
            <div className="layout-field-grid">
              {number('x','X (px)',0,Math.min(99,100-current.w))}
              {number('y','Y (px)',0,Math.min(99,100-current.h))}
              {messengerSelected
                ? <LayoutNumberField key={current.id} label="Lado (px)" value={current.w*width/100} min={messengerCameraMinSide(width,height)} max={Math.max(messengerCameraMinSide(width,height),messengerCameraMaxSide(current,width,height))} onChange={side=>update(current.id,messengerCameraDimensions(side,width,height))}/>
                : <>{number('w','Ancho (px)',5,100-current.x)}{number('h','Alto (px)',current.kind==='taskbar'?1:5,100-current.y)}</>}
            </div>
          </section>
          {messengerSelected&&<section className="layout-prop-group">
            <div className="layout-block-head"><h3>Marco de la cámara</h3></div>
            <label>Color del marco<span className="layout-color-field"><Input type="color" value={current.frameColor??defaultCameraColor} onChange={e=>update(current.id,{frameColor:e.target.value===defaultCameraColor?undefined:e.target.value})}/><span>{current.frameColor??defaultCameraColor}</span></span></label>
            <div className="layout-inline-actions"><Button variant="outline" size="sm" disabled={!current.frameColor} onClick={()=>update(current.id,{frameColor:undefined})}>Restablecer color</Button></div>
            <label className="layout-check"><input type="checkbox" checked={current.frameAnimated??false} onChange={e=>update(current.id,{frameAnimated:e.target.checked})}/> Animar colores del marco</label>
          </section>}
          {draft.theme==='xp'&&['text','frame'].includes(current.kind)&&<section className="layout-prop-group">
            <div className="layout-block-head"><h3>Controles de ventana</h3></div>
            <p className="help">Arrastra los tres controles XP juntos dentro de la ventana. Su posición se adapta al cambiar el tamaño.</p>
            <div className="layout-inline-actions"><Button variant="outline" size="sm" onClick={()=>update(current.id,{xpControls:{x:1,y:0}})}>Restablecer controles XP</Button></div>
            <div className="layout-field-grid">{controlPosition('x')}{controlPosition('y')}</div>
            <LayoutNumberField label="Tamaño de controles (%)" value={(current.xpControls?.scale??1)*100} min={50} max={400} onChange={value=>update(current.id,{xpControls:{x:current.xpControls?.x??1,y:current.xpControls?.y??0,scale:value/100}})}/>
            <p className="help">100% es el tamaño original. Se ajustan al espacio disponible dentro de la ventana.</p>
          </section>}
          {current.kind==='icons'&&<section className="layout-prop-group">
            <div className="layout-block-head"><h3>Iconos</h3></div>
            <IconRowEditor key={current.id} row={current} selectedIcon={selectedIcon} selectIcon={setSelectedIcon} updateRow={patch=>update(current.id,patch)} updateIcon={updateIcon} notice={notice} imageTask={delta=>setIconImageTasks(count=>count+delta)} format={draft.format} canvasWidth={width} canvasHeight={height}/>
          </section>}
          <label className="layout-check"><input type="checkbox" checked={!current.hidden} onChange={e=>update(current.id,{hidden:!e.target.checked})}/> Visible en la salida</label>
          <div className="layout-inspector-actions">
            <Button size="sm" variant="outline" onClick={()=>change({elements:[...draft.elements.filter(e=>e.id!==selected),current]})}><Layers size={14}/>Traer al frente</Button>
            <Button size="sm" variant="destructive" onClick={()=>remove(selected)}><Trash2 size={14}/>Eliminar</Button>
          </div>
        </div>:<div className="layout-empty"><MousePointer2 size={22}/><strong>Ningún elemento seleccionado</strong><p>Pulsa una ventana del lienzo o una capa para editar sus propiedades.</p></div>}
        <section className="layout-layers-section">
          <div className="layout-layers-head"><div><h3><Layers size={14}/>Capas</h3><p className="help">El último aparece encima.</p></div><span className="layout-count">{draft.elements.length}</span></div>
          {draft.elements.length?<div className="layout-layer-list">{layers.map((e,index)=>{
            const Meta=elementKind(e.kind).Icon;
            return <div className={'layout-layer-row'+(selected===e.id?' is-selected':'')} key={e.id}>
              <button type="button" className="layout-layer-select" aria-pressed={selected===e.id} onClick={()=>setSelected(e.id)}>
                <span className="layout-layer-kind"><Meta size={13}/></span>
                <span className="layout-layer-name">{e.title||elementKind(e.kind).label}</span>
                {e.hidden&&<span className="layout-layer-state">Oculto</span>}
              </button>
              <div className="layout-layer-actions">
                <Button variant="ghost" size="icon" aria-label={(e.hidden?'Mostrar ':'Ocultar ')+(e.title||'elemento')} title={e.hidden?'Mostrar':'Ocultar'} onClick={()=>update(e.id,{hidden:!e.hidden})}>{e.hidden?<EyeOff size={13}/>:<Eye size={13}/>}</Button>
                <Button variant="ghost" size="icon" aria-label={'Subir '+(e.title||'elemento')} title="Subir capa" disabled={index===0} onClick={()=>moveLayer(e.id,1)}><ChevronUp size={13}/></Button>
                <Button variant="ghost" size="icon" aria-label={'Bajar '+(e.title||'elemento')} title="Bajar capa" disabled={index===layers.length-1} onClick={()=>moveLayer(e.id,-1)}><ChevronDown size={13}/></Button>
                <Button variant="destructive" size="icon" aria-label={'Eliminar elemento: '+(e.title||'Sin título')} title="Eliminar capa" onClick={()=>remove(e.id)}><Trash2 size={13}/></Button>
              </div>
            </div>;
          })}</div>:<p className="help">No hay elementos. Añade un texto, marco o barra de tareas desde la barra del lienzo.</p>}
        </section>
      </Card>
    </div>

    <Dialog open={libraryOpen} keepMounted onClose={()=>setLibraryOpen(false)} className="layout-dialog layout-dialog-library" backdropClassName="layout-dialog-backdrop" aria-label="Mis composiciones">
      <Button className="layout-dialog-close" variant="ghost" size="icon" aria-label="Cerrar biblioteca" onClick={()=>setLibraryOpen(false)}><X size={18}/></Button>
      <div className="layout-dialog-body">
        <LayoutLibrary document={draft} tool={tool} api={api} notice={notice} open={openComposition} compositionId={compositionId} busy={loadingImage||iconImageTasks>0} preview={layout=><LayoutCanvas document={layout}/>}/>
      </div>
    </Dialog>

    <Dialog open={templatesOpen} keepMounted onClose={()=>setTemplatesOpen(false)} className="layout-dialog layout-dialog-templates" backdropClassName="layout-dialog-backdrop" aria-labelledby="layout-templates-title">
      <Button className="layout-dialog-close" variant="ghost" size="icon" aria-label="Cerrar plantillas" onClick={()=>setTemplatesOpen(false)}><X size={18}/></Button>
      <div className="layout-dialog-body">
        <header className="layout-dialog-heading">
          <span className="layout-dialog-icon"><LayoutTemplate size={18}/></span>
          <div><p className="eyebrow">PENSADO PARA TIKTOK LIVE</p><h2 id="layout-templates-title">Plantillas de escena</h2><p className="help">Empieza con una composición vertical 9:16 y personaliza cada ventana. Aplicar una plantilla reemplaza el borrador actual.</p></div>
        </header>
        {templateUndo&&<div className="layout-undo-bar"><Wand2 size={15}/><span>Plantilla <strong>{templateUndo}</strong> aplicada.</span><Button variant="ghost" size="sm" onClick={undoTemplate}><Undo2 size={14}/>Deshacer</Button></div>}
        <div className="layout-template-grid">
          {Object.entries(layoutTemplates).map(([id,template])=><button type="button" className="layout-template-card vertical-preset" key={id} onClick={()=>applyTemplate(id)}>
            <span className="layout-template-preview" aria-hidden="true">
              {template.elements.map(e=><i key={e.id} className={'mini-'+e.kind} style={{left:e.x+'%',top:e.y+'%',width:e.w+'%',height:e.h+'%'}}/>)}
              <span className="layout-template-format">9:16</span>
            </span>
            <span className="layout-template-copy">
              <strong>{template.name}</strong>
              <small>{template.description}</small>
              <span className="layout-template-meta"><span>{template.elements.length} elementos</span><b>Usar plantilla →</b></span>
            </span>
          </button>)}
        </div>
        <p className="help layout-dialog-footnote">Las plantillas usan el tema activo ({themeLabel}) y el lienzo vertical. Después puedes cambiar el formato, el fondo o cualquier ventana.</p>
      </div>
    </Dialog>

    <Dialog open={themeOpen} keepMounted onClose={()=>setThemeOpen(false)} className="layout-dialog layout-dialog-theme" backdropClassName="layout-dialog-backdrop" aria-label="Temas con CSS">
      <Button className="layout-dialog-close" variant="ghost" size="icon" aria-label="Cerrar temas CSS" onClick={()=>setThemeOpen(false)}><X size={18}/></Button>
      <div className="layout-dialog-body">
        <CustomThemeEditor document={draft} change={change} preview={<LayoutCanvas document={draft}/>}/>
      </div>
    </Dialog>
  </div>;
}
