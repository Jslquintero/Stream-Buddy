import { FilePicker } from './ui/file-picker';
import { OutputLinks, OutputToolbar } from './output-controls';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useId } from 'react';
import { LayoutLibrary } from './layout-library';
import { Button, Card, Select, Input, Textarea } from './ui';
import { themes, layoutTemplates, createVerticalLayout, isCameraWindow, backgroundMode, createIconRow, canvasSize, messengerCameraKind, messengerCameraDimensions, messengerCameraMinSide, messengerCameraMaxSide } from '../../../shared/layout';
import { MessengerCameraFrame, MessengerCameraOpening, messengerCameraDefaultColor } from './messenger-camera-frame';
import { IconRow, IconRowEditor } from './icon-row';
import { CustomThemeEditor, ThemeSurface } from './custom-theme';
import { useLayoutAutosave } from '../hooks/use-layout-autosave';
import { LayoutNumberField } from './layout-number-field';
import { gridTransform } from '../lib/layout-grid';
import { XpControls } from './xp-controls';
import { xpControlsBounds } from '../../../shared/xp-controls';
import { readBackgroundImage } from '../lib/layout-image';
import { useStudio } from '../hooks/use-studio';
import { layoutOutputURL } from '../../../shared/layout-url';
import { Trash2, Camera, Gamepad2 } from 'lucide-react';

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

