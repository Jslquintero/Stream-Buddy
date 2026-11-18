import {useRef} from 'react';
import {canvasSize} from '../../../shared/layout';
import {xpControlsBounds} from '../../../shared/xp-controls';

export function XpControls({element,document,update,select,remove}) {
  const drag=useRef(null),suppressClick=useRef(false);
  const {width,height}=canvasSize(document),bounds=xpControlsBounds(element,width,height);
  const start=event=>{
    if(!update||event.button!==0)return;
    event.stopPropagation();select(element.id);suppressClick.current=false;
    const windowRect=event.currentTarget.closest('.xp-window').getBoundingClientRect();
    drag.current={x:event.clientX,y:event.clientY,bounds,close:!!event.target.closest('.close-window'),zoom:windowRect.width/(element.w*width/100)};
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const move=event=>{
    const d=drag.current;if(!d)return;
    event.stopPropagation();
    if(!suppressClick.current&&Math.hypot(event.clientX-d.x,event.clientY-d.y)<3)return;
    suppressClick.current=true;
    const b=d.bounds,clamp=value=>Math.min(1,Math.max(0,value));
    update(element.id,{xpControls:{x:b.rangeX?clamp((b.left-b.padding+(event.clientX-d.x)/d.zoom)/b.rangeX):1,y:b.rangeY?clamp((b.top-b.padding+(event.clientY-d.y)/d.zoom)/b.rangeY):0}});
  };
  return <span className="xp-controls" aria-label={update?'Mover controles de ventana':undefined} title={update?'Arrastra los tres controles como un grupo':undefined}
    style={{left:bounds.left,top:bounds.top,transform:`scale(${bounds.scale})`}}
    onPointerDown={start} onPointerMove={move} onPointerUp={event=>{if(drag.current){event.stopPropagation();const close=drag.current.close&&!suppressClick.current;drag.current=null;if(close&&remove){suppressClick.current=true;remove(element.id);}}}} onPointerCancel={()=>{drag.current=null;suppressClick.current=true;}}
    onClickCapture={event=>{if(suppressClick.current){event.preventDefault();event.stopPropagation();suppressClick.current=false;}}}>
    <i aria-hidden="true">_</i><i aria-hidden="true">□</i>{remove?<button className="close-window" aria-label={'Eliminar '+element.title} onClick={()=>remove(element.id)}>×</button>:<i aria-hidden="true">×</i>}
  </span>;
}