export function LayoutStudio({ tool, api, notice, compositionId, open }) {
  const [selected,setSelected]=useState('welcome');
  const [guides,setGuides]=useState(false), [previousLayout,setPreviousLayout]=useState(null);
  const [customResolution,setCustomResolution]=useState(false);
  const [grid,setGrid]=useState(true),[gridSize,setGridSize]=useState(8);
  const [loadingImage,setLoadingImage]=useState(false);
  const [selectedIcon,setSelectedIcon]=useState(null),[iconImageTasks,setIconImageTasks]=useState(0);
  const composition=tool?.compositions?.find(item=>item.id===compositionId);
  const editorApi=useCallback((action,body)=>compositionId&&action==='layout/save'?api('layout/save-composition',{id:compositionId,document:body}):api(action,body),[api,compositionId]);
  const source=compositionId?composition:tool;
  const {draft,setDraft,dirty,saving,save,error:saveError}=useLayoutAutosave(source?.document,source?.revision,editorApi,loadingImage||iconImageTasks>0);
  if(!draft)return <Card className="loading">Cargando editor…</Card>;
  const change = patch => {setDraft(d=>({...d,...(typeof patch==='function'?patch(d):patch)}));};
  const uploadBackground = async file => {
    setLoadingImage(true);
    try {const image=await readBackgroundImage(file);change({backgroundImage:image,backgroundMode:'image',transparent:false});}
    catch(error){notice(error.message,{type:'error'});}finally{setLoadingImage(false);}
  };
  const update = (id,patch) => {setDraft(d=>({...d,elements:d.elements.map(e=>e.id===id?{...e,...patch}:e)}));};
  const updateIcon = (rowId,iconId,patch) => {setDraft(d=>({...d,elements:d.elements.map(e=>e.id===rowId&&e.kind==='icons'?{...e,icons:e.icons.map(i=>i.id===iconId?{...i,...patch}:i)}:e)}));};
  const chooseIcon = (rowId,iconId) => {setSelected(rowId);setSelectedIcon(iconId);};
  const remove = id => {
    if (!draft.elements.some(e=>e.id===id)) return;
    setDraft(d=>({...d,elements:d.elements.filter(e=>e.id!==id)}));
    setSelected(current=>current===id?null:current);
  };
  const deleteKey = event => {
    if (event.target.closest('.layout-library')) return;
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)&&!event.isComposing&&!event.ctrlKey&&!event.altKey&&!event.metaKey&&!event.target.closest('input,textarea,select,button,a,[contenteditable]:not([contenteditable="false"])')){
      const element=draft.elements.find(e=>e.id===selected);
      if(element){event.preventDefault();const size=canvasSize(draft),step=event.shiftKey?10:1;update(element.id,gridTransform(element,event.key==='ArrowLeft'?-step:event.key==='ArrowRight'?step:0,event.key==='ArrowUp'?-step:event.key==='ArrowDown'?step:0,size.width,size.height,{snap:false}));}
      return;
    }
    if (!['Delete','Backspace'].includes(event.key) || event.isComposing || event.ctrlKey || event.altKey || event.metaKey || event.target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])')) return;
    if (draft.elements.some(e=>e.id===selected)) {event.preventDefault();remove(selected);}
  };
  const {width,height}=canvasSize(draft);
  const setCanvasSize=(w,h)=>change(d=>{
    const previous=canvasSize(d);
    const scale=Math.min(w,h)/Math.min(previous.width,previous.height);
    const elements=d.elements.map(e=>{
      if(e.kind!==messengerCameraKind)return e;
      const side=Math.min(w,h,Math.max(messengerCameraMinSide(w,h),e.w*previous.width/100*scale));
      const dimensions=messengerCameraDimensions(side,w,h);
      return {...e,...dimensions,x:Math.min(e.x,100-dimensions.w),y:Math.min(e.y,100-dimensions.h)};
    });
    return {canvasWidth:w,canvasHeight:h,format:h>w?'portrait':'landscape',elements};
  });
  const resizeCanvas=(key,value)=>setCanvasSize(key==='width'?Math.round(value):width,key==='height'?Math.round(value):height);
  const current = draft.elements.find(e=>e.id===selected);
  const messengerSelected=current?.kind===messengerCameraKind;
  const defaultCameraColor=messengerCameraDefaultColor(draft.theme);
  const controlsBounds = current && xpControlsBounds(current,width,height);
  const controlPosition = axis => {
    const range=axis==='x'?controlsBounds.rangeX:controlsBounds.rangeY;
    const position=axis==='x'?controlsBounds.left:controlsBounds.top;
    return <LayoutNumberField label={`Controles ${axis.toUpperCase()} (px)`} value={position} min={controlsBounds.padding} max={controlsBounds.padding+range} onChange={value=>update(current.id,{xpControls:{...current.xpControls,x:current.xpControls?.x??1,y:current.xpControls?.y??0,[axis]:range?Math.min(1,Math.max(0,(value-controlsBounds.padding)/range)):axis==='x'?1:0}})}/>;
  };
  const applyTemplate = template => {setPreviousLayout(draft);setDraft({...createVerticalLayout(template,Object.hasOwn(themes,draft.theme)?draft.theme:'dark'),theme:draft.theme,...(draft.customThemes?{customThemes:draft.customThemes}:{})});setSelected('camera');};
  const output = layoutOutputURL(window.location.href,compositionId);
  const addMessengerCamera = () => {
    const id=crypto.randomUUID();
    const dimensions=messengerCameraDimensions(Math.min(width,height)*.4,width,height);
    change(d=>({elements:[...d.elements,{id,kind:messengerCameraKind,title:'Cámara MSN Messenger',text:'',x:10,y:25,...dimensions,fontSize:26,hidden:false}]}));
    setSelected(id);
  };
  const add = kind => {if(kind==='icons'){const row=createIconRow(crypto.randomUUID());if(draft.format==='landscape'){row.y=84;row.h=12;}change({elements:[...draft.elements,row]});chooseIcon(row.id,row.icons[0].id);return;}const id=(kind==='frame'?'camera-':'')+crypto.randomUUID(),barHeight=Math.max(1,40/height*100);change({elements:[...draft.elements,{id,kind,title:kind==='taskbar'?'start':kind==='frame'?'Cámara.exe':'Ventana.exe',text:kind==='text'?'Escribe aquí':'',x:kind==='taskbar'?0:10,y:kind==='taskbar'?100-barHeight:25,w:kind==='taskbar'?100:40,h:kind==='taskbar'?barHeight:25,fontSize:26,hidden:false}]});setSelected(id);};

  const number = (key,label,min,max) => {
    const factor=['x','w'].includes(key)?width/100:['y','h'].includes(key)?height/100:1;
    return <LayoutNumberField key={current.id+'-'+key+'-'+draft.format} label={label} value={current[key]*factor} min={min*factor} max={max*factor} onChange={pixels=>update(current.id,{[key]:pixels/factor})}/>;
  };
  return <div className="layout-studio" onKeyDown={deleteKey}>
    <LayoutLibrary document={draft} tool={tool} api={api} notice={notice} open={open} compositionId={compositionId} busy={loadingImage||iconImageTasks>0} preview={layout=><LayoutCanvas document={layout}/>}/>
    {composition&&<h2>{composition.name}</h2>}
    <OutputToolbar className="layout-toolbar" title="Layout Studio" description={<>{saveError?'Error al guardar':saving?'Guardando automáticamente…':dirty?'Cambios pendientes…':'Autoguardado · salida sincronizada'} · {width} &times; {height}</>}>
      <OutputLinks notice={notice} url={output} message={`Enlace de ${composition?.name ?? 'Layout principal'} copiado.`} fallback="Salida" openLabel="Ver salida"/>
      <Button disabled={!dirty||saving||loadingImage||iconImageTasks>0} onClick={save}>{saving?'Guardando…':saveError?'Reintentar guardado':'Guardar layout'}</Button>
    </OutputToolbar>
    {tool.error&&<p className="error">{tool.error}</p>}{saveError&&<p className="error" role="alert">{saveError} Tus cambios siguen en el editor.</p>}
    <CustomThemeEditor document={draft} change={change} preview={<LayoutCanvas document={draft}/>}/><section className="vertical-presets"><div className="vertical-presets-heading"><div><p className="eyebrow">PENSADO PARA TU LIVE</p><h3>Composiciones para TikTok LIVE</h3><p className="help">1080 × 1920 · Elige una composición y personaliza cada ventana.</p></div>{previousLayout&&<Button variant="outline" size="sm" onClick={()=>{setDraft(previousLayout);setPreviousLayout(null);setSelected(null);}}>Deshacer plantilla</Button>}</div><div className="vertical-presets-grid">{Object.entries(layoutTemplates).map(([id,template])=><button className="vertical-preset" key={id} onClick={()=>applyTemplate(id)}><span className="vertical-preset-mini" aria-hidden="true">{template.elements.map(e=><i key={e.id} className={'mini-'+e.kind} style={{left:e.x+'%',top:e.y+'%',width:e.w+'%',height:e.h+'%'}}/>)}</span><span><strong>{template.name}</strong><small>{template.description}</small><b>Usar composición →</b></span></button>)}</div><p className="help">Aplicar una composición reemplaza el borrador. Puedes deshacerla; los cambios se guardan automáticamente.</p></section>
    <div className="layout-workspace"><Card className="layout-options"><h3>Estilo de escena</h3><div className="layout-themes">{Object.entries(themes).map(([id,name])=><button key={id} aria-pressed={draft.theme===id} className={'theme-swatch swatch-'+id} onClick={()=>change({theme:id})}><span/>{name}</button>)}</div>
      <h3>Lienzo</h3>
      <label>Formato<Select value={!customResolution&&(width===(draft.format==='portrait'?1080:1920)&&height===(draft.format==='portrait'?1920:1080))?draft.format:'custom'} onChange={e=>{
        const format=e.target.value;
        setCustomResolution(format==='custom');
        if(format==='custom'){
          const input=e.currentTarget.closest('.layout-options').querySelector('[aria-label="Ancho del lienzo (px)"]');
          input.focus();input.select();
        }else setCanvasSize(format==='portrait'?1080:1920,format==='portrait'?1920:1080);
      }}><option value="custom">Personalizado</option><option value="landscape">Horizontal · 16:9</option><option value="portrait">Vertical · 9:16</option></Select></label>
      <LayoutNumberField label="Ancho del lienzo (px)" value={width} min={240} max={7680} onChange={value=>resizeCanvas('width',value)}/>
      <LayoutNumberField label="Alto del lienzo (px)" value={height} min={240} max={7680} onChange={value=>resizeCanvas('height',value)}/>
      <p className="help">Resoluci?n personalizada. Los elementos conservan su distribuci?n proporcional. Elige un formato para restaurar su resoluci?n est?ndar.</p>
      <h3>Fondo del layout</h3>
      <label>Tipo de fondo<Select value={backgroundMode(draft)} disabled={loadingImage} onChange={e=>change({backgroundMode:e.target.value,transparent:e.target.value==='transparent'})}><option value="transparent">Transparente</option><option value="color">Color</option><option value="image">Imagen</option></Select></label>
      <label>Color de fondo<Input type="color" value={draft.background} onChange={e=>change({background:e.target.value,backgroundMode:'color',transparent:false})}/></label>
      <FilePicker label={loadingImage?'Preparando imagen…':draft.backgroundImage?'Cambiar imagen':'Subir imagen'} accept="image/png,image/jpeg,image/webp" disabled={loadingImage} onFile={uploadBackground}/>
      {draft.backgroundImage&&<><img className="layout-background-thumbnail" src={draft.backgroundImage} alt="Fondo seleccionado"/><label>Ajuste de imagen<Select value={draft.backgroundFit||'cover'} onChange={e=>change({backgroundFit:e.target.value,backgroundMode:'image',transparent:false})}><option value="cover">Rellenar (recortar bordes)</option><option value="contain">Mostrar imagen completa</option><option value="stretch">Estirar</option></Select></label><Button variant="outline" size="sm" disabled={loadingImage} onClick={()=>change({backgroundImage:'',backgroundMode:'color',transparent:false})}>Quitar imagen</Button></>}
      <p className="help">PNG, JPG o WebP · hasta 10 MB. El fondo respeta los huecos transparentes de las ventanas.</p>
      <h3>Elementos</h3><p className="help">El último aparece encima.</p><div className="actions"><Button size="sm" variant="outline" disabled={draft.elements.length>=30} onClick={()=>add('text')}>+ Texto</Button><Button size="sm" variant="outline" disabled={draft.elements.length>=30} onClick={()=>add('frame')}>+ Marco</Button><Button size="sm" variant="outline" disabled={draft.elements.length>=30} onClick={addMessengerCamera}>+ Cámara MSN Messenger</Button><Button size="sm" variant="outline" disabled={draft.elements.length>=30} onClick={()=>add('taskbar')}>+ Barra de tareas</Button><Button size="sm" variant="outline" disabled={draft.elements.length>=30} onClick={()=>add('icons')}>+ Fila de iconos</Button></div>
      <div className="layout-layers">{draft.elements.map(e=><div className="layout-layer-row" key={e.id}><button className="layout-layer-select" aria-pressed={selected===e.id} onClick={()=>setSelected(e.id)}>{e.title||'Sin título'}{e.hidden?' · oculto':''}</button><Button variant="destructive" size="icon" aria-label={'Eliminar elemento: '+(e.title||'Sin título')} title="Eliminar elemento" onClick={()=>remove(e.id)}><Trash2 size={15}/></Button></div>)}</div>{!draft.elements.length&&<p className="help">No hay elementos. Añade un texto, marco o barra de tareas.</p>}
    </Card><div className="layout-preview"><div className="layout-preview-heading"><span>VISTA PREVIA</span><span>Arrastra para mover · Supr para eliminar</span></div><div className="layout-preview-tools"><strong>{width} &times; {height} px</strong>{draft.format==='portrait'&&<label className="layout-check"><input type="checkbox" checked={guides} onChange={e=>setGuides(e.target.checked)}/> Guías de interfaz</label>}</div><div className="layout-grid-tools"><label className="layout-check"><input type="checkbox" checked={grid} onChange={e=>setGrid(e.target.checked)}/> Ajustar a cuadrícula</label><LayoutNumberField label="Paso de cuadrícula (px)" value={gridSize} min={1} max={128} onChange={setGridSize}/><span className="help">Alt: movimiento libre | Shift: bloquear eje | Flechas: 1 px | Shift + flechas: 10 px</span></div><div className={'layout-stage '+draft.format}><LayoutCanvas document={draft} selected={selected} select={setSelected} update={update} remove={remove} guides={guides} grid={grid} gridSize={gridSize} selectedIcon={selectedIcon} selectIcon={chooseIcon}/></div><p className="help">Las guías y los indicadores de cámara/juego solo aparecen aquí. El espacio para la interfaz es orientativo. Los cambios se guardan y actualizan la salida automáticamente. Configura la fuente de navegador en {width} &times; {height} px para que llene el encuadre. Todas las ventanas tienen el interior transparente. Coloca tus fuentes de cámara y juego debajo del overlay en OBS o TikTok LIVE Studio.</p></div>
    <Card className="layout-inspector"><h3>Propiedades</h3>{current?<>{draft.theme==='xp'&&['text','frame'].includes(current.kind)&&<><p className="help">Arrastra los tres controles XP juntos dentro de la ventana. Su posici&oacute;n se adapta al cambiar el tama&ntilde;o.</p><Button variant="outline" size="sm" onClick={()=>update(current.id,{xpControls:{x:1,y:0}})}>Restablecer controles XP</Button></>}<label>{current.kind==='taskbar'?'Texto de Inicio':'Título'}<Input maxLength={80} value={current.title} onChange={e=>update(current.id,{title:e.target.value})}/></label>{current.kind!=='icons'&&!messengerSelected&&<label>{current.kind==='taskbar'?'Reloj (vacío para ocultar)':'Texto'}<Textarea maxLength={300} value={current.text} onChange={e=>update(current.id,{text:e.target.value})}/></label>}{draft.theme==='xp'&&['text','frame'].includes(current.kind)&&<fieldset><legend>Posici&oacute;n de los controles de ventana</legend><p className="help">Arrastra los botones juntos o ajusta su posici&oacute;n dentro de la ventana en p&iacute;xeles.</p><div className="form-row">{controlPosition('x')}{controlPosition('y')}</div><LayoutNumberField label="Tamaño de controles (%)" value={(current.xpControls?.scale??1)*100} min={50} max={400} onChange={value=>update(current.id,{xpControls:{x:current.xpControls?.x??1,y:current.xpControls?.y??0,scale:value/100}})}/><p className="help">100% es el tama&ntilde;o original. Se ajustan al espacio disponible dentro de la ventana.</p></fieldset>}{current.kind==='icons'&&<IconRowEditor key={current.id} row={current} selectedIcon={selectedIcon} selectIcon={setSelectedIcon} updateRow={patch=>update(current.id,patch)} updateIcon={updateIcon} notice={notice} imageTask={delta=>setIconImageTasks(count=>count+delta)} format={draft.format} canvasWidth={width} canvasHeight={height}/>}<div className="form-row">{number('x','X (px)',0,Math.min(99,100-current.w))}{number('y','Y (px)',0,Math.min(99,100-current.h))}
      {messengerSelected
        ? <LayoutNumberField key={current.id} label="Lado (px)" value={current.w*width/100} min={messengerCameraMinSide(width,height)} max={Math.max(messengerCameraMinSide(width,height),messengerCameraMaxSide(current,width,height))} onChange={side=>update(current.id,messengerCameraDimensions(side,width,height))}/>
        : <>{number('w','Ancho (px)',5,100-current.x)}{number('h','Alto (px)',current.kind==='taskbar'?1:5,100-current.y)}</>}
      </div>{messengerSelected
        ? <><label>Color del marco<Input type="color" value={current.frameColor??defaultCameraColor} onChange={e=>update(current.id,{frameColor:e.target.value===defaultCameraColor?undefined:e.target.value})}/></label>
          <Button variant="outline" size="sm" disabled={!current.frameColor} onClick={()=>update(current.id,{frameColor:undefined})}>Restablecer color</Button>
          <label className="layout-check"><input type="checkbox" checked={current.frameAnimated??false} onChange={e=>update(current.id,{frameAnimated:e.target.checked})}/> Animar colores del marco</label></>
        : number('fontSize','Tamaño de texto (px)',10,72)}
      <label className="layout-check"><input type="checkbox" checked={!current.hidden} onChange={e=>update(current.id,{hidden:!e.target.checked})}/> Visible</label><div className="actions"><Button size="sm" variant="outline" onClick={()=>change({elements:[...draft.elements.filter(e=>e.id!==selected),current]})}>Traer al frente</Button><Button size="sm" variant="destructive" onClick={()=>remove(selected)}>Eliminar</Button></div></>:<p className="help">Selecciona un elemento para editarlo.</p>}</Card></div>
  </div>;
}
